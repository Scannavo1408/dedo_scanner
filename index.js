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
function processAttendanceData(deviceSN, data, prefix = null) {
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
        prefix: prefix // Registrar si vino de un prefijo
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
function processOptions(deviceSN, data, prefix = null) {
  const options = {};
  const items = data.split(',');
  
  items.forEach(item => {
    const [key, value] = item.split('=');
    if (key && value) {
      options[key.trim()] = value.trim();
    }
  });
  
  // Añadir información del prefijo
  if (prefix) {
    options.prefix = prefix;
  }
  
  // Guardar las opciones en el dispositivo
  if (devices[deviceSN]) {
    devices[deviceSN].options = { ...devices[deviceSN].options, ...options };
  }
  
  logEvent(deviceSN, 'CONFIGURACION', options);
}

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
            <li>/:prefijo - Cualquier ruta con prefijo numérico (ej: /41038/...)</li>
          </ul>
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
    serverTime: new Date()
  };
  
  res.json(info);
});

// Ruta de registros
app.get('/records', (req, res) => {
  res.json(attendanceRecords);
});

// FUNCIONES PARA MANEJAR RUTAS ZK TECO
// Estas se reutilizarán para las rutas con y sin prefijo
const zkTecoHandlers = {
  // Manejador para inicialización del dispositivo
  handleInitialization: (req, res, prefix = null) => {
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
      logEvent(SN, 'REGISTRO', { firstConnection: true, prefix });
    }
    
    // Actualizar última vez visto
    devices[SN].lastSeen = new Date();
    
    // Log de la inicialización
    logEvent(SN, 'INICIALIZACION', { 
      pushver, 
      language, 
      options,
      prefix 
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
  },
  
  // Manejador para subir registros de asistencia
  handleDataUpload: (req, res, prefix = null) => {
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
        processAttendanceData(SN, body, prefix);
        res.status(200).send(`OK: ${body.trim().split('\n').length}`);
        break;
        
      case 'OPERLOG':
        // Datos de operaciones
        logEvent(SN, 'OPERACION', { data: body, prefix });
        res.status(200).send('OK: 1');
        break;
        
      case 'options':
        // Datos de configuración del dispositivo
        processOptions(SN, body, prefix);
        res.status(200).send('OK');
        break;
        
      default:
        logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body, prefix });
        res.status(200).send('OK');
    }
  },
  
  // Manejador para obtener comandos
  handleGetRequest: (req, res, prefix = null) => {
    const { SN } = req.query;
    
    if (!SN) {
      return res.status(400).send('Error: SN no proporcionado');
    }
    
    // Actualizar última vez visto
    if (devices[SN]) {
      devices[SN].lastSeen = new Date();
    }
    
    logEvent(SN, 'SOLICITUD_COMANDO', { prefix });
    
    // Por defecto, no enviamos comandos
    res.status(200).send('OK');
  }
};

// CONFIGURAR RUTAS NORMALES (sin prefijo)
// Ruta para inicialización del dispositivo
app.get('/iclock/cdata', (req, res) => {
  zkTecoHandlers.handleInitialization(req, res);
});

// Ruta para subir registros de asistencia
app.post('/iclock/cdata', (req, res) => {
  zkTecoHandlers.handleDataUpload(req, res);
});

// Ruta para obtener comandos
app.get('/iclock/getrequest', (req, res) => {
  zkTecoHandlers.handleGetRequest(req, res);
});

// CONFIGURAR RUTAS CON PREFIJO NUMÉRICO
// Importante: Middleware para capturar todas las rutas con prefijo numérico
app.use('/:id([0-9]+)', (req, res, next) => {
  // Guardamos el ID para usarlo en las rutas específicas
  req.prefixId = req.params.id;
  
  // Log para depuración
  console.log(`=== Acceso a ruta con prefijo /${req.prefixId}${req.path} ===`);
  
  // Condicional para manejar rutas específicas
  if (req.path === '/iclock/cdata' && req.method === 'GET') {
    return zkTecoHandlers.handleInitialization(req, res, req.prefixId);
  } 
  else if (req.path === '/iclock/cdata' && req.method === 'POST') {
    return zkTecoHandlers.handleDataUpload(req, res, req.prefixId);
  } 
  else if (req.path === '/iclock/getrequest' && req.method === 'GET') {
    return zkTecoHandlers.handleGetRequest(req, res, req.prefixId);
  }
  else if (req.path === '' || req.path === '/') {
    // Para la ruta directa al ID (ej: /41038)
    logEvent('PARAMETRO', 'RECEPCION_DIRECTA', {
      id: req.prefixId,
      method: req.method,
      query: req.query,
      body: typeof req.body === 'object' ? JSON.stringify(req.body) : req.body.toString(),
      receivedAt: new Date()
    });
    return res.status(200).send('OK');
  }
  
  // Si no coincide con las rutas específicas, pasamos a la siguiente ruta
  // que capturará cualquier otra solicitud con este prefijo
  next();
});

// Ruta para capturar cualquier otra solicitud con prefijo numérico
app.all('/:id([0-9]+)/*', (req, res) => {
  const id = req.params.id;
  const path = req.path;
  const method = req.method;
  const query = req.query;
  
  logEvent('RUTA_DESCONOCIDA', 'RECEPCION', {
    id,
    path,
    method,
    query,
    body: typeof req.body === 'object' ? JSON.stringify(req.body) : req.body.toString(),
    receivedAt: new Date()
  });
  
  // Log para depuración
  console.log(`=== Solicitud no manejada: ${method} /${id}${path} ===`);
  
  // Responder con OK para no generar errores
  res.status(200).send('OK');
});

// Inicio del servidor
app.listen(port, () => {
  console.log('=================================================');
  console.log(`  Servidor ZKTeco corriendo en puerto ${port}`);
  console.log('  Endpoints originales:');
  console.log('  - GET  /                  : Página principal');
  console.log('  - GET  /info              : Información del servidor');
  console.log('  - GET  /records           : Ver registros de asistencia');
  console.log('  - GET  /iclock/cdata      : Inicialización de dispositivo');
  console.log('  - POST /iclock/cdata      : Subir registros de asistencia');
  console.log('  - GET  /iclock/getrequest : Obtener comandos');
  console.log('');
  console.log('  Endpoints con prefijo numérico (ej: /41038):');
  console.log('  - GET  /:id/iclock/cdata      : Inicialización con prefijo');
  console.log('  - POST /:id/iclock/cdata      : Subir registros con prefijo');
  console.log('  - GET  /:id/iclock/getrequest : Obtener comandos con prefijo');
  console.log('  - ANY  /:id                   : Recepción directa con ID');
  console.log('  - ANY  /:id/*                 : Cualquier otra ruta con prefijo');
  console.log('=================================================');
});
