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

// Middleware para capturar el parámetro de licencia
app.use('/:licencia?', (req, res, next) => {
  req.licenciaParam = req.params.licencia || 'sin_licencia';
  // Solo registrar el parámetro de licencia en el log
  console.log(`[${formatDate()}] [LICENCIA] Acceso con licencia: ${req.licenciaParam}`);
  next();
});

// Ruta raíz para verificar que el servidor está en línea
app.get('/:licencia?', (req, res) => {
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
            <p>Licencia: ${req.licenciaParam}</p>
          </div>
          <h2>Endpoints disponibles:</h2>
          <ul>
            <li><a href="/${req.licenciaParam}/info">/info</a> - Información del servidor</li>
            <li><a href="/${req.licenciaParam}/records">/records</a> - Ver registros de asistencia</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// Ruta para inicialización del dispositivo
app.get('/:licencia?/iclock/cdata', (req, res) => {
  const licenciaParam = req.licenciaParam;
  const { SN, options, pushver, language } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }

  // Registrar dispositivo si es nuevo
  if (!devices[SN]) {
    devices[SN] = {
      lastSeen: new Date(),
      info: {},
      licencia: licenciaParam // Solo almacenar el valor del parámetro
    };
    logEvent(SN, 'REGISTRO', { 
      firstConnection: true, 
      licencia: licenciaParam // Incluir en el log
    });
  }
  
  // Actualizar última vez visto
  devices[SN].lastSeen = new Date();
  
  // Log de la inicialización
  logEvent(SN, 'INICIALIZACION', { 
    pushver, 
    language, 
    options,
    licencia: licenciaParam // Incluir en el log
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
app.post('/:licencia?/iclock/cdata', (req, res) => {
  const licenciaParam = req.licenciaParam;
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
      processAttendanceData(SN, body, licenciaParam);
      res.status(200).send(`OK: ${body.trim().split('\n').length}`);
      break;
      
    case 'OPERLOG':
      // Datos de operaciones
      logEvent(SN, 'OPERACION', { data: body, licencia: licenciaParam });
      res.status(200).send('OK: 1');
      break;
      
    case 'options':
      // Datos de configuración del dispositivo
      processOptions(SN, body, licenciaParam);
      res.status(200).send('OK');
      break;
      
    default:
      logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body, licencia: licenciaParam });
      res.status(200).send('OK');
  }
});

// Ruta para obtener comandos
app.get('/:licencia?/iclock/getrequest', (req, res) => {
  const licenciaParam = req.licenciaParam;
  const { SN } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
  }
  
  logEvent(SN, 'SOLICITUD_COMANDO', { licencia: licenciaParam });
  
  // Por defecto, no enviamos comandos
  res.status(200).send('OK');
});

// Ruta de información
app.get('/:licencia?/info', (req, res) => {
  const licenciaParam = req.licenciaParam;
  
  const info = {
    devices: Object.keys(devices),
    totalDevices: Object.keys(devices).length,
    totalAttendanceRecords: attendanceRecords.length,
    serverTime: new Date(),
    licenciaParam: licenciaParam // Incluir el parámetro de licencia en la información
  };
  
  res.json(info);
});

// Ruta de registros
app.get('/:licencia?/records', (req, res) => {
  // No filtramos por licencia, solo devolvemos todos los registros
  res.json(attendanceRecords);
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
      logEvent(deviceSN, 'MARCAJE', attendanceRecord);
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
  
  // Incluir la licencia en el log
  logEvent(deviceSN, 'CONFIGURACION', { ...options, licencia });
}

// Inicio del servidor
app.listen(port, () => {
  console.log('=================================================');
  console.log(`  Servidor ZKTeco corriendo en puerto ${port}`);
  console.log('  Endpoints disponibles:');
  console.log('  - GET  /:licencia       : Página principal');
  console.log('  - GET  /:licencia/info   : Información del servidor');
  console.log('  - GET  /:licencia/records: Ver registros de asistencia');
  console.log('=================================================');
});
