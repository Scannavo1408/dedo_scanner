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

// Función para procesar datos de asistencia
function processAttendanceData(deviceSN, data, customId = null) {
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
        receivedAt: new Date(),
        customId: customId // Añadir el ID personalizado si existe
      };
      
      // Almacenar registro
      attendanceRecords.push(attendanceRecord);
      
      // Log del marcaje
      logEvent(deviceSN, 'MARCAJE', attendanceRecord);
    }
  });
  
  // Estadísticas
  console.log(`=== Marcajes Recibidos: ${records.length} ===`);
  console.log(`=== Total de Marcajes: ${attendanceRecords.length} ===`);
}

// Función para procesar opciones del dispositivo
function processOptions(deviceSN, data, customId = null) {
  const options = {};
  const items = data.split(',');
  
  items.forEach(item => {
    const [key, value] = item.split('=');
    if (key && value) {
      options[key.trim()] = value.trim();
    }
  });
  
  // Añadir el ID personalizado si existe
  if (customId) {
    options.customId = customId;
  }
  
  // Guardar las opciones en el dispositivo
  if (devices[deviceSN]) {
    devices[deviceSN].options = { ...devices[deviceSN].options, ...options };
  }
  
  logEvent(deviceSN, 'CONFIGURACION', options);
}

// MIDDLEWARE PARA EXTRAER ID PERSONALIZADO
// Este middleware extrae un ID personalizado de diferentes fuentes en la solicitud
app.use((req, res, next) => {
  // Intentar obtener ID personalizado de diferentes fuentes
  let customId = null;
  
  // 1. Verificar si hay un ID en la ruta (ejemplo: /41038/iclock/...)
  const pathSegments = req.path.split('/').filter(segment => segment);
  if (pathSegments.length > 0 && !isNaN(pathSegments[0])) {
    customId = pathSegments[0];
  }
  
  // 2. Verificar si hay un parámetro id en la consulta (ejemplo: ?id=41038)
  if (req.query.id && !isNaN(req.query.id)) {
    customId = req.query.id;
  }
  
  // 3. Verificar si hay un parámetro customId en la consulta (ejemplo: ?customId=41038)
  if (req.query.customId && !isNaN(req.query.customId)) {
    customId = req.query.customId;
  }
  
  // Guardar el ID personalizado en el objeto de solicitud para usarlo en las rutas
  if (customId) {
    req.customId = customId;
    console.log(`=== ID personalizado detectado: ${customId} ===`);
  }
  
  // Si la ruta comienza con un número, redireccionar a la ruta base correspondiente
  if (pathSegments.length > 0 && !isNaN(pathSegments[0])) {
    // Construir la nueva ruta sin el ID numérico al principio
    const newPath = '/' + pathSegments.slice(1).join('/');
    
    // Preservar todos los parámetros de consulta originales y añadir el customId
    const queryParams = { ...req.query, customId: pathSegments[0] };
    
    // Construir la cadena de consulta
    const queryString = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');
    
    // Redireccionar a la nueva URL
    const redirectUrl = newPath + (queryString ? `?${queryString}` : '');
    
    console.log(`=== Redireccionando de ${req.originalUrl} a ${redirectUrl} ===`);
    
    return res.redirect(307, redirectUrl);  // 307 mantiene el método HTTP original
  }
  
  next();
});

