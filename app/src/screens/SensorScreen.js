import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { useHelmetSensor, SensorStatus } from '../services/useHelmetSensor';
import { ALERT_PHRASE, getSelectedVoice, initVoice, speakAlert } from '../services/voice';
import { Button, Card, Chips, InfoRow, colors, styles } from '../components/ui';

const CONNECTION_LABEL = {
  disconnected: 'Desconectado',
  scanning: 'Buscando casco…',
  connecting: 'Conectando…',
  connected: 'Conectado',
};

// Por dónde se escucha el aviso: el parlante del casco (DFPlayer) o el celular.
const OUTPUT_KEY = 'charvis.voiceOutput';
const OUTPUT_LABEL = { casco: 'Parlante del casco', celular: 'Celular' };
const ALERT_COUNT_INTERVAL_MS = 4000;

export default function SensorScreen({ profile }) {
  const [voice, setVoice] = useState(null);
  const [alertCount, setAlertCount] = useState(0);
  const [output, setOutput] = useState('casco');
  const [testMsg, setTestMsg] = useState(null);
  const outputRef = useRef(output);
  outputRef.current = output;
  const lastAlertRef = useRef(0);

  const { connection, reading, error, connect, disconnect, sendCommand } = useHelmetSensor({
    onAlert: () => {
      if (outputRef.current === 'celular') {
        if (speakAlert()) setAlertCount((n) => n + 1);
        return;
      }
      // El casco reproduce el aviso por su parlante; acá solo se cuenta.
      const now = Date.now();
      if (now - lastAlertRef.current >= ALERT_COUNT_INTERVAL_MS) {
        lastAlertRef.current = now;
        setAlertCount((n) => n + 1);
      }
    },
  });
  const connected = connection === 'connected';

  useEffect(() => {
    AsyncStorage.getItem(OUTPUT_KEY)
      .then((v) => v && setOutput(v))
      .catch(() => {});
  }, []);

  // Le avisa al casco si tiene que sonar o no, para que no hablen los dos.
  useEffect(() => {
    if (connected) sendCommand(output === 'casco' ? 'sonido on' : 'sonido off');
  }, [connected, output, sendCommand]);

  const changeOutput = (v) => {
    const value = v === OUTPUT_LABEL.casco ? 'casco' : 'celular';
    setOutput(value);
    setTestMsg(null);
    AsyncStorage.setItem(OUTPUT_KEY, value).catch(() => {});
  };

  const testVoice = async () => {
    setTestMsg(null);
    if (output === 'casco' && connected) {
      const ok = await sendCommand('play');
      setTestMsg(ok ? 'Sonando en el parlante del casco.' : 'No se pudo enviar al casco.');
      return;
    }
    if (output === 'casco') setTestMsg('El casco no está conectado: se reproduce en el celular.');
    speakAlert({ force: true });
  };

  // Mantiene la pantalla encendida mientras se maneja, para que la app
  // siga recibiendo datos del casco y pueda hablar.
  useKeepAwake();

  useEffect(() => {
    initVoice().then(setVoice);
  }, []);

  const isAlert = reading?.status === SensorStatus.ALERT;
  const sensorError = reading?.status === SensorStatus.SENSOR_ERROR;

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
        <Chips
          label="Se escucha por"
          options={[OUTPUT_LABEL.casco, OUTPUT_LABEL.celular]}
          value={OUTPUT_LABEL[output]}
          onChange={changeOutput}
        />
        {output === 'celular' ? (
          <>
            <InfoRow label="Voz" value={voice ? `${voice.name} (${voice.language})` : 'Voz del sistema'} />
            <InfoRow label="Calidad" value={voice?.quality === 'Enhanced' ? 'Neuronal (alta)' : 'Estándar'} />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
              El audio sale por el celular o por el dispositivo Bluetooth vinculado al teléfono.
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            El casco reproduce el aviso grabado en su tarjeta SD por su propio parlante.
          </Text>
        )}
        {testMsg ? <Text style={{ color: colors.primary, fontSize: 12, marginTop: 8 }}>{testMsg}</Text> : null}
        <Button title="Probar voz" variant="secondary" onPress={testVoice} style={{ marginTop: 12 }} />
      </Card>
    </ScrollView>
  );
}
