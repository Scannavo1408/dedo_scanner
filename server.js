
// server.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

/**
 * Cola de comandos en memoria:
 * Estructura sugerida: {
 *   "0316144680030": [ "C:1:DATA UPDATE USERINFO ...", "C:2:..." ],
 *   "Otro_SN": [ "..." ]
 * }
 */
const commandsQueue = {};

/**
 * Middleware para parsear JSON en las rutas que sí esperen JSON (ej. para administrar comandos).
 * Usaremos express.json() solo en rutas específicas, no globalmente para no interferir con express.raw()
 */
const jsonParser = express.json();

// --------------------------------------------------------------------
// 1) Ruta para inicialización o "ping" desde el dispositivo (GET)
//    Ejemplo: GET /iclock/ping?SN=0316144680030
// --------------------------------------------------------------------
app.get('/iclock/ping', (req, res) => {
  const sn = req.query.SN || 'Unknown';
  console.log(`📡 [GET /iclock/ping] Ping del dispositivo SN=${sn}`);
  
  // Respuesta simple
  res.status(200).send(`PONG from server, SN=${sn}, time=${new Date().toISOString()}`);
});

// --------------------------------------------------------------------
// 2) Ruta para que el dispositivo solicite comandos pendientes (GET)
//    Ejemplo: GET /iclock/devicecmd?SN=0316144680030
// --------------------------------------------------------------------
app.get('/iclock/devicecmd', (req, res) => {
  const sn = req.query.SN || 'Unknown';
  console.log(`📥 [GET /iclock/devicecmd] Dispositivo ${sn} pide comandos.`);

  // Busca la cola de comandos en memoria
  const deviceCommands = commandsQueue[sn] || [];
  
  if (deviceCommands.length === 0) {
    // Sin comandos pendientes
    console.log(`→ No hay comandos pendientes para SN=${sn}`);
    return res.status(200).send('CMD: No hay comandos pendientes');
  }
  
  // Si hay comandos, los enviamos en el formato que necesite el dispositivo
  // Aquí los unimos con saltos de línea, por ejemplo
  const response = deviceCommands.join('\n');
  
  // Limpiamos la cola para ese SN (asumiendo que ya los “descargó” el dispositivo)
  commandsQueue[sn] = [];
  
  // Respuesta con los comandos pendientes
  console.log(`→ Enviando ${deviceCommands.length} comando(s) a SN=${sn}`);
  res.status(200).send(response);
});

// --------------------------------------------------------------------
// 3) Ruta para recibir datos crudos que envíe el dispositivo (POST).
//    Ejemplo: POST /iclock/cdata?SN=0316144680030
// --------------------------------------------------------------------
app.post('/iclock/cdata', express.raw({ type: '*/*' }), (req, res) => {
  const sn = req.query.SN || 'Unknown';
  const stamp = req.query.Stamp || 'N/A';
  
  console.log(`📡 [POST /iclock/cdata] Datos recibidos de SN=${sn}, Stamp=${stamp}`);
  
  // El body se lee como buffer, lo pasamos a string para ver contenido
  const rawContent = req.body.toString('utf8');
  console.log('Contenido:', rawContent);

  // TODO: Procesa y guarda en tu DB o archivo log, etc.
  
  // Enviamos respuesta simple
  res.status(200).send('OK');
});

// --------------------------------------------------------------------
// 4) Ruta para recibir resultados de comandos ejecutados por el dispositivo (POST).
//    Ejemplo: POST /iclock/devicecmd?SN=0316144680030
// --------------------------------------------------------------------
app.post('/iclock/devicecmd', express.raw({ type: '*/*' }), (req, res) => {
  const sn = req.query.SN || 'Unknown';
  
  console.log(`📤 [POST /iclock/devicecmd] Resultado de comando desde SN=${sn}`);
  console.log('Contenido:', req.body.toString('utf8'));
  
  // Aquí podrías actualizar el estado de un comando en tu BD, etc.
  
  res.status(200).send('OK: Comando procesado');
});

// --------------------------------------------------------------------
// 5) Ruta para que TÚ (admin o tu panel) añadas un comando a la cola de un dispositivo.
//    Ejemplo: POST /commands (con JSON en el body: { "SN": "0316144680030", "command": "C:1:DATA UPDATE USERINFO ..." })
// --------------------------------------------------------------------
app.post('/commands', jsonParser, (req, res) => {
  const { SN, command } = req.body;
  
  if (!SN || !command) {
    return res.status(400).json({ error: 'SN y command son requeridos' });
  }
  
  // Si no hay un array para este SN, lo creamos
  if (!commandsQueue[SN]) {
    commandsQueue[SN] = [];
  }
  
  // Agregamos el nuevo comando
  commandsQueue[SN].push(command);
  
  console.log(`➕ Nuevo comando para SN=${SN}: ${command}`);
  res.status(200).json({ message: `Command added for SN=${SN}`, totalCommands: commandsQueue[SN].length });
});

// --------------------------------------------------------------------
// 6) (Opcional) Endpoint de error logs, si el dispositivo reporta errores
// --------------------------------------------------------------------
app.post('/iclock/errorlog', express.raw({ type: '*/*' }), (req, res) => {
  const sn = req.query.SN || 'Unknown';
  console.log(`🛑 [POST /iclock/errorlog] Error log desde SN=${sn}`);
  console.log('Contenido:', req.body.toString('utf8'));

  // Guarda en DB / archivo
  // ...

  res.status(201).send('Error log recibido');
});

// --------------------------------------------------------------------
// Iniciar servidor
// --------------------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});
