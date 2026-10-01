import { Linking, ScrollView, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button, Card, InfoRow, styles } from '../components/ui';

const insuranceText = (ins) => (ins?.has ? `Sí — ${ins.company}` : 'No');

export default function ProfileScreen({ onEdit }) {
  const { user, profile, signOut } = useAuth();
  const ec = profile.emergencyContact;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.title}>{profile.fullName}</Text>
      <Text style={styles.subtitle}>{user.email}</Text>

      <Card title="DATOS PERSONALES">
        <InfoRow label="DNI" value={profile.dni} />
        <InfoRow label="Teléfono" value={profile.phone} />
        <InfoRow label="Nacimiento" value={profile.birthDate} />
        <InfoRow label="Grupo sanguíneo" value={profile.bloodType} />
      </Card>

      <Card title="MOTO">
        <InfoRow label="Marca y modelo" value={profile.vehicle?.brandModel} />
        <InfoRow label="Patente" value={profile.vehicle?.plate} />
      </Card>

      <Card title="SEGUROS">
        <InfoRow label="Seguro de vida" value={insuranceText(profile.lifeInsurance)} />
        {profile.lifeInsurance?.policy ? <InfoRow label="Póliza (vida)" value={profile.lifeInsurance.policy} /> : null}
        <InfoRow label="Seguro de la moto" value={insuranceText(profile.vehicleInsurance)} />
        {profile.vehicleInsurance?.policy ? <InfoRow label="Póliza (moto)" value={profile.vehicleInsurance.policy} /> : null}
      </Card>

      <Card title="CONTACTO DE EMERGENCIA">
        <InfoRow label="Nombre" value={ec.name} />
        <InfoRow label="Vínculo" value={ec.relationship} />
        <InfoRow label="Teléfono" value={ec.phone} />
        <Button
          title={`Llamar a ${ec.name.split(' ')[0]}`}
          variant="danger"
          onPress={() => Linking.openURL(`tel:${ec.phone.replace(/[^\d+]/g, '')}`)}
          style={{ marginTop: 12 }}
        />
      </Card>

      <Button title="Editar mis datos" onPress={onEdit} />
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}
