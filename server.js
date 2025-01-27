const express = require('express');
const app = express();
const port = process.env.PORT || 3000; // Usa el puerto de Render o 3000 localmente

// Middleware para parsear JSON
app.use(express.json());

// Ruta para recibir datos
app.post('/receive_data', (req, res) => {
    const data = req.body; // Los datos enviados por el dispositivo
    const timestamp = new Date().toISOString(); // Agrega un timestamp

    // Log personalizado
    console.log(`[${timestamp}] Datos recibidos:`, JSON.stringify(data, null, 2));

    // Responder al dispositivo
    res.json({ status: "success", message: "Datos recibidos correctamente" });
});

// Ruta de inicio (opcional)
app.get('/', (req, res) => {
    res.send('Servidor en
