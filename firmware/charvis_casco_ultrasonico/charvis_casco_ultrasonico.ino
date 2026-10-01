/*
 * CHARVIS - Casco de moto con sensor trasero (versión ultrasónico + OLED + DFPlayer)
 * Placa: ESP32 DevKit 38 pines
 *
 * Hardware:
 *   Sensor ultrasónico  TRIG -> GPIO 5   ECHO -> GPIO 18
 *   Pantalla OLED SSD1306 (I2C 0x3C)  SDA -> GPIO 21  SCL -> GPIO 22
 *   DFPlayer Mini  RX del ESP32 -> GPIO 27   TX del ESP32 -> GPIO 26  (+ parlante)
 *
 * Se comunica con la app CHARVIS por Bluetooth de bajo consumo (BLE).
 * Cada 200 ms envía 3 bytes:
 *   byte 0-1: distancia en milímetros (uint16, little-endian; 0 = sin eco)
 *   byte 2  : estado (0 = libre, 1 = ALERTA)
 * La app dice "No se dé vuelta: vehículo detectado a menos de 2 metros."
 * y el DFPlayer también reproduce su pista por el parlante del casco.
 *
 * Comandos (por el Monitor serie a 115200, o escribiendo en la característica
 * de comandos por BLE): sonido on | sonido off | vol 0-30 | dist 5-400 |
 * pista N | play | estado | ayuda
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DFRobotDFPlayerMini.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define TRIG_PIN 5
#define ECHO_PIN 18
#define MP3_RX   27
#define MP3_TX   26

// Deben coincidir con la app (src/services/useHelmetSensor.js). No cambiar.
#define DEVICE_NAME        "CHARVIS-CASCO"
#define SERVICE_UUID       "6e8a0001-4b1d-4c7a-9f2e-63a1c5d0b7e1"
#define DISTANCE_CHAR_UUID "6e8a0002-4b1d-4c7a-9f2e-63a1c5d0b7e1"
#define COMMAND_CHAR_UUID  "6e8a0003-4b1d-4c7a-9f2e-63a1c5d0b7e1"

const unsigned long ESPERA_SONIDO = 5000;
const unsigned long RETENER_MS = 3000;   // tiempo que se mantiene el último valor en pantalla
const unsigned long ENVIO_BLE_MS = 200;  // cada cuánto se manda la distancia al celular
const uint8_t LECTURAS_CONFIRMAR = 3;    // lecturas seguidas para activar/desactivar la alerta

// Valores que se pueden cambiar con comandos
float distanciaAlerta = 200.0;           // 2 metros, igual que el aviso de la app
int volumen = 25;                        // 0 a 30
int pista = 1;                           // número de archivo en la SD
bool sonidoActivo = true;

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
HardwareSerial mp3Serial(2);
DFRobotDFPlayerMini mp3;

BLECharacteristic *distanciaChar = nullptr;
bool clienteConectado = false;

bool oledOK = false;
bool mp3OK = false;
bool alerta = false;
uint8_t cercaSeguidas = 0;
uint8_t lejosSeguidas = 0;
unsigned long ultimoSonido = 0;
unsigned long ultimoEnvioBLE = 0;

float ultimoValido = -1;
unsigned long tUltimoValido = 0;

String bufferSerial = "";
String comandoPendiente = "";            // comando recibido por BLE, se procesa en loop()

// ---------- Respuestas: van al Monitor serie ----------
void responder(const String &texto) {
  Serial.println(texto);
}

// ---------- Bluetooth BLE ----------
class ServidorCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *s) override {
    clienteConectado = true;
    Serial.println("[BLE] Celular conectado");
  }
  void onDisconnect(BLEServer *s) override {
    clienteConectado = false;
    Serial.println("[BLE] Celular desconectado, volviendo a anunciar");
    delay(200);
    BLEDevice::startAdvertising();
  }
};

class ComandoCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    comandoPendiente = String(c->getValue().c_str());
  }
};

void iniciarBLE() {
  BLEDevice::init(DEVICE_NAME);
  BLEServer *servidor = BLEDevice::createServer();
  servidor->setCallbacks(new ServidorCallbacks());

  BLEService *servicio = servidor->createService(SERVICE_UUID);

  distanciaChar = servicio->createCharacteristic(
      DISTANCE_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  distanciaChar->addDescriptor(new BLE2902());

  BLECharacteristic *comandoChar = servicio->createCharacteristic(
      COMMAND_CHAR_UUID,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  comandoChar->setCallbacks(new ComandoCallbacks());

  servicio->start();

  BLEAdvertising *anuncio = BLEDevice::getAdvertising();
  anuncio->addServiceUUID(SERVICE_UUID);
  anuncio->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Anunciando como " DEVICE_NAME);
}

void enviarAlCelular(float cm) {
  if (!clienteConectado) return;
  uint16_t mm = cm > 0 ? (uint16_t)min(cm * 10.0f, 65535.0f) : 0;
  uint8_t datos[3] = {(uint8_t)(mm & 0xFF), (uint8_t)(mm >> 8), (uint8_t)(alerta ? 1 : 0)};
  distanciaChar->setValue(datos, sizeof(datos));
  distanciaChar->notify();
}

// ---------- Sensor ----------
float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long t = pulseIn(ECHO_PIN, HIGH, 30000);
  if (t == 0) return -1;
  return t * 0.0343 / 2;
}

// Alerta con confirmación para evitar falsas alarmas por lecturas sueltas.
void actualizarAlerta(float cm) {
  bool cerca = cm > 0 && cm < distanciaAlerta;
  if (cerca) {
    lejosSeguidas = 0;
    if (cercaSeguidas < 255) cercaSeguidas++;
    if (cercaSeguidas >= LECTURAS_CONFIRMAR) alerta = true;
  } else {
    cercaSeguidas = 0;
    if (lejosSeguidas < 255) lejosSeguidas++;
    if (lejosSeguidas >= LECTURAS_CONFIRMAR) alerta = false;
  }
}

// ---------- Pantalla ----------
void mostrar(float cm, bool retenido) {
  if (!oledOK) return;
  oled.clearDisplay();
  oled.setTextColor(WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print("CHARVIS ");
  oled.print(clienteConectado ? "[APP OK]" : "[sin app]");
  oled.setTextSize(2);
  oled.setCursor(0, 22);
  if (cm < 0) {
    oled.print("Sin eco");
  } else {
    oled.print(cm, 1);
    oled.print(" cm");
  }
  oled.setTextSize(1);
  oled.setCursor(0, 55);
  if (alerta) oled.print("!! VEHICULO CERCA !!");
  else if (retenido) oled.print("(ultima lectura)");
  oled.display();
}

// ---------- Comandos ----------
void mostrarEstado() {
  responder(String("Sonido: ") + (sonidoActivo ? "ON" : "OFF"));
  responder(String("Volumen: ") + volumen);
  responder(String("Distancia de alerta: ") + (int)distanciaAlerta + " cm");
  responder(String("Pista: ") + pista);
  responder(String("DFPlayer: ") + (mp3OK ? "OK" : "NO detectado"));
  responder(String("App conectada: ") + (clienteConectado ? "SI" : "NO"));
}

void procesarComando(String c) {
  c.trim();
  c.toLowerCase();
  if (c.length() == 0) return;

  if (c == "sonido on") {
    sonidoActivo = true;
    responder("Sonido activado");
  } else if (c == "sonido off") {
    sonidoActivo = false;
    responder("Sonido desactivado");
  } else if (c.startsWith("vol ")) {
    volumen = constrain(c.substring(4).toInt(), 0, 30);
    if (mp3OK) mp3.volume(volumen);
    responder(String("Volumen: ") + volumen);
  } else if (c.startsWith("dist ")) {
    distanciaAlerta = constrain(c.substring(5).toInt(), 5, 400);
    responder(String("Distancia de alerta: ") + (int)distanciaAlerta + " cm");
  } else if (c.startsWith("pista ")) {
    pista = max(1, (int)c.substring(6).toInt());
    responder(String("Pista: ") + pista);
  } else if (c == "play") {
    if (mp3OK) {
      mp3.play(pista);
      responder("Reproduciendo");
    } else {
      responder("DFPlayer no detectado");
    }
  } else if (c == "estado") {
    mostrarEstado();
  } else if (c == "ayuda") {
    responder("Comandos: sonido on | sonido off | vol 0-30 | dist 5-400 | pista N | play | estado");
  } else {
    responder("Comando no reconocido. Escribi: ayuda");
  }
}

void leerSerial() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      procesarComando(bufferSerial);
      bufferSerial = "";
    } else if (bufferSerial.length() < 40) {
      bufferSerial += ch;
    }
  }
  if (comandoPendiente.length()) {
    String c = comandoPendiente;
    comandoPendiente = "";
    procesarComando(c);
  }
}

// ---------- Programa principal ----------
void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  oledOK = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (!oledOK) Serial.println("OLED no encontrada");

  iniciarBLE();

  mp3Serial.begin(9600, SERIAL_8N1, MP3_RX, MP3_TX);
  delay(1000);
  Serial.println("Iniciando DFPlayer...");
  mp3OK = mp3.begin(mp3Serial, true, true);
  if (!mp3OK) {
    Serial.println("DFPlayer NO detectado (revisa TX/RX y la SD en FAT32)");
  } else {
    Serial.println("DFPlayer OK");
    mp3.volume(volumen);
  }
}

void loop() {
  leerSerial();

  float cm = medirDistancia();
  unsigned long ahora = millis();

  if (cm > 0) {
    ultimoValido = cm;
    tUltimoValido = ahora;
  }
  actualizarAlerta(cm);

  if (cm > 0) mostrar(cm, false);
  else if (ultimoValido > 0 && ahora - tUltimoValido < RETENER_MS) mostrar(ultimoValido, true);
  else mostrar(-1, false);

  if (cm > 0) Serial.println(cm);

  if (ahora - ultimoEnvioBLE >= ENVIO_BLE_MS) {
    enviarAlCelular(cm);
    ultimoEnvioBLE = ahora;
  }

  if (sonidoActivo && mp3OK && alerta && ahora - ultimoSonido > ESPERA_SONIDO) {
    mp3.play(pista);
    ultimoSonido = ahora;
  }
  delay(100);
}
