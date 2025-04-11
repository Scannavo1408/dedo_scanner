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
          </ul>
        </div>
      </body>
    </html>
  `);
});

// Ruta con parámetro de licencia para la página principal
app.get('/:licencia', (req, res) => {
  const licencia = req.params.licencia;
  console.log(`[${formatDate()}] [SISTEMA] Acceso a página con licencia: ${licencia}`);
  
  res.send(`
    <html>
      <head>
        <title>Servidor ZKTeco</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #333; }
          .container { max-width: 800px; margin: 0 auto; }
          .status { background-color: #dff0d8; padding: 15px; border-radius: 4px; }
          .licencia { background-color: #d9edf7; padding: 15px; border-radius: 4px; margin-top: 20px; }
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
          <div class="licencia">
            <h2>Parámetro de Licencia</h2>
            <p>Licencia: ${licencia}</p>
          </div>
          <h2>Endpoints disponibles:</h2>
          <ul>
            <li><a href="/${licencia}/info">/${licencia}/info</a> - Información del servidor</li>
            <li><a href="/${licencia}/records">/${licencia}/records</a> - Ver registros de asistencia</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// Ruta para inicialización del dispositivo (SIN licencia)
app.get('/iclock/cdata', (req, res) => {
  const { SN, options, pushver, language } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }

  // Registrar dispositivo si es nuevo
  if (!devices[SN]) {
    devices[SN] = {
      lastSeen: new Date(),
      info: {},
      licencia: 'sin_licencia'
    };
    logEvent(SN, 'REGISTRO', { firstConnection: true });
  }
  
  // Actualizar última vez visto
  devices[SN].lastSeen = new Date();
  
  // Log de la inicialización
  logEvent(SN, 'INICIALIZACION', { pushver, language, options });
  
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

// Ruta para inicialización del dispositivo (CON licencia)
app.get('/:licencia/iclock/cdata', (req, res) => {
  const licencia = req.params.licencia;
  const { SN, options, pushver, language } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }

  console.log(`[${formatDate()}] [SISTEMA] Inicialización con licencia: ${licencia}, SN: ${SN}`);

  // Registrar dispositivo si es nuevo
  if (!devices[SN]) {
    devices[SN] = {
      lastSeen: new Date(),
      info: {},
      licencia: licencia
    };
    logEvent(SN, 'REGISTRO', { 
      firstConnection: true, 
      licencia: licencia 
    });
  }
  
  // Actualizar última vez visto
  devices[SN].lastSeen = new Date();
  devices[SN].licencia = licencia; // Actualizar licencia por si cambió
  
  // Log de la inicialización
  logEvent(SN, 'INICIALIZACION', { 
    pushver, 
    language, 
    options,
    licencia: licencia 
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

// Ruta para subir registros de asistencia (SIN licencia)
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
      processAttendanceData(SN, body, 'sin_licencia');
      res.status(200).send(`OK: ${body.trim().split('\n').length}`);
      break;
      
    case 'OPERLOG':
      // Datos de operaciones
      logEvent(SN, 'OPERACION', { data: body });
      res.status(200).send('OK: 1');
      break;
      
    case 'options':
      // Datos de configuración del dispositivo
      processOptions(SN, body, 'sin_licencia');
      res.status(200).send('OK');
      break;
      
    default:
      logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body });
      res.status(200).send('OK');
  }
});

// Ruta para subir registros de asistencia (CON licencia)
app.post('/:licencia/iclock/cdata', (req, res) => {
  const licencia = req.params.licencia;
  const { SN, table, Stamp } = req.query;
  const body = req.body;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  console.log(`[${formatDate()}] [SISTEMA] Recepción de datos con licencia: ${licencia}, SN: ${SN}, tabla: ${table}`);
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
    devices[SN].licencia = licencia; // Actualizar licencia por si cambió
  }
  
  // Procesar según el tipo de tabla
  switch (table) {
    case 'ATTLOG':
      // Datos de marcación de asistencia
      processAttendanceData(SN, body, licencia);
      res.status(200).send(`OK: ${body.trim().split('\n').length}`);
      break;
      
    case 'OPERLOG':
      // Datos de operaciones
      logEvent(SN, 'OPERACION', { data: body, licencia });
      res.status(200).send('OK: 1');
      break;
      
    case 'options':
      // Datos de configuración del dispositivo
      processOptions(SN, body, licencia);
      res.status(200).send('OK');
      break;
      
    default:
      logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body, licencia });
      res.status(200).send('OK');
  }
});

