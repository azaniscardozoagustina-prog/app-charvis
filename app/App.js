import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { isFirebaseConfigured } from './src/services/firebase';
import AuthScreen from './src/screens/AuthScreen';
import ProfileFormScreen from './src/screens/ProfileFormScreen';
import SensorScreen from './src/screens/SensorScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { Button, colors, styles } from './src/components/ui';

export default function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      {/* En la computadora se muestra centrada, con ancho de celular. */}
      <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' } : { flex: 1 }}>
        {isFirebaseConfigured ? (
          <AuthProvider>
            <Root />
          </AuthProvider>
        ) : (
          <Message text="Falta configurar Firebase. Copiá .env.example a .env, completá las claves y reiniciá la app (ver README)." />
        )}
      </View>
    </SafeAreaProvider>
  );
}

function Root() {
  const { user, profile, loading, error, signOut } = useAuth();

  if (loading) return <Message loading />;
  if (!user) return <AuthScreen />;
  if (error) return <Message text={error} action={<Button title="Cerrar sesión" variant="secondary" onPress={signOut} />} />;
  // El formulario es obligatorio: sin perfil completo no se accede a la app.
  if (!profile?.completed) return <ProfileFormScreen />;
  return <Main profile={profile} />;
}

function Main({ profile }) {
  const [tab, setTab] = useState('sensor');
  const [editing, setEditing] = useState(false);

  // El sensor queda montado (oculto) al cambiar de pestaña o editar datos,
  // para no cortar la conexión con el casco.
  return (
    <View style={styles.screen}>
      {editing && <ProfileFormScreen onDone={() => setEditing(false)} />}
      <SafeAreaView style={[styles.screen, editing && { display: 'none' }]}>
        <View style={{ flex: 1, display: tab === 'sensor' ? 'flex' : 'none' }}>
          <SensorScreen profile={profile} />
        </View>
        {tab === 'profile' && <ProfileScreen onEdit={() => setEditing(true)} />}
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
          <Tab label="Casco" active={tab === 'sensor'} onPress={() => setTab('sensor')} />
          <Tab label="Mis datos" active={tab === 'profile'} onPress={() => setTab('profile')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, paddingVertical: 16, alignItems: 'center' }}>
      <Text style={{ color: active ? colors.primary : colors.muted, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function Message({ text, loading, action }) {
  return (
    <SafeAreaView style={[styles.screen, { justifyContent: 'center', padding: 24 }]}>
      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : null}
      {text ? <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center', marginBottom: 20 }}>{text}</Text> : null}
      {action}
    </SafeAreaView>
  );
}
