import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

export { onAuthStateChanged, type User, signInWithEmailAndPassword, createUserWithEmailAndPassword };

import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  onSnapshot, 
  writeBatch,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';

// Vite requires env variables to start with VITE_
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// --- Auth Helpers ---

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

// --- Sync Logic ---

// Collection References
// Structure: users/{userId}/notes/{noteId}
// Structure: users/{userId}/notebooks/{notebookId}

export const syncService = {
  // Push a single note to Firestore
  async pushNote(user: User, note: any) {
    if (!user) return;

    const batch = writeBatch(db);
    const timestamp = Date.now();

    // 1. Update the private note
    const privateNoteRef = doc(db, 'users', user.uid, 'notes', note.id);
    batch.set(privateNoteRef, { ...note, updatedAt: timestamp }, { merge: true });

    // 2. If the note is public, update the shared copy as well
    if (note.accessInfo?.isPublic && note.accessInfo?.publicLinkId) {
      const publicNoteRef = doc(db, 'shared_notes', note.accessInfo.publicLinkId);
      const publicNoteData = {
          id: note.id,
          title: note.title || "Untitled",
          content: note.content || "",
          format: note.format || "markdown",
          tags: note.tags || [],
          createdAt: note.createdAt || timestamp,
          updatedAt: timestamp,
          ownerId: user.uid,
          isPublic: true
      };
      batch.set(publicNoteRef, publicNoteData);
    }

    try {
        await batch.commit();
    } catch (e) {
      console.error("Sync push note error:", e);
    }
  },

  // Push a single notebook to Firestore
  async pushNotebook(user: User, notebook: any) {
    if (!user) return;
    try {
      const nbRef = doc(db, 'users', user.uid, 'notebooks', notebook.id);
      await setDoc(nbRef, { ...notebook }, { merge: true });
    } catch (e) {
      console.error("Sync push notebook error:", e);
    }
  },

  // Delete note from Firestore
  async deleteNote(user: User, noteId: string) {
    if (!user) return;
    try {
        const privateNoteRef = doc(db, 'users', user.uid, 'notes', noteId);

        // We need to get the note to check if it has a public link
        const noteSnap = await getDoc(privateNoteRef);

        const batch = writeBatch(db);

        // Delete the private note
        batch.delete(privateNoteRef);

        // If it was public, delete the shared copy
        if (noteSnap.exists()) {
            const noteData = noteSnap.data();
            if (noteData.accessInfo?.isPublic && noteData.accessInfo?.publicLinkId) {
                const publicNoteRef = doc(db, 'shared_notes', noteData.accessInfo.publicLinkId);
                batch.delete(publicNoteRef);
            }
        }

        await batch.commit();

    } catch (e) {
      console.error("Sync delete note error:", e);
    }
  },

  // Get a public note (no auth required)
  async getPublicNote(linkId: string) {
    try {
      const snap = await getDoc(doc(db, 'shared_notes', linkId));
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (e) {
      console.error("Error fetching public note:", e);
      return null;
    }
  },

  // Share/Unshare a note
  async shareNote(user: User, note: any, enable: boolean) {
    if (!user || !note) return;
    
    // Determine Link ID (reuse existing or generate new)
    const linkId = note.accessInfo?.publicLinkId || crypto.randomUUID();

    console.log(`[Share] Toggling share: ${enable} for note ${note.id} by user ${user.uid}`);

    try {
        if (enable) {
            // Explicitly construct public note data to ensure ownerId is top-level and correct
            const publicNoteData = {
                id: note.id,
                title: note.title || "Untitled",
                content: note.content || "",
                format: note.format || "markdown",
                tags: note.tags || [],
                createdAt: note.createdAt || Date.now(),
                updatedAt: Date.now(),
                ownerId: user.uid, // CRITICAL: This must match request.auth.uid for the security rule
                // We do NOT include the full accessInfo here to avoid confusion, 
                // but we can include a flag if needed.
                isPublic: true 
            };

            // Write to shared_notes collection using linkId as key
            await setDoc(doc(db, 'shared_notes', linkId), publicNoteData);
        } else {
            // Remove from shared_notes
            // Use the linkId stored on the note if available
            const targetLinkId = note.accessInfo?.publicLinkId;
            if (targetLinkId) {
                await deleteDoc(doc(db, 'shared_notes', targetLinkId));
            }
        }

        // Update the private note's access info
        const accessInfo = {
            isPublic: enable,
            sharedWithCount: note.accessInfo?.sharedWithCount || 0,
            publicLinkId: enable ? linkId : null
        };

        await setDoc(doc(db, 'users', user.uid, 'notes', note.id), {
            accessInfo,
            updatedAt: Date.now()
        }, { merge: true });

        return enable ? linkId : null;

    } catch (e) {
        console.error("Error sharing note:", e);
        throw e;
    }
  },

  // Delete notebook from Firestore
  async deleteNotebook(user: User, notebookId: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notebooks', notebookId));
    } catch (e) {
      console.error("Sync delete notebook error:", e);
    }
  },

  // Initial Pull & Merge
  // Returns { notes, notebooks } from cloud to be merged by the app
  async pullAll(user: User) {
    if (!user) return { notes: [], notebooks: [] };
    
    try {
      const notesSnapshot = await getDocs(collection(db, 'users', user.uid, 'notes'));
      const notebooksSnapshot = await getDocs(collection(db, 'users', user.uid, 'notebooks'));

      const cloudNotes = notesSnapshot.docs.map(d => d.data());
      const cloudNotebooks = notebooksSnapshot.docs.map(d => d.data());

      return { notes: cloudNotes, notebooks: cloudNotebooks };
    } catch (e) {
      console.error("Sync pull error:", e);
      return { notes: [], notebooks: [] };
    }
  },

  // Realtime Listeners
  subscribeNotes(user: User, onUpdate: (notes: any[]) => void) {
    if (!user) return () => {};
    const q = query(collection(db, 'users', user.uid, 'notes'));
    return onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(d => d.data());
      onUpdate(notes);
    });
  },

  subscribeNotebooks(user: User, onUpdate: (notebooks: any[]) => void) {
    if (!user) return () => {};
    const q = query(collection(db, 'users', user.uid, 'notebooks'));
    return onSnapshot(q, (snapshot) => {
      const notebooks = snapshot.docs.map(d => d.data());
      onUpdate(notebooks);
    });
  },

  // --- Settings Sync ---

  // Push settings to Firestore
  async pushSettings(user: User, settings: any) {
    if (!user) return;
    try {
      await setDoc(doc(db, 'user_settings', user.uid), settings);
    } catch (e) {
      console.error("Error pushing settings:", e);
    }
  },

  // Pull settings from Firestore
  async pullSettings(user: User): Promise<any | null> {
    if (!user) return null;
    try {
      const docSnap = await getDoc(doc(db, 'user_settings', user.uid));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (e) {
      console.error("Error pulling settings:", e);
      return null;
    }
  },

  // Subscribe to real-time settings changes
  subscribeToSettings(user: User, onUpdate: (settings: any) => void) {
    if (!user) return () => {};
    const settingsDocRef = doc(db, 'user_settings', user.uid);
    return onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        onUpdate(doc.data());
      }
    });
  }
};
