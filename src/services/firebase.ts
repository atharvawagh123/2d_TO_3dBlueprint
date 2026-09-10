// Firebase integration layer with automatic offline/demo fallback

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

// We keep a lightweight abstraction to prevent crashes when Firebase keys aren't set in dev
export class FirebaseClient {
  public isConnected: boolean;

  constructor() {
    this.isConnected = isFirebaseConfigured;
    if (this.isConnected) {
      console.log('⚡ Connected to Google Cloud Firebase:', firebaseConfig.projectId);
    } else {
      console.log('⚡ Running in Offline / Demo Mode (LocalStorage Repository Active)');
    }
  }
}

export const firebaseClient = new FirebaseClient();
