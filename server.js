const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

/**
 * 1) Middleware para leer el cuerpo crudo de cualquier tipo de petición.
 *    Esto evita que Express intente parsear JSON, etc.
 */
app.use(express.raw({ type: '*/*' }));

/**
 * 2) Cola de comandos en memoria, por cada SN (número de serie).
 *    Estructura: { "SN_123": ["comando1", "comando2"], ... }
 */
const commandsQueue = {};

/**
 * 3) Ruta genérica para todos los GET (menos /commands).
 *    Ej: GET /iclock/ping, GET /iclock/devicecmd, etc.
 *    - Imprime query params en consola
 *    - Responde un texto plano
 */
app.get(['/', '/*'], (req, res) => {
  console.log('--- GET Request ---');
  console.log('Ruta:', req.path);
  console.log('Query params:', req.query);

  const sn = req.query.SN || 'Desconocido';

  // Si la ruta incluye 'devicecmd', devolvemos comandos
  if (req.path.includes('devicecmd')) {
    const deviceCommands = commandsQueue[sn] || [];
    if (deviceCommands.length === 0) {
      return res.status(200).send('CMD: No hay comandos pendientes');
    } else {
      // Unimos los comandos con salto de línea
      const response = deviceCommands.join('\n');
      // Limpiamos la cola (asumiendo que el dispositivo ya los recibió)
      commandsQueue[sn] = [];
      console.log(`Se envían ${deviceCommands.length} comandos a SN=${sn}`);
      return res.status(200).send(response);
    }
  }

  // Si no era devicecmd, respondemos algo genérico
  res.status(200).send(`OK - GET en ${req.path}, SN=${sn}`);
});

/**
 * 4) Ruta genérica para todos los POST (menos /commands).
 *    Ej: POST /iclock/cdata, etc.
 *    - Lee el cuerpo crudo y lo imprime
 */
app.post(['/', '/*'], (req, res) => {
  console.log('--- POST Request ---');
  console.log('Ruta:', req.path);
  console.log('Query params:', req.query);

  const rawBody = req.body.toString('utf8');
  console.log('Contenido del body:\n', rawBody);

  // Respuesta simple
  res.status(200).send('OK - POST recibido');
});

/**
 * 5) Ruta para que TÚ (admin o tu panel) agregues comandos.
 *    Se espera que uses JSON:
 *      { "SN": "0316144680030", "command": "C:1:DATA ..." }
 *    Así el dispositivo, cuando llame a GET /iclock/devicecmd?SN=...
 *    podrá recibirlos.
 */
app.use(express.json()); // <-- Solo aquí parseamos JSON

app.post('/commands', (req, res) => {
  const { SN, command } = req.body;
  if (!SN || !command) {
    return res.status(400).json({ error: 'Falta SN o command en el body' });
  }

  if (!commandsQueue[SN]) {
    commandsQueue[SN] = [];
  }
  commandsQueue[SN].push(command);

  console.log(`\n[ADMIN] Agregado comando para SN=${SN}: "${command}"`);
  return res.status(200).json({
    message: `Command added for SN=${SN}`,
    totalCommands: commandsQueue[SN].length,
  });
});

// Levantamos servidor
app.listen(port, () => {
  console.log(`\n🚀 Servidor levantado en http://localhost:${port}\n`);
});
