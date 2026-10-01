import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuración de la app web "charvis web" del proyecto de Firebase.
// Estos valores no son secretos: van dentro de cualquier app que use Firebase;
// los datos se protegen con las reglas de firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyDb9uLh9t_ISY0TVx-2oP5B7V4U4JeBgGc',
  authDomain: 'charvis-4f961.firebaseapp.com',
  projectId: 'charvis-4f961',
  storageBucket: 'charvis-4f961.firebasestorage.app',
  messagingSenderId: '137829277986',
  appId: '1:137829277986:web:52b7fb8d4fa6a7e4e1457b',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

function createAuth(app) {
  // En el navegador Firebase ya guarda la sesión por su cuenta.
  if (Platform.OS === 'web') return getAuth(app);
  try {
    // Mantiene la sesión iniciada entre aperturas de la app.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Ya inicializado (recarga en caliente durante el desarrollo).
    return getAuth(app);
  }
}

const app = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

export const auth = app ? createAuth(app) : null;
export const db = app ? getFirestore(app) : null;