// Ruta raíz para verificar que el servidor está en línea
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Servidor ZKTeco</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #333; }
          .container { max-width: 800px; margin: 0 auto; }
          .status { background-color: #dff0d8; padding: 15px; border-radius: 4px; }
          ul { margin-top: 20px; }
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
          <h2>Endpoints disponibles:</h2>
          <ul>
            <li><a href="/info">/info</a> - Información del servidor</li>
            <li><a href="/records">/records</a> - Ver registros de asistencia</li>
            <li><strong>/iclock/cdata</strong> - Inicialización del dispositivo</li>
            <li><strong>/iclock/getrequest</strong> - Solicitar comandos</li>
          </ul>
          <p>Nota: El servidor redirecciona automáticamente las rutas con prefijo numérico (ej: /41038/iclock/...) a las rutas base correspondientes.</p>
        </div>
      </body>
    </html>
  `);
});

// Ruta de información
app.get('/info', (req, res) => {
  const info = {
    devices: Object.keys(devices),
    totalDevices: Object.keys(devices).length,
    totalAttendanceRecords: attendanceRecords.length,
    serverTime: new Date(),
    customId: req.customId || null
  };
  
  res.json(info);
});

// Ruta de registros
app.get('/records', (req, res) => {
  const filteredRecords = req.customId 
    ? attendanceRecords.filter(record => record.customId === req.customId)
    : attendanceRecords;
  
  res.json(filteredRecords);
});

// RUTAS ZKTECO FUNCIONANDO EN LAS RUTAS BASE
// Ruta para inicialización del dispositivo
app.get('/iclock/cdata', (req, res) => {
  const { SN, options, pushver, language } = req.query;
  const customId = req.customId;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }

  console.log(`=== Inicialización recibida ${customId ? `con ID: ${customId}` : ''} ===`);

  // Registrar dispositivo si es nuevo
  if (!devices[SN]) {
    devices[SN] = {
      lastSeen: new Date(),
      info: {},
      customId: customId
    };
    logEvent(SN, 'REGISTRO', { firstConnection: true, customId });
  } else if (customId) {
    // Actualizar ID personalizado si existe
    devices[SN].customId = customId;
  }
  
  // Actualizar última vez visto
  devices[SN].lastSeen = new Date();
  
  // Log de la inicialización
  logEvent(SN, 'INICIALIZACION', { 
    pushver, 
    language, 
    options,
    customId
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
  const customId = req.customId;
  const body = req.body;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  console.log(`=== POST recibido ${customId ? `con ID: ${customId}` : ''} ===`);
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
    // Actualizar ID personalizado si existe
    if (customId) {
      devices[SN].customId = customId;
    }
  }
  
  // Procesar según el tipo de tabla
  switch (table) {
    case 'ATTLOG':
      // Datos de marcación de asistencia
      processAttendanceData(SN, body, customId);
      res.status(200).send(`OK: ${body.trim().split('\n').length}`);
      break;
      
    case 'OPERLOG':
      // Datos de operaciones
      logEvent(SN, 'OPERACION', { data: body, customId });
      res.status(200).send('OK: 1');
      break;
      
    case 'options':
      // Datos de configuración del dispositivo
      processOptions(SN, body, customId);
      res.status(200).send('OK');
      break;
      
    default:
      logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body, customId });
      res.status(200).send('OK');
  }
});

// Ruta para obtener comandos
app.get('/iclock/getrequest', (req, res) => {
  const { SN } = req.query;
  const customId = req.customId;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  console.log(`=== Solicitud de comando recibida ${customId ? `con ID: ${customId}` : ''} ===`);
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
    // Actualizar ID personalizado si existe
    if (customId) {
      devices[SN].customId = customId;
    }
  }
  
  logEvent(SN, 'SOLICITUD_COMANDO', { customId });
  
  // Por defecto, no enviamos comandos
  res.status(200).send('OK');
});

// Inicio del servidor
app.listen(port, () => {
  console.log('=================================================');
  console.log(`  Servidor ZKTeco corriendo en puerto ${port}`);
  console.log('  Endpoints disponibles:');
  console.log('  - GET  /                  : Página principal');
  console.log('  - GET  /info              : Información del servidor');
  console.log('  - GET  /records           : Ver registros de asistencia');
  console.log('  - GET  /iclock/cdata      : Inicialización de dispositivo');
  console.log('  - POST /iclock/cdata      : Subir registros de asistencia');
  console.log('  - GET  /iclock/getrequest : Obtener comandos');
  console.log('');
  console.log('  IMPORTANTE: El servidor redirecciona automáticamente');
  console.log('  las rutas con prefijo numérico (ej: /41038/iclock/...)');
  console.log('  a las rutas base correspondientes (/iclock/...)');
  console.log('=================================================');
});
