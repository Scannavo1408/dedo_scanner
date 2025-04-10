const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const chalk = require('chalk');
const app = express();
// Usar la variable de entorno PORT que proporciona Render, o 8081 como respaldo
const port = process.env.PORT || 8081;

// Middleware para parsear datos
app.use(bodyParser.text({ type: '*/*' }));
app.use(morgan('dev'));

// Almacenamiento de datos simulado
const devices = {};
const attendanceRecords = [];
const pendingCommands = {};
const commandResponses = {}; // Para almacenar las respuestas a los comandos

// Formatear fecha para logs
const formatDate = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

// Función para imprimir logs formateados
const logEvent = (deviceSN, eventType, details) => {
  const timestamp = formatDate();
  console.log(`[${timestamp}] [${deviceSN}] [${eventType}] ${JSON.stringify(details, null, 2)}`);
};

// Ruta raíz para verificar que el servidor está en línea
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Servidor ZKTeco</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #333; }
          .container { max-width: 900px; margin: 0 auto; }
          .status { background-color: #dff0d8; padding: 15px; border-radius: 4px; }
          .records { background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 20px; }
          .examples { background-color: #eaf7fd; padding: 15px; border-radius: 4px; margin-top: 20px; }
          .code { font-family: monospace; background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
          ul { margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          table, th, td { border: 1px solid #ddd; }
          th, td { padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Servidor de Marcaje ZKTeco</h1>
          <div class="status">
            <p>✅ Servidor funcionando correctamente</p>
            <p>Tiempo de servidor: ${new Date().toISOString()}</p>
            <p>Dispositivos conectados: ${Object.keys(devices).length}</p>
            <p>Marcajes registrados: ${attendanceRecords.length}</p>
          </div>
          
          <h2>Dispositivos Conectados:</h2>
          ${Object.keys(devices).length > 0 ? `
            <ul>
              ${Object.keys(devices).map(sn => `
                <li>
                  <strong>${sn}</strong> - 
                  Última conexión: ${new Date(devices[sn].lastSeen).toLocaleString()}
                </li>
              `).join('')}
            </ul>
          ` : '<p>No hay dispositivos conectados todavía.</p>'}
          
          <h2>Últimos 5 Marcajes:</h2>
          <div class="records">
            ${attendanceRecords.length > 0 ? `
              <table>
                <tr>
                  <th>Usuario</th>
                  <th>Fecha/Hora</th>
                  <th>Dispositivo</th>
                  <th>Verificación</th>
                </tr>
                ${attendanceRecords.slice(-5).map(record => `
                  <tr>
                    <td>${record.pin}</td>
                    <td>${record.time}</td>
                    <td>${record.deviceSN}</td>
                    <td>${record.verify === '1' ? 'Huella' : record.verify === '2' ? 'Rostro' : 'Otro'}</td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p>No hay marcajes registrados todavía.</p>'}
          </div>
          
          <h2>Enviando PINs a los dispositivos:</h2>
          <div class="examples">
            <p><strong>Ejemplos de uso:</strong></p>
            <ul>
              <li>
                Enviar a un dispositivo específico:<br>
                <span class="code">/set-pin?deviceSN=JJA1234300033&pin=41038</span>
              </li>
              <li>
                Enviar con nombre personalizado:<br>
                <span class="code">/set-pin?deviceSN=JJA1234300033&pin=41038&name=Juan Perez</span>
              </li>
              <li>
                Enviar a todos los dispositivos conectados:<br>
                <span class="code">/set-pin?deviceSN=any&pin=41038</span>
              </li>
            </ul>
            <p><strong>Parámetros:</strong></p>
            <ul>
              <li><strong>deviceSN</strong>: Número de serie del dispositivo o "any" para todos</li>
              <li><strong>pin</strong>: ID de usuario a enviar</li>
              <li><strong>name</strong> (opcional): Nombre del usuario (si se omite, se usa el PIN)</li>
            </ul>
          </div>
          
          <h2>Endpoints disponibles:</h2>
          <ul>
            <li><a href="/info">/info</a> - Información detallada del servidor</li>
            <li><a href="/records">/records</a> - Ver todos los registros de asistencia</li>
            <li><a href="/records?limit=10">/records?limit=10</a> - Ver los últimos 10 registros</li>
            <li><a href="/set-pin">/set-pin</a> - Enviar PIN a los dispositivos (requiere parámetros)</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// Ruta para inicialización del dispositivo
app.get('/iclock/cdata', (req, res) => {
  const { SN, options, pushver, language } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }

  // Registrar dispositivo si es nuevo
  if (!devices[SN]) {
    devices[SN] = {
      lastSeen: new Date(),
      info: {}
    };
    logEvent(SN, 'REGISTRO', { firstConnection: true });
  }
  
  // Actualizar última vez visto
  devices[SN].lastSeen = new Date();
  
  // Log de la inicialización
  logEvent(SN, 'INICIALIZACION', { 
    pushver, 
    language, 
    options 
  });
  
  // Respuesta según el protocolo PUSH
  const response = `GET OPTION FROM: ${SN}
ATTLOGStamp=None
OPERLOGStamp=9999
ATTPHOTOStamp=None
ErrorDelay=30
Delay=10
TransTimes=00:00;14:05
TransInterval=1
TransFlag=TransData AttLog OpLog AttPhoto EnrollUser ChgUser EnrollFP ChgFP UserPic
TimeZone=8
Realtime=1
Encrypt=None
ServerVer=2.4.2
PushProtVer=2.4.2`;

  res.status(200).send(response);
});

// Ruta para subir registros de asistencia
app.post('/iclock/cdata', (req, res) => {
  const { SN, table, Stamp } = req.query;
  const body = req.body;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
  }
  
  // Procesar según el tipo de tabla
  switch (table) {
    case 'ATTLOG':
      // Datos de marcación de asistencia
      processAttendanceData(SN, body);
      res.status(200).send(`OK: ${body.trim().split('\n').length}`);
      break;
      
    case 'OPERLOG':
      // Datos de operaciones
      logEvent(SN, 'OPERACION', { data: body });
      res.status(200).send('OK: 1');
      break;
      
    case 'options':
      // Datos de configuración del dispositivo
      processOptions(SN, body);
      res.status(200).send('OK');
      break;
      
    default:
      logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body });
      res.status(200).send('OK');
  }
});

// Ruta para obtener comandos - ahora soporta envío de comandos
app.get('/iclock/getrequest', (req, res) => {
  const { SN } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  // Registrar el dispositivo si es nuevo (por si se conecta aquí primero)
  if (!devices[SN]) {
    devices[SN] = {
      lastSeen: new Date(),
      info: {},
      firstSeenAt: new Date()
    };
    logEvent(SN, 'NUEVO_DISPOSITIVO', { message: 'Dispositivo detectado a través de solicitud de comando' });
  }
  
  // Actualizar última vez visto
  devices[SN].lastSeen = new Date();
  
  // Verificar si hay comandos pendientes para este dispositivo
  if (pendingCommands[SN]) {
    const command = pendingCommands[SN];
    delete pendingCommands[SN]; // Eliminar comando pendiente después de enviarlo
    
    // Generar ID único para el comando
    const cmdId = 'cmd' + Date.now();
    
    // Registrar el comando para seguimiento
    commandResponses[cmdId] = {
      command: command,
      sentAt: new Date(),
      status: 'sent',
      deviceSN: SN
    };
    
    if (command.type === 'SET_PIN') {
      const pin = command.pin;
      const name = command.name || pin; // Usar nombre personalizado si existe
      
      // Registrar el comando en logs
      logEvent(SN, 'COMANDO_ENVIADO', { 
        commandId: cmdId,
        command: 'SET_USER_PIN', 
        pin: pin,
        name: name
      });
      
      // Enviar comando al dispositivo para añadir/actualizar usuario
      return res.status(200).send(`C:${cmdId}:DATA UPDATE USERINFO PIN=${pin} Name=${name} Pri=0 Passwd= Card= Grp=1 TZ=0000000000000000`);
    }
  }
  
  // No registramos cada solicitud vacía para reducir spam en los logs
  res.status(200).send('OK');
});

// Ruta para procesar respuestas a comandos
app.post('/iclock/devicecmd', (req, res) => {
  const { SN } = req.query;
  const body = req.body;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  // Extraer ID del comando y resultado
  const matches = body.match(/ID=([^&]+)&Return=([^&]+)/);
  if (matches && matches.length >= 3) {
    const cmdId = matches[1];
    const returnCode = matches[2];
    
    // Actualizar estado del comando
    if (commandResponses[cmdId]) {
      commandResponses[cmdId].status = returnCode === '0' ? 'success' : 'failed';
      commandResponses[cmdId].returnCode = returnCode;
      commandResponses[cmdId].responseTime = new Date();
      
      // Registrar respuesta en logs
      logEvent(SN, 'RESPUESTA_COMANDO', {
        commandId: cmdId,
        command: commandResponses[cmdId].command,
        status: commandResponses[cmdId].status,
        returnCode: returnCode
      });
    }
  }
  
  res.status(200).send('OK');
});

// Endpoint para setear un PIN para ser enviado al dispositivo
app.get('/set-pin', (req, res) => {
  const { deviceSN, pin, name } = req.query;
  
  if (!deviceSN || !pin) {
    return res.status(400).json({ 
      error: 'Se requiere deviceSN y pin',
      example: '/set-pin?deviceSN=JJA1234300033&pin=41038',
      note: 'También puedes incluir un parámetro "name" opcional para el nombre de usuario'
    });
  }
  
  // Si es una solicitud para cualquier dispositivo conectado
  if (deviceSN.toLowerCase() === 'any' || deviceSN === '*') {
    const connectedDevices = Object.keys(devices);
    
    if (connectedDevices.length === 0) {
      return res.status(404).json({ 
        error: 'No hay dispositivos conectados',
        suggestion: 'Espera a que un dispositivo se conecte antes de usar "any"'
      });
    }
    
    // Enviar el comando a todos los dispositivos conectados
    for (const sn of connectedDevices) {
      pendingCommands[sn] = { 
        type: 'SET_PIN', 
        pin: pin,
        name: name || pin, // Usar el nombre proporcionado o el PIN como nombre
        createdAt: new Date()
      };
    }
    
    return res.json({ 
      success: true, 
      message: `PIN ${pin} será enviado a todos los dispositivos conectados (${connectedDevices.length})`,
      devices: connectedDevices,
      estimatedTime: 'Dentro de 10 segundos',
    });
  }
  
  // Verificación opcional - permite enviar comandos a dispositivos que aún no se han conectado
  if (!devices[deviceSN]) {
    console.log(`Advertencia: Se está enviando un comando al dispositivo ${deviceSN} que aún no se ha conectado`);
  }
  
  // Almacenar el PIN para ser enviado cuando el dispositivo haga la próxima solicitud
  pendingCommands[deviceSN] = { 
    type: 'SET_PIN', 
    pin: pin,
    name: name || pin, // Usar el nombre proporcionado o el PIN como nombre
    createdAt: new Date()
  };
  
  res.json({ 
    success: true, 
    message: `PIN ${pin} será enviado al dispositivo ${deviceSN} en la próxima solicitud`,
    estimatedTime: 'Dentro de 10 segundos',
    note: 'El dispositivo debe estar conectado y hacer una solicitud para recibir el comando'
  });
});

// Ruta de información
app.get('/info', (req, res) => {
  const info = {
    server: {
      time: new Date(),
      uptime: process.uptime() + ' segundos'
    },
    devices: Object.keys(devices).map(sn => ({
      serialNumber: sn,
      lastSeen: devices[sn].lastSeen,
      info: devices[sn].options || {}
    })),
    stats: {
      totalDevices: Object.keys(devices).length,
      totalAttendanceRecords: attendanceRecords.length,
      pendingCommands: Object.keys(pendingCommands).length
    },
    pendingCommands: pendingCommands,
    commandResponses: commandResponses
  };
  
  res.json(info);
});

// Ruta de registros filtrable
app.get('/records', (req, res) => {
  const { deviceSN, pin, startDate, endDate, limit } = req.query;
  
  let filteredRecords = [...attendanceRecords];
  
  // Aplicar filtros si existen
  if (deviceSN) {
    filteredRecords = filteredRecords.filter(record => record.deviceSN === deviceSN);
  }
  
  if (pin) {
    filteredRecords = filteredRecords.filter(record => record.pin === pin);
  }
  
  if (startDate) {
    const startDateTime = new Date(startDate);
    filteredRecords = filteredRecords.filter(record => new Date(record.time) >= startDateTime);
  }
  
  if (endDate) {
    const endDateTime = new Date(endDate);
    filteredRecords = filteredRecords.filter(record => new Date(record.time) <= endDateTime);
  }
  
  // Aplicar límite si existe
  if (limit && !isNaN(parseInt(limit))) {
    filteredRecords = filteredRecords.slice(-parseInt(limit));
  }
  
  res.json({
    totalRecords: filteredRecords.length,
    records: filteredRecords,
    filters: { deviceSN, pin, startDate, endDate, limit }
  });
});

// Función para procesar datos de asistencia
function processAttendanceData(deviceSN, data) {
  const records = data.trim().split('\n');
  
  records.forEach(record => {
    const fields = record.split('\t');
    if (fields.length >= 5) {
      const [pin, time, status, verify, workcode, ...rest] = fields;
      
      // Crear objeto con los datos del marcaje
      const attendanceRecord = {
        deviceSN,
        pin,
        time,
        status,
        verify,
        workcode,
        additionalData: rest,
        receivedAt: new Date()
      };
      
      // Almacenar registro
      attendanceRecords.push(attendanceRecord);
      
      // Log del marcaje - Este es importante, mantenemos detallado
      logEvent(deviceSN, 'MARCAJE', attendanceRecord);
    }
  });
  
  // Estadísticas
  console.log(`=== Marcajes Recibidos: ${records.length} ===`);
  console.log(`=== Total de Marcajes: ${attendanceRecords.length} ===`);
}

// Función para procesar opciones del dispositivo
function processOptions(deviceSN, data) {
  const options = {};
  const items = data.split(',');
  
  items.forEach(item => {
    const [key, value] = item.split('=');
    if (key && value) {
      options[key.trim()] = value.trim();
    }
  });
  
  // Guardar las opciones en el dispositivo
  if (devices[deviceSN]) {
    devices[deviceSN].options = { ...devices[deviceSN].options, ...options };
  }
  
  logEvent(deviceSN, 'CONFIGURACION', options);
}

// Inicio del servidor
app.listen(port, () => {
  console.log('=================================================');
  console.log(`  Servidor ZKTeco corriendo en puerto ${port}`);
  console.log('  Desplegado en: ' + (process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`));
  console.log('  Endpoints disponibles:');
  console.log('  - GET  /       : Página principal');
  console.log('  - GET  /info   : Información del servidor');
  console.log('  - GET  /records: Ver registros de asistencia');
  console.log('  - GET  /set-pin: Enviar PIN al dispositivo');
  console.log('=================================================');
});
