/*
 * CHARVIS - Casco con sensor trasero
 * ESP32 DevKit (30 pines) + VL53L1X (ToF) + Bluetooth Low Energy
 *
 * Conexiones (cables Dupont hembra-hembra):
 *   VL53L1X VIN -> ESP32 3V3
 *   VL53L1X GND -> ESP32 GND
 *   VL53L1X SDA -> ESP32 GPIO 21 (D21)
 *   VL53L1X SCL -> ESP32 GPIO 22 (D22)
 *   XSHUT e INT quedan sin conectar.
 *
 * Bibliotecas (Arduino IDE > Gestor de bibliotecas):
 *   - "VL53L1X" de Pololu
 *   Placa: "ESP32 Dev Module" (paquete esp32 de Espressif). El BLE ya viene incluido.
 *
 * Funcionamiento:
 *   El sensor mide hacia atrás. Cada medición se envía por BLE a la app del
 *   teléfono como una notificación de 3 bytes:
 *     byte 0-1: distancia en milímetros (uint16, little-endian)
 *     byte 2  : estado (0 = libre, 1 = ALERTA < 2 m, 2 = sensor no detectado)
 *   Distancia 0 significa "nada dentro del alcance".
 *   La app es la que reproduce la voz en el parlante / auriculares Bluetooth.
 */

#include <Wire.h>
#include <VL53L1X.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------- Configuración ----------
#define DEVICE_NAME        "CHARVIS-CASCO"
#define SERVICE_UUID       "6e8a0001-4b1d-4c7a-9f2e-63a1c5d0b7e1"
#define DISTANCE_CHAR_UUID "6e8a0002-4b1d-4c7a-9f2e-63a1c5d0b7e1"

const int PIN_SDA = 21;
const int PIN_SCL = 22;
const int PIN_LED = 2;                 // LED azul integrado en la mayoría de los DevKit

const uint16_t ALERT_MM   = 2000;      // menos de 2 metros -> alerta
const uint16_t RELEASE_MM = 2200;      // histéresis para salir de la alerta
const uint8_t  CONFIRM_READINGS = 3;   // lecturas seguidas necesarias para cambiar de estado
const uint32_t NOTIFY_INTERVAL_MS = 200;

enum Status : uint8_t { STATUS_CLEAR = 0, STATUS_ALERT = 1, STATUS_NO_READING = 2 };

// ---------- Estado ----------
VL53L1X sensor;
BLECharacteristic *distanceChar = nullptr;
bool clientConnected = false;
bool sensorOk = false;

Status status = STATUS_CLEAR;
uint8_t nearCount = 0;
uint8_t farCount = 0;
uint16_t lastDistance = 0;
uint32_t lastNotify = 0;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    clientConnected = true;
    Serial.println("[BLE] Teléfono conectado");
  }
  void onDisconnect(BLEServer *server) override {
    clientConnected = false;
    Serial.println("[BLE] Teléfono desconectado, volviendo a anunciar");
    delay(200);
    BLEDevice::startAdvertising();
  }
};

void setupBle() {
  BLEDevice::init(DEVICE_NAME);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *service = server->createService(SERVICE_UUID);
  distanceChar = service->createCharacteristic(
      DISTANCE_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  distanceChar->addDescriptor(new BLE2902());
  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Anunciando como " DEVICE_NAME);
}

bool setupSensor() {
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);
  sensor.setTimeout(500);
  if (!sensor.init()) {
    Serial.println("[VL53L1X] No se detecta el sensor. Revisá VIN, GND, SDA y SCL.");
    return false;
  }
  sensor.setDistanceMode(VL53L1X::Long);   // hasta ~4 m en interiores
  sensor.setMeasurementTimingBudget(50000);
  sensor.startContinuous(50);
  Serial.println("[VL53L1X] Sensor listo");
  return true;
}

// Actualiza el estado con histéresis para evitar falsas alarmas.
// Una lectura no válida significa que no hay nada dentro del alcance del
// sensor (camino libre), así que cuenta como "lejos".
void updateStatus(bool valid, uint16_t mm) {
  if (valid && mm < ALERT_MM) {
    farCount = 0;
    if (nearCount < 255) nearCount++;
    if (nearCount >= CONFIRM_READINGS) status = STATUS_ALERT;
  } else if (!valid || mm > RELEASE_MM || status != STATUS_ALERT) {
    nearCount = 0;
    if (farCount < 255) farCount++;
    if (status != STATUS_ALERT || farCount >= CONFIRM_READINGS) status = STATUS_CLEAR;
  }
}

void notifyPhone(bool force) {
  uint32_t now = millis();
  if (!clientConnected || (!force && now - lastNotify < NOTIFY_INTERVAL_MS)) return;
  lastNotify = now;
  uint8_t payload[3] = {
      (uint8_t)(lastDistance & 0xFF),
      (uint8_t)(lastDistance >> 8),
      (uint8_t)status};
  distanceChar->setValue(payload, sizeof(payload));
  distanceChar->notify();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  setupBle();
  sensorOk = setupSensor();
}

void loop() {
  if (!sensorOk) {
    // Reintenta cada 2 segundos y avisa a la app que el sensor falla.
    status = STATUS_NO_READING;
    lastDistance = 0;
    notifyPhone(true);
    digitalWrite(PIN_LED, !digitalRead(PIN_LED));
    delay(2000);
    sensorOk = setupSensor();
    return;
  }

  if (sensor.dataReady()) {
    sensor.read(false);
    bool valid = !sensor.timeoutOccurred() &&
                 sensor.ranging_data.range_status == VL53L1X::RangeValid;
    uint16_t mm = sensor.ranging_data.range_mm;
    lastDistance = valid ? mm : 0;

    Status previous = status;
    updateStatus(valid, mm);
    digitalWrite(PIN_LED, status == STATUS_ALERT ? HIGH : LOW);

    // Un cambio de estado se envía de inmediato; el resto, cada 200 ms.
    notifyPhone(status != previous);

    if (status != previous) {
      Serial.printf("[Estado] %s (%u mm)\n",
                    status == STATUS_ALERT ? "ALERTA" :
                    status == STATUS_CLEAR ? "libre" : "sin lectura", mm);
    }
  }
  delay(5);
}
