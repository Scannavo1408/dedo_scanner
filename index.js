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
function processAttendanceData(deviceSN, data, idNumber = null) {
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
        idNumber: idNumber // Incluir el ID numérico si existe
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
function processOptions(deviceSN, data, idNumber = null) {
  const options = {};
  const items = data.split(',');
  
  items.forEach(item => {
    const [key, value] = item.split('=');
    if (key && value) {
      options[key.trim()] = value.trim();
    }
  });
  
  // Incluir el ID numérico si existe
  if (idNumber) {
    options.idNumber = idNumber;
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
            <li><strong>/:id</strong> - Cualquier ID numérico como punto de entrada</li>
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

// Filtrar registros por ID
app.get('/records/:id', (req, res) => {
  const idNumber = req.params.id;
  const filteredRecords = attendanceRecords.filter(record => record.idNumber === idNumber);
  res.json(filteredRecords);
});

// CAPTURAR CUALQUIER RUTA QUE SEA UN NÚMERO
// Esta ruta captura cualquier solicitud a una ruta que sea solo un número (ej: /41038, /12345)
app.all('/:id([0-9]+)', (req, res) => {
  const idNumber = req.params.id;
  const method = req.method;
  const { SN, table, Stamp, options, pushver, language } = req.query;
  const body = req.body;
  
  console.log(`=== Solicitud recibida en /${idNumber}: ${method} ===`);
  console.log(`Parámetros: ${JSON.stringify(req.query)}`);
  
  // Si hay un INFO en la consulta, probablemente es una solicitud getrequest
  if (req.query.INFO) {
    console.log(`=== Detectada solicitud getrequest en /${idNumber} ===`);
    
    if (!SN) {
      return res.status(400).send('Error: SN no proporcionado');
    }
    
    // Actualizar última vez visto
    if (devices[SN]) {
      devices[SN].lastSeen = new Date();
      devices[SN].idNumber = idNumber; // Guardar el ID numérico
    } else {
      // Registrar dispositivo si es nuevo
      devices[SN] = {
        lastSeen: new Date(),
        info: {},
        idNumber: idNumber
      };
    }
    
    logEvent(SN, 'SOLICITUD_COMANDO', {
      INFO: req.query.INFO,
      endpoint: `/${idNumber}`
    });
    
    // Responder con OK
    return res.status(200).send('OK');
  }
  
  // Si el método es GET y tiene SN, probablemente es una inicialización
  if (method === 'GET' && SN) {
    console.log(`=== Detectada solicitud de inicialización en /${idNumber} ===`);
    
    // Registrar dispositivo si es nuevo
    if (!devices[SN]) {
      devices[SN] = {
        lastSeen: new Date(),
        info: {},
        idNumber: idNumber
      };
      logEvent(SN, 'REGISTRO', { firstConnection: true, endpoint: `/${idNumber}` });
    } else {
      devices[SN].idNumber = idNumber; // Actualizar el ID numérico
    }
    
    // Actualizar última vez visto
    devices[SN].lastSeen = new Date();
    
    // Log de la inicialización
    logEvent(SN, 'INICIALIZACION', { 
      pushver, 
      language, 
      options,
      endpoint: `/${idNumber}`
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

    return res.status(200).send(response);
  }
  
  // Si el método es POST, probablemente es una subida de datos
  if (method === 'POST' && SN) {
    console.log(`=== Detectada subida de datos en /${idNumber} ===`);
    
    // Actualizar última vez visto
    if (devices[SN]) {
      devices[SN].lastSeen = new Date();
      devices[SN].idNumber = idNumber; // Actualizar el ID numérico
    }
    
    // Si hay tabla, procesar según el tipo
    if (table) {
      switch (table) {
        case 'ATTLOG':
          // Datos de marcación de asistencia
          processAttendanceData(SN, body, idNumber);
          return res.status(200).send(`OK: ${body.trim().split('\n').length}`);
          
        case 'OPERLOG':
          // Datos de operaciones
          logEvent(SN, 'OPERACION', { data: body, endpoint: `/${idNumber}` });
          return res.status(200).send('OK: 1');
          
        case 'options':
          // Datos de configuración del dispositivo
          processOptions(SN, body, idNumber);
          return res.status(200).send('OK');
          
        default:
          logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body, endpoint: `/${idNumber}` });
          return res.status(200).send('OK');
      }
    }
  }
  
  // Para cualquier otra solicitud a /:id
  logEvent('SOLICITUD_GENERICA', idNumber, {
    method,
    query: req.query,
    body: typeof body === 'object' ? JSON.stringify(body) : body ? body.toString() : '',
    headers: req.headers,
    receivedAt: new Date()
  });
  
  // Responder siempre con OK para evitar errores
  res.status(200).send('OK');
});

// CAPTURAR CUALQUIER RUTA QUE COMIENCE CON UN NÚMERO SEGUIDO DE /iclock/
// Esta ruta captura solicitudes como /41038/iclock/cdata o /41038/iclock/getrequest
app.all('/:id([0-9]+)/iclock/:endpoint', (req, res) => {
  const idNumber = req.params.id;
  const endpoint = req.params.endpoint;
  const method = req.method;
  const { SN, table, Stamp, options, pushver, language } = req.query;
  const body = req.body;
  
  console.log(`=== Solicitud recibida en /${idNumber}/iclock/${endpoint}: ${method} ===`);
  
  // Manejar según el endpoint
  if (endpoint === 'cdata') {
    if (method === 'GET') {
      // Inicialización del dispositivo
      if (!SN) {
        return res.status(400).send('Error: SN no proporcionado');
      }
      
      // Registrar dispositivo si es nuevo
      if (!devices[SN]) {
        devices[SN] = {
          lastSeen: new Date(),
          info: {},
          idNumber: idNumber
        };
        logEvent(SN, 'REGISTRO', { firstConnection: true, endpoint: `/${idNumber}/iclock/cdata` });
      } else {
        devices[SN].idNumber = idNumber; // Actualizar el ID numérico
      }
      
      // Actualizar última vez visto
      devices[SN].lastSeen = new Date();
      
      // Log de la inicialización
      logEvent(SN, 'INICIALIZACION', { 
        pushver, 
        language, 
        options,
        endpoint: `/${idNumber}/iclock/cdata`
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

      return res.status(200).send(response);
    } 
    else if (method === 'POST') {
      // Subir datos
      if (!SN) {
        return res.status(400).send('Error: SN no proporcionado');
      }
      
      // Actualizar última vez visto
      if (devices[SN]) {
        devices[SN].lastSeen = new Date();
        devices[SN].idNumber = idNumber; // Actualizar el ID numérico
      }
      
      // Procesar según el tipo de tabla
      switch (table) {
        case 'ATTLOG':
          // Datos de marcación de asistencia
          processAttendanceData(SN, body, idNumber);
          return res.status(200).send(`OK: ${body.trim().split('\n').length}`);
          
        case 'OPERLOG':
          // Datos de operaciones
          logEvent(SN, 'OPERACION', { data: body, endpoint: `/${idNumber}/iclock/cdata` });
          return res.status(200).send('OK: 1');
          
        case 'options':
          // Datos de configuración del dispositivo
          processOptions(SN, body, idNumber);
          return res.status(200).send('OK');
          
        default:
          logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body, endpoint: `/${idNumber}/iclock/cdata` });
          return res.status(200).send('OK');
      }
    }
  } 
  else if (endpoint === 'getrequest') {
    // Solicitud de comandos
    if (!SN) {
      return res.status(400).send('Error: SN no proporcionado');
    }
    
    // Actualizar última vez visto
    if (devices[SN]) {
      devices[SN].lastSeen = new Date();
      devices[SN].idNumber = idNumber; // Actualizar el ID numérico
    }
    
    logEvent(SN, 'SOLICITUD_COMANDO', { 
      endpoint: `/${idNumber}/iclock/getrequest`,
      INFO: req.query.INFO
    });
    
    // Por defecto, no enviamos comandos
    return res.status(200).send('OK');
  }
  
  // Para cualquier otro endpoint en /iclock/
  logEvent('RUTA_ICLOCK', idNumber, {
    endpoint: `/${idNumber}/iclock/${endpoint}`,
    method,
    query: req.query,
    body: typeof body === 'object' ? JSON.stringify(body) : body ? body.toString() : '',
    receivedAt: new Date()
  });
  
  // Responder siempre con OK para evitar errores
  res.status(200).send('OK');
});

// RUTA COMODÍN PARA CAPTURAR TODAS LAS SOLICITUDES NO MANEJADAS
// Esta ruta captura cualquier solicitud a cualquier ruta que no haya sido manejada por las rutas anteriores
app.use('*', (req, res) => {
  console.log(`=== Solicitud no manejada: ${req.method} ${req.originalUrl} ===`);
  
  // Si la ruta contiene números, intentar extraerlos
  const match = req.originalUrl.match(/\/(\d+)/);
  const idNumber = match ? match[1] : null;
  
  if (idNumber && req.originalUrl.includes('iclock')) {
    console.log(`=== Intento de manejar ruta con número ${idNumber} y 'iclock' ===`);
    
    // Extraer SN de los parámetros de consulta
    const SN = req.query.SN;
    
    if (SN) {
      if (req.originalUrl.includes('getrequest')) {
        logEvent(SN, 'SOLICITUD_COMANDO_COMODIN', { 
          url: req.originalUrl,
          idNumber
        });
        return res.status(200).send('OK');
      }
      
      if (req.method === 'GET' && req.originalUrl.includes('cdata')) {
        // Respuesta para inicialización
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
        
        return res.status(200).send(response);
      }
      
      if (req.method === 'POST' && req.originalUrl.includes('cdata')) {
        // Para subidas de datos
        return res.status(200).send('OK: 1');
      }
    }
  }
  
  // Log de solicitud no manejada
  console.log('Parámetros:', req.query);
  
  // Responder con OK para evitar errores
  res.status(200).send('OK');
});

// Inicio del servidor
app.listen(port, () => {
  console.log('=================================================');
  console.log(`  Servidor ZKTeco corriendo en puerto ${port}`);
  console.log('  Endpoints disponibles:');
  console.log('  - GET  /                      : Página principal');
  console.log('  - GET  /info                  : Información del servidor');
  console.log('  - GET  /records               : Ver registros de asistencia');
  console.log('  - GET  /records/:id           : Filtrar registros por ID');
  console.log('  - ANY  /:id                   : Punto de entrada para cualquier ID numérico');
  console.log('  - ANY  /:id/iclock/cdata      : Inicialización o subida con ID específico');
  console.log('  - ANY  /:id/iclock/getrequest : Comandos con ID específico');
  console.log('=================================================');
});
