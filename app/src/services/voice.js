import * as Speech from 'expo-speech';

export const ALERT_PHRASE = 'No se dé vuelta: vehículo detectado a menos de 2 metros.';

// Preferimos las voces neuronales ("Enhanced") del teléfono, en español
// rioplatense si existe, luego latinoamericano y por último cualquier español.
const LANGUAGE_PREFERENCE = ['es-AR', 'es-US', 'es-MX', 'es-419', 'es-ES', 'es'];

let selectedVoice = null;
let lastSpokenAt = 0;

export async function initVoice() {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const spanish = voices.filter((v) => v.language?.toLowerCase().startsWith('es'));
    const rank = (v) => {
      const lang = LANGUAGE_PREFERENCE.findIndex((l) => v.language.toLowerCase().startsWith(l.toLowerCase()));
      const quality = v.quality === Speech.VoiceQuality.Enhanced ? 0 : 100;
      return quality + (lang === -1 ? 50 : lang);
    };
    spanish.sort((a, b) => rank(a) - rank(b));
    selectedVoice = spanish[0] ?? null;
  } catch {
    selectedVoice = null;
  }
  return selectedVoice;
}

export function getSelectedVoice() {
  return selectedVoice;
}

/**
 * Reproduce el aviso por la salida de audio actual del teléfono (el parlante o
 * los auriculares Bluetooth vinculados). `minIntervalMs` evita que la voz se
 * repita sin parar mientras el vehículo sigue cerca.
 */
export function speakAlert({ minIntervalMs = 4000, force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastSpokenAt < minIntervalMs) return false;
  lastSpokenAt = now;
  Speech.stop();
  Speech.speak(ALERT_PHRASE, {
    language: selectedVoice?.language ?? 'es-AR',
    voice: selectedVoice?.identifier,
    rate: 1.05,
    pitch: 1.0,
  });
  return true;
}
