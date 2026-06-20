# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- To run the app in development mode: `npm run dev`
- To build the app for production: `npm run build`
- To preview the production build: `npm run preview`

## Architecture

This is a Markdown notes application built with React, TypeScript, and Vite. It uses Tailwind CSS for styling.

### Core Components:

- **`App.tsx`**: The root component that manages the overall application state, including notes, notebooks, and user authentication. It also sets up the main routing.
- **`components/Sidebar.tsx`**: Displays the list of notebooks and notes, and allows for creation, deletion, and searching.
- **`components/Editor.tsx`**: The main component for editing a note's content. It supports different note formats.
- **`services/storage.ts`**: Handles all interactions with the local browser storage (likely IndexedDB) for creating, reading, updating, and deleting notes and notebooks. All data is stored locally first.
- **`services/firebase.ts`** and **`services/sync.ts`**: Manages user authentication with Firebase and synchronizes local data with Firestore for backup and access across devices.

### Data Flow:

1.  The application boots up in `App.tsx` and initializes data from local storage via `initializeData()` from `storage.ts`.
2.  State for notes, notebooks, and settings is held in the `App` component and passed down to child components as props.
3.  When a user takes an action (e.g., updating a note), the corresponding function in `App.tsx` (e.g., `handleUpdateNote`) is called.
4.  This function first updates the application's state, then persists the change to local storage using a function from `storage.ts`.
5.  If a user is logged in, the change is also pushed to Firebase via the `syncService`.
6.  Real-time listeners in `App.tsx` subscribe to changes from Firebase and update the local state and storage if a newer version of a note or notebook is available from the server.
