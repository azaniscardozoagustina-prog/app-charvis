import { useState } from 'react';

// Versión para el navegador: el casco se conecta por Bluetooth, que solo está
// disponible en la app instalada en el celular. Se mantiene la misma interfaz
// que useHelmetSensor.js para que la pantalla funcione igual.
export const SensorStatus = { CLEAR: 0, ALERT: 1, SENSOR_ERROR: 2 };

export function useHelmetSensor() {
  const [error, setError] = useState(null);
  return {
    connection: 'disconnected',
    reading: null,
    error,
    connect: () => setError('La conexión con el casco solo funciona en la app instalada en un celular Android.'),
    disconnect: () => {},
  };
}