// Ruta para obtener comandos (SIN licencia)
app.get('/iclock/getrequest', (req, res) => {
  const { SN } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
  }
  
  logEvent(SN, 'SOLICITUD_COMANDO', {});
  
  // Por defecto, no enviamos comandos
  res.status(200).send('OK');
});

// Ruta para obtener comandos (CON licencia)
app.get('/:licencia/iclock/getrequest', (req, res) => {
  const licencia = req.params.licencia;
  const { SN } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  console.log(`[${formatDate()}] [SISTEMA] Solicitud de comando con licencia: ${licencia}, SN: ${SN}`);
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
    devices[SN].licencia = licencia; // Actualizar licencia por si cambió
  }
  
  logEvent(SN, 'SOLICITUD_COMANDO', { licencia });
  
  // Por defecto, no enviamos comandos
  res.status(200).send('OK');
});

// Ruta de información (SIN licencia)
app.get('/info', (req, res) => {
  const info = {
    devices: Object.keys(devices),
    totalDevices: Object.keys(devices).length,
    totalAttendanceRecords: attendanceRecords.length,
    serverTime: new Date()
  };
  
  res.json(info);
});

// Ruta de información (CON licencia)
app.get('/:licencia/info', (req, res) => {
  const licencia = req.params.licencia;
  
  // Filtrar dispositivos por licencia
  const dispositivosConLicencia = Object.entries(devices)
    .filter(([_, device]) => device.licencia === licencia)
    .map(([sn, _]) => sn);
  
  const info = {
    licencia,
    devices: dispositivosConLicencia,
    totalDevices: dispositivosConLicencia.length,
    totalAttendanceRecords: attendanceRecords.filter(record => record.licencia === licencia).length,
    serverTime: new Date()
  };
  
  res.json(info);
});

// Ruta de registros (SIN licencia)
app.get('/records', (req, res) => {
  res.json(attendanceRecords);
});

// Ruta de registros (CON licencia)
app.get('/:licencia/records', (req, res) => {
  const licencia = req.params.licencia;
  
  // Filtrar registros por licencia
  const registrosConLicencia = attendanceRecords.filter(
    record => record.licencia === licencia
  );
  
  res.json(registrosConLicencia);
});

// Función para procesar datos de asistencia
function processAttendanceData(deviceSN, data, licencia) {
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
        licencia // Guardar la licencia con el registro
      };
      
      // Almacenar registro
      attendanceRecords.push(attendanceRecord);
      
      // Log del marcaje
      logEvent(deviceSN, 'MARCAJE', {
        ...attendanceRecord,
        licencia
      });
    }
  });
  
  // Estadísticas
  console.log(`=== Marcajes Recibidos: ${records.length} ===`);
  console.log(`=== Total de Marcajes: ${attendanceRecords.length} ===`);
}

// Función para procesar opciones del dispositivo
function processOptions(deviceSN, data, licencia) {
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
  
  // Log con licencia
  logEvent(deviceSN, 'CONFIGURACION', {
    ...options,
    licencia
  });
}

// Inicio del servidor
app.listen(port, () => {
  console.log('=================================================');
  console.log(`  Servidor ZKTeco corriendo en puerto ${port}`);
  console.log('  Endpoints disponibles:');
  console.log('  - GET  /       : Página principal');
  console.log('  - GET  /info   : Información del servidor');
  console.log('  - GET  /records: Ver registros de asistencia');
  console.log('  - GET  /:licencia       : Página con licencia');
  console.log('  - GET  /:licencia/info   : Info con licencia');
  console.log('  - GET  /:licencia/records: Registros con licencia');
  console.log('=================================================');
});
