# Gemini Project: Daylo

## Project Overview

Daylo is a local-first, Progressive Web App (PWA) for note-taking, drawing, and mind-mapping. It prioritizes offline capability using IndexedDB while offering real-time cloud synchronization via Firebase.

**Key Technologies:**

*   **Frontend:** React 19, TypeScript, Vite 6
*   **Styling:** Tailwind CSS (configured in `index.css`)
*   **Routing:** React Router DOM v7
*   **State/Storage:** IndexedDB (via `services/storage.ts`), Firebase Realtime Database (via `services/firebase.ts`)
*   **PWA:** Service Worker and Manifest in `public/`

## Building and Running

*   **Install Dependencies:** `npm install`
*   **Development Server:** `npm run dev` (Runs on port 3000)
*   **Production Build:** `npm run build`
*   **Preview Production Build:** `npm run preview`

## Directory Structure & Key Files

*   **`components/`**: specific UI components.
    *   `Editor.tsx`: The main markdown editor component.
    *   `CanvasEditor.tsx`: Drawing functionality.
    *   `MindMapEditor.tsx`: Mind mapping interface.
    *   `Sidebar.tsx`: Navigation and file management.
*   **`services/`**: Core application logic.
    *   `storage.ts`: Handles local IndexedDB operations (CRUD for notes).
    *   `firebase.ts`: Firebase configuration and cloud interactions.
    *   `sync.ts`: Logic to synchronize local data with Firebase.
*   **`public/`**: Static assets.
    *   `manifest.json`: PWA configuration.
    *   `sw.js`: Service Worker script.
*   **`types.ts`**: TypeScript definitions for application data models (Notes, etc.).
*   **`vite.config.ts`**: Vite configuration, including port settings and plugins.

## Development Conventions

*   **Local-First:** The app reads/writes to local storage first. Sync happens in the background.
*   **Styling:** Utility-first CSS using Tailwind.
*   **Icons:** `lucide-react` is used for UI icons.

## Firebase Configuration

*   **Security Rules:** The project requires specific Firestore security rules to handle user data and shared notes securely. See `firestore.rules` in the project root.

