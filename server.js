const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para capturar datos sin procesar
app.use(express.raw({ type: '*/*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de inicialización del dispositivo
app.get('/iclock/cdata', (req, res) => {
    const serialNumber = req.query.SN || "Unknown";
    console.log(`🔄 Inicialización del dispositivo: ${serialNumber}`);
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

// Ruta para recibir datos de asistencia
app.post('/iclock/data/upload', (req, res) => {
    console.log("📡 Recibido desde F22 - Datos en bruto:");
    console.log(req.body.toString('utf8'));  // Muestra los datos exactos que llegan

    res.status(200).send("OK");
});

// Ruta de autenticación
app.get('/iclock/accounts/login/', (req, res) => {
    console.log("📡 Dispositivo intentando iniciar sesión:", req.query);
    res.status(200).send("OK");
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor escuchando en https://dedo-scanner.onrender.com`);
});
