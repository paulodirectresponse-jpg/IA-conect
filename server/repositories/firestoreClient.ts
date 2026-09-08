import fs from 'fs';
import path from 'path';

export interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  oAuthClientId?: string;
}

let cachedConfig: FirebaseAppConfig | null = null;

export function getFirebaseConfig(): FirebaseAppConfig {
  if (!cachedConfig) {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      cachedConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0510531411',
        appId: '',
        apiKey: process.env.FIREBASE_API_KEY || '',
        authDomain: '',
        firestoreDatabaseId: '(default)',
      };
    }
  }
  return cachedConfig!;
}

/**
 * Executes a call against the Firestore REST API on behalf of the user's ID token.
 */
export async function firestoreRestCall(
  collectionPath: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any,
  idToken?: string
): Promise<any> {
  const config = getFirebaseConfig();
  const dbId = config.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents/${collectionPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = { message: errText };
    }
    const error: any = new Error(parsed?.error?.message || `Firestore REST error (${response.status})`);
    error.status = response.status;
    error.details = parsed;
    throw error;
  }

  return response.json();
}
