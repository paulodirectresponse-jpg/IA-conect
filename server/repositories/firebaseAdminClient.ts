import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  App,
} from 'firebase-admin/app';
import {
  initializeFirestore,
  Firestore,
} from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getFirebaseConfig } from './firestoreClient.js';

let appInstance: App | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: Storage | null = null;

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    // Local Node/Google runtimes can still use Application Default Credentials.
    // Cloudflare Workers must receive FIREBASE_SERVICE_ACCOUNT_JSON as a secret.
    return applicationDefault();
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return cert(parsed);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválido. Cadastre o JSON completo da service account como secret do Worker.');
  }
}

export function getAdminApp(): App {
  if (!appInstance) {
    const cfg = getFirebaseConfig();
    if (getApps().length === 0) {
      appInstance = initializeApp({
        credential: getCredential(),
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
      const settings = {
        preferRest: true,
        ignoreUndefinedProperties: true,
      };

      // preferRest keeps Firestore on HTTP/1.1 and avoids the gRPC transport,
      // which is not available in Cloudflare Workers.
      dbInstance = cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== '(default)'
        ? initializeFirestore(app, settings, cfg.firestoreDatabaseId)
        : initializeFirestore(app, settings);
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
