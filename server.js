const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para capturar datos sin procesar
app.use(express.raw({ type: '*/*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Creamos un router y le indicamos que se fusionen los parámetros de la ruta padre
const biometricosRouter = express.Router({ mergeParams: true });

// Ruta principal para el dispositivo
biometricosRouter.get('/', (req, res) => {
    const deviceId = req.params.id;
    res.status(200).send(`Bienvenido al dispositivo con ID: ${deviceId}`);
});

// Ruta de inicialización del dispositivo
biometricosRouter.get('/iclock/cdata', (req, res) => {
    const deviceId = req.params.id; // Ejemplo: 41038
    const serialNumber = req.query.SN || "Unknown";
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

// Ruta POST para recibir datos de asistencia
biometricosRouter.post('/iclock/cdata', (req, res) => {
    const deviceId = req.params.id;
    console.log(`📡 Recibido desde dispositivo ${deviceId} - Datos de asistencia:`);
    console.log(req.body.toString('utf8'));  // Mostrar datos exactos que llegan

    res.status(200).send("OK");
});

// Ruta para recibir datos en bruto de asistencia
biometricosRouter.post('/iclock/data/upload', (req, res) => {
    const deviceId = req.params.id;
    console.log(`📡 Recibido desde dispositivo ${deviceId} - Datos en bruto:`);
    console.log(req.body.toString('utf8'));
    
    res.status(200).send("OK");
});

// Ruta de autenticación
biometricosRouter.get('/iclock/accounts/login/', (req, res) => {
    const deviceId = req.params.id;
    console.log(`📡 Dispositivo ${deviceId} intentando iniciar sesión:`, req.query);
    res.status(200).send("OK");
});

// Montamos el router usando el prefijo /biometricos/:id
app.use('/biometricos/:id', biometricosRouter);

// Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor escuchando en https://dedo-scanner.onrender.com`);
});
