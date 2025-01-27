const express = require('express');
const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(express.json());

// Ruta para recibir datos
app.post('/receive_data', (req, res) => {
    const data = req.body; // Los datos enviados por el dispositivo
    console.log("Datos recibidos:", data);

    // Responder al dispositivo
    res.json({ status: "success", message: "Datos recibidos correctamente" });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});