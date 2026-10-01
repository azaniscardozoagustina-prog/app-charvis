import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { loadProfile, saveProfile } from '../services/profile';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setError(null);
      setUser(u);
      try {
        setProfile(u ? await loadProfile(u.uid) : null);
      } catch (e) {
        setError('No se pudo cargar tu perfil. Revisá tu conexión.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = {
    user,
    profile,
    loading,
    error,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    signUp: (email, password) => createUserWithEmailAndPassword(auth, email.trim(), password),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
    signOut: () => signOut(auth),
    updateProfile: async (data) => {
      const saved = await saveProfile(user.uid, user.email, data);
      setProfile(saved);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function authErrorMessage(e) {
  switch (e?.code) {
    case 'auth/invalid-email':
      return 'El correo no es válido.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese correo.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Sin conexión a internet.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Probá de nuevo en unos minutos.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'El inicio con correo no está habilitado en Firebase (Authentication > Método de acceso).';
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-api-key':
      return 'La API_KEY del archivo .env es incorrecta.';
    default:
      // Mostramos el código para poder diagnosticar el problema.
      return `Ocurrió un error (${e?.code || e?.message || 'desconocido'}). Intentá de nuevo.`;
  }
}
