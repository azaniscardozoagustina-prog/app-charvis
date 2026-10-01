import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';

// Deben coincidir con firmware/charvis_casco/charvis_casco.ino
export const DEVICE_NAME = 'CHARVIS-CASCO';
export const SERVICE_UUID = '6e8a0001-4b1d-4c7a-9f2e-63a1c5d0b7e1';
export const DISTANCE_CHAR_UUID = '6e8a0002-4b1d-4c7a-9f2e-63a1c5d0b7e1';

export const SensorStatus = { CLEAR: 0, ALERT: 1, SENSOR_ERROR: 2 };

const SCAN_TIMEOUT_MS = 15000;

let manager = null;
function getManager() {
  if (!manager) manager = new BleManager();
  return manager;
}

async function requestAndroidPermissions() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return fine === PermissionsAndroid.RESULTS.GRANTED;
}

// Notificación de 3 bytes: distancia uint16 little-endian + estado.
function decodeReading(base64) {
  const bin = atob(base64);
  if (bin.length < 3) return null;
  return {
    distanceMm: bin.charCodeAt(0) | (bin.charCodeAt(1) << 8),
    status: bin.charCodeAt(2),
  };
}

/**
 * Busca el casco, se conecta y entrega las lecturas del sensor.
 * `onAlert` se llama cada vez que llega una lectura en estado ALERTA.
 */
export function useHelmetSensor({ onAlert } = {}) {
  const [connection, setConnection] = useState('disconnected'); // disconnected | scanning | connecting | connected
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);
  const deviceRef = useRef(null);
  const subsRef = useRef([]);
  const scanTimerRef = useRef(null);
  const wantConnectedRef = useRef(false);
  const startScanRef = useRef(null);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const clearSubs = () => {
    subsRef.current.forEach((s) => s?.remove());
    subsRef.current = [];
  };

  const stopScan = () => {
    clearTimeout(scanTimerRef.current);
    getManager().stopDeviceScan();
  };

  const subscribe = useCallback(async (device) => {
    setConnection('connecting');
    const connected = await device.connect({ timeout: 10000 });
    await connected.discoverAllServicesAndCharacteristics();
    deviceRef.current = connected;

    subsRef.current.push(
      connected.onDisconnected(() => {
        clearSubs();
        deviceRef.current = null;
        setConnection('disconnected');
        setReading(null);
        // Si se cortó sin que el usuario lo pidiera, se reintenta.
        if (wantConnectedRef.current) setTimeout(() => startScanRef.current?.(), 1500);
      })
    );

    subsRef.current.push(
      connected.monitorCharacteristicForService(SERVICE_UUID, DISTANCE_CHAR_UUID, (err, ch) => {
        if (err || !ch?.value) return;
        const r = decodeReading(ch.value);
        if (!r) return;
        setReading({ ...r, at: Date.now() });
        if (r.status === SensorStatus.ALERT) onAlertRef.current?.(r);
      })
    );
    setConnection('connected');
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    wantConnectedRef.current = true;
    if (!(await requestAndroidPermissions())) {
      setError('Sin permisos de Bluetooth. Activalos en Ajustes.');
      wantConnectedRef.current = false;
      return;
    }
    const bleState = await getManager().state();
    if (bleState !== State.PoweredOn) {
      setError('Encendé el Bluetooth del teléfono.');
      wantConnectedRef.current = false;
      return;
    }

    setConnection('scanning');
    stopScan();
    getManager().startDeviceScan([SERVICE_UUID], null, (err, device) => {
      if (err) {
        stopScan();
        setConnection('disconnected');
        setError('Error al buscar el casco: ' + err.message);
        return;
      }
      if (device && (device.name === DEVICE_NAME || device.localName === DEVICE_NAME || device.serviceUUIDs?.includes(SERVICE_UUID))) {
        stopScan();
        subscribe(device).catch((e) => {
          setConnection('disconnected');
          setError('No se pudo conectar: ' + e.message);
        });
      }
    });
    scanTimerRef.current = setTimeout(() => {
      getManager().stopDeviceScan();
      setConnection((c) => (c === 'scanning' ? 'disconnected' : c));
      setError((e) => e ?? 'No se encontró el casco. ¿Está encendido y cerca?');
    }, SCAN_TIMEOUT_MS);
  }, [subscribe]);
  startScanRef.current = startScan;

  const disconnect = useCallback(async () => {
    wantConnectedRef.current = false;
    stopScan();
    clearSubs();
    const d = deviceRef.current;
    deviceRef.current = null;
    setConnection('disconnected');
    setReading(null);
    if (d) await d.cancelConnection().catch(() => {});
  }, []);

  useEffect(() => () => {
    wantConnectedRef.current = false;
    stopScan();
    clearSubs();
    deviceRef.current?.cancelConnection().catch(() => {});
  }, []);

  return { connection, reading, error, connect: startScan, disconnect };
}
