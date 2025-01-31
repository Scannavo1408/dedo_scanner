const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middlewares generales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de inicialización del dispositivo (GET /iclock/cdata)
app.get('/iclock/cdata', (req, res) => {
    const serialNumber = req.query.SN || "Unknown";
    console.log(`🔄 Inicialización del dispositivo: ${serialNumber}`);
    
    // Respuesta ajustada según el ejemplo del protocolo
    res.status(200).send(
        `GET OPTION FROM:${serialNumber}\n` +
        `Stamp=${Date.now()}\n` +  // Usar timestamp actual como ejemplo
        `ATTLOGStamp=None\n` +
        `OPERLOGStamp=9999\n` +
        `ErrorDelay=30\n` +
        `Delay=10\n` +
        `TransTimes=00:00;14:05\n` +
        `TransInterval=1\n` +
        `TransFlag=TransData AttLog OpLog\n` + // Simplificado para coincidir con el ejemplo
        `TimeZone=0\n` +
        `Realtime=1\n` +
        `Encrypt=None\n`
    );
});

// Ruta para obtener comandos (paso 2 del protocolo)
app.get('/iclock/devicecmd', (req, res) => {
    const serialNumber = req.query.SN || "Unknown";
    console.log(`📥 Dispositivo ${serialNumber} solicitando comandos`);
    
    // Ejemplo de respuesta (puede variar según comandos pendientes)
    res.status(200).send("CMD: No hay comandos pendientes");
});

// Ruta para enviar resultados de comandos (paso 3 del protocolo)
app.post('/iclock/devicecmd', express.raw({ type: '*/*' }), (req, res) => {
    const serialNumber = req.query.SN || "Unknown";
    console.log(`📤 Resultado de comando desde ${serialNumber}:`, req.body.toString());
    res.status(200).send("OK: Comando procesado");
});

// Ruta para subir datos nuevos (paso 4 del protocolo)
app.post('/iclock/cdata', express.raw({ type: '*/*' }), (req, res) => {
    const { SN, Stamp } = req.query;
    console.log(`📡 Datos de asistencia desde ${SN}. Stamp: ${Stamp}`);
    console.log("Contenido:", req.body.toString());
    res.status(200).send("OK");
});

// Eliminada la ruta /iclock/data/upload (no es parte del protocolo)

// Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});
