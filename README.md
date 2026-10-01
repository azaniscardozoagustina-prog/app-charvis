# CHARVIS — Casco con sensor trasero y aviso por voz

Proyecto de la E.E.T. N° 3117 "Maestro Daniel Óscar Reyes" (Informática).

Un sensor de distancia VL53L1X colocado en la parte trasera del casco detecta vehículos.
El ESP32 envía las mediciones por Bluetooth al celular. Cuando hay un vehículo a menos
de 2 metros, la app dice por los auriculares o el parlante Bluetooth:

> **"No se dé vuelta: vehículo detectado a menos de 2 metros."**

```
 [VL53L1X] --I2C--> [ESP32] ~~BLE~~> [App en el celular] ~~Bluetooth audio~~> [Auriculares / parlante]
  sensor              casco            voz + cuenta + datos                      vinculados al teléfono
```

### ¿Por qué la voz sale del celular y no del ESP32?

El ESP32 usa **Bluetooth Low Energy (BLE)** para mandarle los datos al teléfono. Los auriculares
o el parlante se vinculan **al teléfono**, como cualquier auricular. Así el ESP32 no necesita
manejar audio (que sería mucho más complejo y gastaría más batería), la voz suena con buena
calidad y el usuario sigue escuchando música o llamadas por los mismos auriculares.

## Estructura

| Carpeta | Contenido |
|---|---|
| `firmware/charvis_casco/` | Programa del ESP32 (Arduino IDE) |
| `app/` | App de celular (React Native + Expo) para Android y iPhone |

---

## 1. Armado y firmware del ESP32

### Conexiones (4 cables Dupont hembra-hembra)

| VL53L1X | ESP32 DevKit | Color sugerido |
|---|---|---|
| VIN | 3V3 | rojo |
| GND | GND | negro |
| SDA | D21 (GPIO 21) | otro color |
| SCL | D22 (GPIO 22) | otro color |

XSHUT e INT no se conectan. El power bank alimenta el ESP32 por el cable USB.

### Cargar el programa

