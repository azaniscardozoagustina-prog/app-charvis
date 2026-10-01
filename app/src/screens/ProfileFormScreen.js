import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { EMPTY_PROFILE, validateProfile } from '../services/profile';
import { Button, Chips, Field, YesNo, styles } from '../components/ui';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', 'No sé'];
const VEHICLE_TYPES = ['Moto', 'Auto', 'Bicicleta', 'Otro'];

// Formulario obligatorio: se muestra al iniciar sesión hasta que esté completo.
// También se reutiliza para editar los datos (prop `onDone`).
export default function ProfileFormScreen({ onDone }) {
  const { profile, user, updateProfile, signOut } = useAuth();
  const [form, setForm] = useState(() => mergeProfile(profile));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const isEditing = Boolean(onDone);

  const set = (path, value) =>
    setForm((f) => {
      const [a, b] = path.split('.');
      return b ? { ...f, [a]: { ...f[a], [b]: value } } : { ...f, [a]: value };
    });

  const submit = async () => {
    const errs = validateProfile(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      Alert.alert('Faltan datos', 'Completá todos los campos marcados en rojo.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile(clean(form));
      onDone?.();
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los datos. Revisá tu conexión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{isEditing ? 'Editar mis datos' : 'Completá tu perfil'}</Text>
          <Text style={styles.subtitle}>
            {isEditing
              ? user?.email
              : 'Estos datos son obligatorios para usar la app. Sirven en caso de emergencia.'}
          </Text>

          <Text style={styles.section}>DATOS PERSONALES</Text>
          <Field label="Nombre y apellido *" value={form.fullName} onChangeText={(v) => set('fullName', v)} error={errors.fullName} />
          <Field label="DNI *" value={form.dni} onChangeText={(v) => set('dni', v)} keyboardType="number-pad" error={errors.dni} />
          <Field label="Teléfono *" value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" placeholder="+54 387 ..." error={errors.phone} />
          <Field label="Fecha de nacimiento *" value={form.birthDate} onChangeText={(v) => set('birthDate', formatDate(v))} keyboardType="number-pad" placeholder="DD/MM/AAAA" maxLength={10} error={errors.birthDate} />
          <Chips label="Grupo sanguíneo" options={BLOOD_TYPES} value={form.bloodType} onChange={(v) => set('bloodType', v)} />

          <Text style={styles.section}>VEHÍCULO</Text>
          <Chips label="Tipo" options={VEHICLE_TYPES} value={form.vehicle.type} onChange={(v) => set('vehicle.type', v)} />
          <Field label="Marca y modelo *" value={form.vehicle.brandModel} onChangeText={(v) => set('vehicle.brandModel', v)} error={errors.vehicleBrandModel} />
          <Field label="Patente *" value={form.vehicle.plate} onChangeText={(v) => set('vehicle.plate', v.toUpperCase())} autoCapitalize="characters" error={errors.vehiclePlate} />

          <Text style={styles.section}>SEGUROS</Text>
          <InsuranceBlock title="¿Tenés seguro de vida? *" value={form.lifeInsurance} set={(k, v) => set(`lifeInsurance.${k}`, v)} errors={errors} errKey="lifeInsurance" />
          <InsuranceBlock title="¿Tenés seguro del vehículo? *" value={form.vehicleInsurance} set={(k, v) => set(`vehicleInsurance.${k}`, v)} errors={errors} errKey="vehicleInsurance" />

          <Text style={styles.section}>CONTACTO DE EMERGENCIA</Text>
          <Field label="Nombre *" value={form.emergencyContact.name} onChangeText={(v) => set('emergencyContact.name', v)} error={errors.ecName} />
          <Field label="Vínculo *" value={form.emergencyContact.relationship} onChangeText={(v) => set('emergencyContact.relationship', v)} placeholder="Madre, pareja, amigo..." error={errors.ecRelationship} />
          <Field label="Teléfono *" value={form.emergencyContact.phone} onChangeText={(v) => set('emergencyContact.phone', v)} keyboardType="phone-pad" error={errors.ecPhone} />

          <Button title={isEditing ? 'Guardar cambios' : 'Guardar y continuar'} onPress={submit} loading={busy} style={{ marginTop: 10 }} />
          <Button
            title={isEditing ? 'Cancelar' : 'Cerrar sesión'}
            variant="secondary"
            onPress={isEditing ? onDone : signOut}
            style={{ marginTop: 12 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InsuranceBlock({ title, value, set, errors, errKey }) {
  return (
    <View>
      <YesNo label={title} value={value.has} onChange={(v) => set('has', v)} error={errors[errKey]} />
      {value.has && (
        <>
          <Field label="Aseguradora *" value={value.company} onChangeText={(v) => set('company', v)} error={errors[`${errKey}Company`]} />
          <Field label="N° de póliza" value={value.policy} onChangeText={(v) => set('policy', v)} />
        </>
      )}
    </View>
  );
}

function mergeProfile(p) {
  if (!p) return EMPTY_PROFILE;
  const out = { ...EMPTY_PROFILE };
  for (const k of Object.keys(EMPTY_PROFILE)) {
    const def = EMPTY_PROFILE[k];
    out[k] = def && typeof def === 'object' ? { ...def, ...(p[k] || {}) } : p[k] ?? def;
  }
  return out;
}

// Si no tiene seguro, no guardamos datos viejos de aseguradora.
function clean(f) {
  const strip = (ins) => (ins.has ? ins : { has: false, company: '', policy: '' });
  return { ...f, lifeInsurance: strip(f.lifeInsurance), vehicleInsurance: strip(f.vehicleInsurance) };
}

function formatDate(v) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
