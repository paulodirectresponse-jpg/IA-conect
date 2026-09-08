import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Authentication Instance
export const auth = getAuth(app);

// Firestore Instance bound to the specific provisioned database
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Validate connection on boot as recommended in Firebase guidelines
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'app_config', 'health_check'));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('[Firebase] Offline mode or connection warning:', error.message);
    }
    return false;
  }
}

export default app;
