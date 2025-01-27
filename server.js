const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para capturar cualquier tipo de dato
app.use(express.raw({ type: '*/*' }));

// Manejar cualquier tipo de solicitud
app.all('/receive_data', (req, res) => {
    const method = req.method; // Método HTTP (GET, POST, etc.)
    const headers = req.headers; // Cabeceras de la solicitud
    const rawData = req.body; // Datos en bruto
    const contentType = headers['content-type']; // Tipo de contenido

    // Mostrar información de la solicitud en los logs
    console.log(`[${new Date().toISOString()}] Solicitud recibida:`);
    console.log(`- Método: ${method}`);
    console.log(`- Cabeceras:`, headers);
    console.log(`- Tipo de contenido: ${contentType}`);
    console.log(`- Datos en bruto:`, rawData.toString('utf8'));

    // Responder al cliente
    res.json({
        status: "success",
        message: "Solicitud recibida correctamente",
        method: method,
        headers: headers,
        data: rawData.toString('utf8') // Mostrar los datos en la respuesta
    });
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente');
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
