import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getFirebaseConfig } from './firestoreClient.js';

let appInstance: App | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: Storage | null = null;

export function getAdminApp(): App {
  if (!appInstance) {
    const cfg = getFirebaseConfig();
    if (getApps().length === 0) {
      appInstance = initializeApp({
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
      });
    } else {
      appInstance = getApp();
    }
  }
  return appInstance;
}

export function getAdminDb(): Firestore | null {
  if (!dbInstance) {
    try {
      const app = getAdminApp();
      const cfg = getFirebaseConfig();
      // If a specific databaseId is configured in firebase-applet-config.json
      if (cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== '(default)') {
        dbInstance = getFirestore(app, cfg.firestoreDatabaseId);
      } else {
        dbInstance = getFirestore(app);
      }
    } catch (e: any) {
      console.warn('[Firebase Admin] Warning initializing Firestore Admin:', e?.message);
      return null;
    }
  }
  return dbInstance;
}

export function getAdminStorage(): Storage | null {
  if (!storageInstance) {
    try {
      const app = getAdminApp();
      storageInstance = getStorage(app);
    } catch (e: any) {
      console.warn('[Firebase Admin] Warning initializing Storage Admin:', e?.message);
      return null;
    }
  }
  return storageInstance;
}
