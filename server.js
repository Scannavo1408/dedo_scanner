const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.raw({ type: '*/*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta para autenticación del reloj
app.get('/iclock/accounts/login/', (req, res) => {
    console.log("📡 Dispositivo intentando iniciar sesión...");
    res.status(200).send("OK");
});

// Ruta para recibir datos de asistencia
app.post('/iclock/data/upload', (req, res) => {
    console.log("📡 Datos recibidos desde el F22:");
    console.log(req.body.toString('utf8'));
    res.status(200).send("OK");
});

// Ruta para la inicialización y sincronización del dispositivo
app.get('/iclock/cdata', (req, res) => {
    const serialNumber = req.query.SN || "Unknown";
    console.log(`🔄 Inicialización del dispositivo: ${serialNumber}`);

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

// Servidor corriendo
app.listen(port, () => {
    console.log(`🚀 Servidor escuchando en https://dedo-scanner.onrender.com`);
});
