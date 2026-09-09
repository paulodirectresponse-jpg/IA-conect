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

const DEFAULT_FIREBASE_CONFIG: FirebaseAppConfig = {
  projectId: 'gen-lang-client-0510531411',
  appId: '1:95393923395:web:7611476379065294276ff6',
  apiKey: 'AIzaSyDAwbXpg8vbJkNycgfb4c6-RMGvvj0FthI',
  authDomain: 'gen-lang-client-0510531411.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-plataformadegera-e6616302-36d7-4bea-b8cc-032f200c423e',
  storageBucket: 'gen-lang-client-0510531411.firebasestorage.app',
  messagingSenderId: '95393923395',
  oAuthClientId: '95393923395-vcqb1jqq71irjuvdfekt773a3n3thank.apps.googleusercontent.com',
};

let cachedConfig: FirebaseAppConfig | null = null;

/**
 * Runtime-safe Firebase config.
 *
 * Cloudflare Workers do not expose the repository filesystem at runtime, so the
 * backend must not read firebase-applet-config.json with node:fs. Public Firebase
 * web configuration is safe to bundle; sensitive credentials remain Worker secrets.
 */
export function getFirebaseConfig(): FirebaseAppConfig {
  if (!cachedConfig) {
    cachedConfig = {
      ...DEFAULT_FIREBASE_CONFIG,
      projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    };
  }
  return cachedConfig;
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
    headers.Authorization = `Bearer ${idToken}`;
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
