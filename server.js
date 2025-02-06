const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para capturar datos sin procesar y parsear JSON y formularios URL-encoded
app.use(express.raw({ type: '*/*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Creamos un router para agrupar las rutas relacionadas con los dispositivos biométricos.
// Con "mergeParams: true" permitimos que los parámetros definidos en la ruta padre (por ejemplo, :id)
// estén disponibles dentro de este router.
const biometricosRouter = express.Router({ mergeParams: true });

/*
  Rutas disponibles dentro del router:
  
  1. Ruta raíz del dispositivo:
     GET /biometricos/:id
     Muestra un mensaje de bienvenida con el ID del dispositivo.
     
  2. Inicialización del dispositivo:
     GET /biometricos/:id/iclock/cdata
     Lee el parámetro de consulta (query) "SN" y muestra el serial recibido, entre otros datos.
  
  3. Recepción de datos de asistencia (POST):
     POST /biometricos/:id/iclock/cdata
     
  4. Recepción de datos en bruto (POST):
     POST /biometricos/:id/iclock/data/upload
     
  5. Autenticación:
     GET /biometricos/:id/iclock/accounts/login/
*/

// Ruta principal del dispositivo (por ejemplo, /biometricos/41038)
biometricosRouter.get('/', (req, res) => {
  const deviceId = req.params.id; // Captura el ID desde la URL
  res.status(200).send(`Bienvenido al dispositivo con ID: ${deviceId}`);
});

// Ruta de inicialización del dispositivo (GET)
biometricosRouter.get('/iclock/cdata', (req, res) => {
  const deviceId = req.params.id; // Ejemplo: 41038
  const serialNumber = req.query.SN || "Unknown"; // Lee el parámetro de consulta SN
  console.log(`🔄 Inicialización del dispositivo ${deviceId} - Serial: ${serialNumber}`);
  console.log("🔍 Parámetros recibidos:", req.query);

  res.status(200).send(
    `GET OPTION FROM: ${serialNumber}\n` +
    `ATTLOGStamp=None\n` +
    `OPERLOGStamp=9999\n` +
    `ATTPHOTOStamp=None\n` +
    `ErrorDelay=30\n` +
    `Delay=10\n` +
    `TransTimes=00:00;14:05\n` +
    `TransInterval=1\n` +
    `TransFlag=TransData AttLog OpLog AttPhoto EnrollUser ChgUser EnrollFP ChgFP UserPic\n` +
    `TimeZone=0\n` +
    `Realtime=1\n` +
    `Encrypt=None\n`
  );
});

// Ruta POST para recibir datos de asistencia (por ejemplo, datos procesados)
biometricosRouter.post('/iclock/cdata', (req, res) => {
  const deviceId = req.params.id;
  console.log(`📡 Recibido desde dispositivo ${deviceId} - Datos de asistencia:`);
  // Aquí mostramos los datos recibidos (convertidos a UTF-8)
  console.log(req.body.toString('utf8'));

  res.status(200).send("OK");
});

// Ruta POST para recibir datos en bruto (upload)
biometricosRouter.post('/iclock/data/upload', (req, res) => {
  const deviceId = req.params.id;
  console.log(`📡 Recibido desde dispositivo ${deviceId} - Datos en bruto:`);
  console.log(req.body.toString('utf8'));

  res.status(200).send("OK");
});

// Ruta de autenticación (login)
biometricosRouter.get('/iclock/accounts/login/', (req, res) => {
  const deviceId = req.params.id;
  console.log(`📡 Dispositivo ${deviceId} intentando iniciar sesión:`, req.query);
  res.status(200).send("OK");
});

// Montamos el router usando el prefijo /biometricos/:id.
// Esto significa que todas las rutas definidas en el router estarán anidadas bajo esta ruta.
app.use('/biometricos/:id', biometricosRouter);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en https://dedo-scanner.onrender.com`);
});
