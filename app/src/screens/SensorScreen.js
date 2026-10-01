import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useHelmetSensor, SensorStatus } from '../services/useHelmetSensor';
import { ALERT_PHRASE, getSelectedVoice, initVoice, speakAlert } from '../services/voice';
import { Button, Card, InfoRow, colors, styles } from '../components/ui';

const CONNECTION_LABEL = {
  disconnected: 'Desconectado',
  scanning: 'Buscando casco…',
  connecting: 'Conectando…',
  connected: 'Conectado',
};

export default function SensorScreen({ profile }) {
  const [voice, setVoice] = useState(null);
  const [alertCount, setAlertCount] = useState(0);
  const { connection, reading, error, connect, disconnect } = useHelmetSensor({
    onAlert: () => {
      if (speakAlert()) setAlertCount((n) => n + 1);
    },
  });

  // Mantiene la pantalla encendida mientras se maneja, para que la app
  // siga recibiendo datos del casco y pueda hablar.
  useKeepAwake();

  useEffect(() => {
    initVoice().then(setVoice);
  }, []);

  const isAlert = reading?.status === SensorStatus.ALERT;
  const sensorError = reading?.status === SensorStatus.SENSOR_ERROR;
  const connected = connection === 'connected';

  const distanceText = !connected
    ? '—'
    : sensorError
      ? 'Error'
      : reading?.distanceMm
        ? `${(reading.distanceMm / 1000).toFixed(2)} m`
        : 'Libre';

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.title}>Hola, {profile.fullName.split(' ')[0]}</Text>
      <Text style={styles.subtitle}>Conectá el casco y emparejá tus auriculares o parlante al teléfono.</Text>

      <View
        style={{
          borderRadius: 20,
          padding: 28,
          alignItems: 'center',
          marginBottom: 16,
          backgroundColor: isAlert ? colors.danger : colors.card,
          borderWidth: 1,
          borderColor: isAlert ? colors.danger : colors.border,
        }}
      >
        <Text style={{ color: isAlert ? '#fff' : colors.muted, fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>
          {isAlert ? '¡VEHÍCULO DETRÁS!' : 'DISTANCIA TRASERA'}
        </Text>
        <Text style={{ color: isAlert ? '#fff' : colors.text, fontSize: 56, fontWeight: '800', marginVertical: 6 }}>
          {distanceText}
        </Text>
        <Text style={{ color: isAlert ? '#fff' : colors.muted, fontSize: 13, textAlign: 'center' }}>
          {isAlert
            ? ALERT_PHRASE
            : sensorError
              ? 'El casco no detecta el sensor VL53L1X. Revisá los cables.'
              : 'Aviso por voz si un vehículo se acerca a menos de 2 m.'}
        </Text>
      </View>

      <Card title="CASCO">
        <InfoRow label="Estado" value={CONNECTION_LABEL[connection]} />
        <InfoRow label="Avisos en esta sesión" value={String(alertCount)} />
        {error ? <Text style={[styles.error, { marginTop: 6, fontSize: 13 }]}>{error}</Text> : null}
        <Button
          title={connected ? 'Desconectar' : 'Conectar casco'}
          variant={connected ? 'secondary' : 'primary'}
          loading={connection === 'scanning' || connection === 'connecting'}
          onPress={connected ? disconnect : connect}
          style={{ marginTop: 12 }}
        />
      </Card>

      <Card title="VOZ DE ALERTA">
        <InfoRow label="Voz" value={voice ? `${voice.name} (${voice.language})` : 'Voz del sistema'} />
        <InfoRow label="Calidad" value={voice?.quality === 'Enhanced' ? 'Neuronal (alta)' : 'Estándar'} />
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
          El audio sale por el dispositivo Bluetooth vinculado al teléfono (auriculares o parlante).
        </Text>
        <Button title="Probar voz" variant="secondary" onPress={() => speakAlert({ force: true })} style={{ marginTop: 12 }} />
      </Card>
    </ScrollView>
  );
}
