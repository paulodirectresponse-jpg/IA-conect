export interface FirebaseAppConfig {
  projectId:string;
  appId:string;
  apiKey:string;
  authDomain:string;
  firestoreDatabaseId:string;
  storageBucket?:string;
  messagingSenderId?:string;
  oAuthClientId?:string;
}

const DEFAULT_FIREBASE_CONFIG:FirebaseAppConfig={
  projectId:'gen-lang-client-0510531411',
  appId:'1:95393923395:web:7611476379065294276ff6',
  apiKey:'AIzaSyDAwbXpg8vbJkNycgfb4c6-RMGvvj0FthI',
  authDomain:'gen-lang-client-0510531411.firebaseapp.com',
  firestoreDatabaseId:'ai-studio-plataformadegera-e6616302-36d7-4bea-b8cc-032f200c423e',
  storageBucket:'gen-lang-client-0510531411.firebasestorage.app',
  messagingSenderId:'95393923395',
  oAuthClientId:'95393923395-vcqb1jqq71irjuvdfekt773a3n3thank.apps.googleusercontent.com',
};

let cachedConfig:FirebaseAppConfig|null=null;

export function getFirebaseConfig():FirebaseAppConfig{
  if(!cachedConfig){
    cachedConfig={
      ...DEFAULT_FIREBASE_CONFIG,
      projectId:process.env.FIREBASE_PROJECT_ID||DEFAULT_FIREBASE_CONFIG.projectId,
      firestoreDatabaseId:process.env.FIREBASE_DATABASE_ID||DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
      storageBucket:process.env.FIREBASE_STORAGE_BUCKET||DEFAULT_FIREBASE_CONFIG.storageBucket,
    };
  }
  return cachedConfig;
}
