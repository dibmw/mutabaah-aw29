import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  Firestore
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyALbc7nMALmwoh9XCoibNnH8IdYaifQpXs",
  authDomain: "mutabaah-alwildan29.firebaseapp.com",
  projectId: "mutabaah-alwildan29",
  storageBucket: "mutabaah-alwildan29.firebasestorage.app",
  messagingSenderId: "454368712031",
  appId: "1:454368712031:web:2b02d1470ff545379552ea",
  measurementId: "G-VMJNN5L55V"
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with Offline Persistence (IndexedDB multi-tab)
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  // If already initialized (e.g. HMR in dev)
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
