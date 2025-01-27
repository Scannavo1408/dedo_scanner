const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para capturar datos en bruto
app.use(express.raw({ type: '*/*' }));

// Ruta para recibir datos
app.post('/receive_data', (req, res) => {
    const rawData = req.body; // Datos en bruto
    const contentType = req.headers['content-type']; // Tipo de contenido
    const timestamp = new Date().toISOString();

    // Mostrar los datos en los logs
    console.log(`[${timestamp}] Datos recibidos (${contentType}):`, rawData.toString('utf8'));

    // Responder al dispositivo
    res.json({ status: "success", message: "Datos recibidos correctamente" });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
