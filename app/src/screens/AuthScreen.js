import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notify } from '../components/notify';
import { authErrorMessage, useAuth } from '../context/AuthContext';
import { Button, Field, colors, styles } from '../components/ui';

export default function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Ingresá un correo electrónico válido.');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (isRegister && password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      await (isRegister ? signUp(email, password) : signIn(email, password));
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribí tu correo para recuperar la contraseña.');
    try {
      await resetPassword(email);
      notify('Correo enviado', 'Revisá tu bandeja de entrada para crear una nueva contraseña.');
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { fontSize: 34, color: colors.primary }]}>CHARVIS</Text>
          <Text style={styles.subtitle}>
            {isRegister ? 'Creá tu cuenta con tu correo electrónico' : 'Iniciá sesión para conectar tu casco'}
          </Text>

          <Field
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            autoComplete={isRegister ? 'new-password' : 'password'}
          />
          {isRegister && (
            <Field label="Repetí la contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry />
          )}

          {error ? <Text style={[styles.error, { marginBottom: 12, fontSize: 14 }]}>{error}</Text> : null}

          <Button title={isRegister ? 'Crear cuenta' : 'Ingresar'} onPress={submit} loading={busy} />

          {!isRegister && (
            <Pressable onPress={forgot} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.muted }}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              setMode(isRegister ? 'login' : 'register');
              setError(null);
            }}
            style={{ marginTop: 24, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text }}>
              {isRegister ? '¿Ya tenés cuenta? ' : '¿No tenés cuenta? '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{isRegister ? 'Ingresá' : 'Registrate'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
