const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para capturar cualquier tipo de dato
app.use(express.raw({ type: '*/*' }));
app.use(express.json()); // Para JSON
app.use(express.urlencoded({ extended: true })); // Para datos de formularios

// Ruta para recibir datos en /iclock/data/upload
app.all('/iclock/data/upload', (req, res) => {
    const method = req.method;
    const headers = req.headers;
    const rawData = req.body;
    const contentType = headers['content-type'];

    console.log(`[${new Date().toISOString()}] /iclock/data/upload`);
    console.log(`- Método: ${method}`);
    console.log(`- Cabeceras:`, headers);
    console.log(`- Tipo de contenido: ${contentType}`);
    console.log(`- Datos en bruto:`, rawData.toString('utf8'));

    res.json({
        status: "success",
        message: "Datos recibidos en /iclock/data/upload",
        method: method,
        headers: headers,
        data: rawData.toString('utf8')
    });
});

// Ruta para manejar login en /iclock/accounts/login
app.post('/iclock/accounts/login', (req, res) => {
    const { username, password } = req.body;

    console.log(`[${new Date().toISOString()}] /iclock/accounts/login`);
    console.log(`- Usuario: ${username}`);
    console.log(`- Contraseña: ${password}`);

    if (username === 'admin' && password === '1234') {
        res.json({ status: "success", message: "Login exitoso", user: username });
    } else {
        res.status(401).json({ status: "error", message: "Credenciales incorrectas" });
    }
});

// Ruta para recibir cualquier tipo de solicitud en /receive_data
app.all('/receive_data', (req, res) => {
    const method = req.method;
    const headers = req.headers;
    const rawData = req.body;
    const contentType = headers['content-type'];

    console.log(`[${new Date().toISOString()}] /receive_data`);
    console.log(`- Método: ${method}`);
    console.log(`- Cabeceras:`, headers);
    console.log(`- Tipo de contenido: ${contentType}`);
    console.log(`- Datos en bruto:`, rawData.toString('utf8'));

    res.json({
        status: "success",
        message: "Solicitud recibida correctamente",
        method: method,
        headers: headers,
        data: rawData.toString('utf8')
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