1. Instalar [Arduino IDE](https://www.arduino.cc/en/software).
2. En *Preferencias > URLs adicionales de gestor de placas* agregar:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. *Herramientas > Placa > Gestor de placas*: instalar **esp32** (de Espressif).
4. *Herramientas > Gestionar bibliotecas*: instalar **VL53L1X** (de **Pololu**).
5. Abrir `firmware/charvis_casco/charvis_casco.ino`, elegir la placa **ESP32 Dev Module**
   y el puerto USB, y presionar **Subir**.
   Si no sube, mantené apretado el botón **BOOT** del ESP32 cuando aparezca "Connecting...".
6. En el *Monitor serie* (115200 baudios) debe aparecer `[VL53L1X] Sensor listo` y
   `[BLE] Anunciando como CHARVIS-CASCO`. El LED azul se enciende cuando hay alerta.

### Montaje

- El sensor va en la **parte de atrás** del casco, mirando hacia atrás, con la ventanita
  del sensor libre (sin cinta ni velcro encima).
- El ESP32 y el power bank van dentro de la caja plástica, pegada con velcro.
- Aislá las conexiones con cinta o termorretráctil.

> **Importante:** el VL53L1X es un sensor láser pensado para interiores. A pleno sol su
> alcance baja bastante (puede quedar por debajo de 2 m). Es un **asistente**: no reemplaza
> mirar los espejos. Para un producto final conviene un radar (por ejemplo, de 24 GHz).

### Datos que envía por BLE

- Nombre: `CHARVIS-CASCO`
- Servicio: `6e8a0001-4b1d-4c7a-9f2e-63a1c5d0b7e1`
- Característica (notify): `6e8a0002-4b1d-4c7a-9f2e-63a1c5d0b7e1`, 3 bytes:
  distancia en mm (uint16, little-endian) + estado (`0` libre, `1` alerta, `2` sensor no detectado).

La alerta se activa con 3 lecturas seguidas por debajo de 2 m y se desactiva con 3 lecturas
por encima de 2,2 m, para evitar falsas alarmas.

---

## 2. App de celular

### Funciones

- **Cuenta con correo electrónico**: registro, inicio de sesión y recuperación de contraseña.
- **Formulario obligatorio** al iniciar sesión por primera vez (no se puede usar la app sin
  completarlo):
  - Datos personales: nombre, DNI, teléfono, fecha de nacimiento, grupo sanguíneo.
  - Vehículo: tipo, marca y modelo, patente.
  - **Seguro de vida**: sí/no (+ aseguradora y póliza).
  - **Seguro del vehículo**: sí/no (+ aseguradora y póliza).
  - **Contacto de emergencia**: nombre, vínculo y teléfono.
- Pestaña **Mis datos**: muestra todos los datos del usuario, botón para llamar al
  contacto de emergencia y opción de editar.
- Pestaña **Casco**: conecta con el ESP32, muestra la distancia en vivo y, ante una alerta,
  dice la frase por la salida de audio Bluetooth del teléfono (la repite cada 4 s mientras
  el vehículo siga cerca). Tiene un botón **Probar voz**.

### Voz con IA

La app usa el motor de voz del propio teléfono (`expo-speech`) y elige automáticamente la
mejor voz en español disponible, priorizando las **voces neuronales** ("Enhanced"), que son
voces generadas por IA y funcionan sin internet.
Para mejor resultado:

- **Android**: *Ajustes > Accesibilidad > Salida de texto a voz* → motor **Google**, idioma
  Español (Estados Unidos/España) y descargar la voz de alta calidad.
- **iPhone**: *Ajustes > Accesibilidad > Contenido leído > Voces > Español* → descargar
  una voz "Mejorada" o "Premium".

La pantalla del casco muestra qué voz se está usando y su calidad.

### Configurar Firebase (cuentas y datos)

Las cuentas y los perfiles se guardan en Firebase (gratis para este uso).

1. Entrar a <https://console.firebase.google.com> y crear un proyecto.
2. *Authentication > Comenzar > Correo electrónico/contraseña*: **habilitar**.
3. *Firestore Database > Crear base de datos* (modo producción). En la pestaña **Reglas**
   pegar el contenido de `app/firestore.rules` y publicar.
4. *Configuración del proyecto > Tus apps > Agregar app Web* (`</>`). Copiar los valores
   de `firebaseConfig`.
5. En la carpeta `app/`, copiar `.env.example` como `.env` y completar los valores.

### Ejecutar la app

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
cd app
npm install
```

El Bluetooth necesita código nativo, por lo que **no funciona en Expo Go**. Hay que generar
una app de desarrollo:

- **Android con cable USB** (necesita Android Studio instalado):
  ```bash
  npx expo run:android
  ```
- **Sin instalar Android Studio / Xcode**, compilando en la nube con EAS (cuenta gratuita en expo.dev):
  ```bash
  npx eas-cli@latest login
  npx eas-cli@latest build --profile development --platform android
  ```
  Instalar el `.apk` que genera y luego ejecutar `npx expo start`.
  Para un `.apk` que funcione solo, sin la computadora: `--profile preview`.
- **iPhone**: `npx expo run:ios` (requiere una Mac con Xcode) o EAS con `--platform ios`.

### Uso

1. Encender el casco (conectar el power bank).
2. Vincular los auriculares o el parlante Bluetooth **al teléfono** desde los ajustes del celular.
3. Abrir la app, iniciar sesión y en la pestaña **Casco** tocar **Conectar casco**.
4. Tocar **Probar voz** para verificar que se escucha por los auriculares.
5. La pantalla queda encendida mientras se usa, para que la app siga recibiendo datos.

### Estructura de la app

```
app/
├── App.js                       Navegación: login → formulario obligatorio → app
├── firestore.rules              Reglas de seguridad de la base de datos
├── .env.example                 Claves de Firebase (copiar a .env)
└── src/
    ├── components/ui.js         Componentes visuales y colores
    ├── context/AuthContext.js   Sesión del usuario y perfil
    ├── services/
    │   ├── firebase.js          Conexión a Firebase
    │   ├── profile.js           Guardar/leer/validar el formulario
    │   ├── useHelmetSensor.js   Conexión BLE con el ESP32
    │   └── voice.js             Voz de alerta
    └── screens/
        ├── AuthScreen.js        Ingreso / registro con correo
        ├── ProfileFormScreen.js Formulario obligatorio (y edición)
        ├── SensorScreen.js      Distancia en vivo y alertas
        └── ProfileScreen.js     Datos del usuario
```
