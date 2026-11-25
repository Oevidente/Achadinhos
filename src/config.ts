import firebaseAppletConfig from '../firebase-applet-config.json';

export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const env = import.meta.env;

export const firebaseConfig: FirebaseAppConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
  firestoreDatabaseId:
    env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId,
};

const defaultAdminEmails = ['andreluiz1902@gmail.com', 'SEU_EMAIL_AQUI@gmail.com'];

const envAdmins =
  typeof env.VITE_ADMIN_EMAILS === 'string' && env.VITE_ADMIN_EMAILS.trim().length > 0
    ? env.VITE_ADMIN_EMAILS.split(',')
        .map((email: string) => email.trim().toLowerCase())
        .filter(Boolean)
    : [];

export const ADMIN_EMAILS: string[] = Array.from(
  new Set([...defaultAdminEmails.map((e) => e.toLowerCase()), ...envAdmins])
);

export const extratorConfig = {
  url: typeof env.VITE_EXTRATOR_URL === 'string' ? env.VITE_EXTRATOR_URL.trim() : '',
  token: typeof env.VITE_EXTRATOR_TOKEN === 'string' ? env.VITE_EXTRATOR_TOKEN.trim() : '',
};

export const APP_CONFIG = {
  nome: 'Achadinhos do Deco',
  limitePadraoProdutos: 100,
  extratorTimeoutMs: 15000,
  whatsappGrupoUrl: 'https://chat.whatsapp.com/G425LTQIWHBJehmXHrBvWf',
} as const;
