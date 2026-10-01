import { Alert, Platform } from 'react-native';

// Alert.alert no hace nada en el navegador, así que ahí usamos window.alert.
export function notify(title, message) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
