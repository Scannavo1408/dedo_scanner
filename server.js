// server.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middlewares generales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------------------------
// 1) Endpoint de inicialización (Ej.: GET /adms-api/device/init)
//    Simula el intercambio de información inicial del dispositivo
// --------------------------------------------------------------------
app.get('/adms-api/device/init', (req, res) => {
  const serialNumber = req.query.SN || 'Unknown';
  const authToken = req.query.auth_token || 'NoAuth'; 
  console.log(`🔄 Inicialización del dispositivo: ${serialNumber}, authToken: ${authToken}`);
  
  // Respuesta ficticia para demostrar opciones “tipo ADMS”
  res.status(200).send({
    message: 'ADMS init OK',
    device: {
      SN: serialNumber,
      options: {
        pushver: '2.4.2',
        // Se pueden incluir más campos si ADMS los requiere
      }
    }
  });
});

// --------------------------------------------------------------------
// 2) Endpoint de intercambio de claves de seguridad (opcional)
//    Ej.: GET /adms-api/security/exchange
// --------------------------------------------------------------------
app.get('/adms-api/security/exchange', (req, res) => {
  // Aquí podrías manejar la generación/entrega de claves públicas, etc.
  // Por ejemplo, si tu ADMS requiere TLS o un intercambio de llave asimétrica.
  console.log('🔐 Intercambio de claves con dispositivo/ADMS');
  
  // Ejemplo de respuesta con clave ficticia
  res.status(200).json({
    publicKey: 'MIIBIjANBgkqh...FAKE_KEY...IDAQAB' // Ejemplo
  });
});

// --------------------------------------------------------------------
// 3) Endpoint para “ping” o “heartbeat” (verificar si el servidor está vivo)
//    Ej.: GET /adms-api/device/ping
// --------------------------------------------------------------------
app.get('/adms-api/device/ping', (req, res) => {
  const serialNumber = req.query.SN || 'Unknown';
  console.log(`🏓 Ping desde dispositivo: ${serialNumber}`);
  res.status(200).json({ status: 'ok', serverTime: new Date() });
});

// --------------------------------------------------------------------
// 4) Endpoint para solicitar comandos (similar a /iclock/getrequest)
//    Ej.: GET /adms-api/commands/get
// --------------------------------------------------------------------
app.get('/adms-api/commands/get', (req, res) => {
  const serialNumber = req.query.SN || 'Unknown';
  console.log(`📥 Dispositivo ${serialNumber} solicitando comandos`);
  
  // En un caso real, aquí buscarías en BD qué comandos pendientes hay para ese SN
  // Ejemplo simple (sin comandos pendientes):
  const commands = []; // Array vacío si no hay nada
  
  res.status(200).json({
    commands: commands,
    message: commands.length > 0 ? 'Hay comandos pendientes' : 'No hay comandos pendientes'
  });
});

// --------------------------------------------------------------------
// 5) Endpoint para que el dispositivo “postee” los datos al servidor
//    Ej.: POST /adms-api/data/push
// --------------------------------------------------------------------
app.post('/adms-api/data/push', (req, res) => {
  const serialNumber = req.query.SN || 'Unknown';
  const table = req.query.table || 'Unknown'; // ej.: ATTLOG, USERINFO
  console.log(`📡 Datos recibidos de ${serialNumber} para la tabla: ${table}`);
  
  // Dependiendo de si envías JSON o texto plano, accede a req.body
  // Si el dispositivo envía text/plain, quizás tengas que usar express.raw() para leerlo
  // Este ejemplo asume que envías JSON en el body
  console.log('Contenido del body:', req.body);
  
  // Aquí procesas y guardas en base de datos según la tabla
  // ...
  
  res.status(200).json({ status: 'OK', message: 'Datos recibidos y procesados' });
});

// --------------------------------------------------------------------
// 6) Endpoint para que el dispositivo reporte la ejecución de un comando
//    Ej.: POST /adms-api/commands/exec
// --------------------------------------------------------------------
app.post('/adms-api/commands/exec', (req, res) => {
  const serialNumber = req.query.SN || 'Unknown';
  console.log(`📤 Resultado de comando desde ${serialNumber}`);
  console.log('Contenido:', req.body);
  
  // Aquí confirmas que el comando se ejecutó, guardas logs, etc.
  res.status(200).json({ status: 'OK', message: 'Comando procesado' });
});

// --------------------------------------------------------------------
// 7) (Opcional) Ruta de errores o logs si ADMS lo requiere
//    Ej.: POST /adms-api/errorlog
// --------------------------------------------------------------------
app.post('/adms-api/errorlog', (req, res) => {
  // Guardar logs de error en DB o archivo
  console.log('🛑 Error Log recibido:', req.body);
  res.status(201).json({ status: 'Logged' });
});

// --------------------------------------------------------------------
// Iniciar el servidor
// --------------------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});
