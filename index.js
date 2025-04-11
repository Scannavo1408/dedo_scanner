const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const chalk = require('chalk');
const app = express();

// Usar la variable de entorno PORT que proporciona Render, o 8081 como respaldo
const port = process.env.PORT || 8081;

// Variable global para almacenar el PIN/Empresa actual
global.currentPin = null;

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

// Ruta para capturar el PIN como segmento de URL: /pin/41038
app.get('/pin/:pinId', (req, res) => {
  const pinId = req.params.pinId;
  
  // Guardar el PIN en la variable global
  global.currentPin = pinId;
  console.log(`PIN/Empresa establecido: ${pinId}`);
  
  // Devolver una página HTML que confirme el PIN seleccionado
  res.send(`
    <html>
      <head>
        <title>Pin Seleccionado</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #333; }
          .container { max-width: 800px; margin: 0 auto; }
          .status { background-color: #dff0d8; padding: 15px; border-radius: 4px; }
          .pin-info { background-color: #d9edf7; padding: 15px; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Servidor de Marcaje ZKTeco</h1>
          <div class="status">
            <p>✅ Servidor funcionando correctamente</p>
          </div>
          <div class="pin-info">
            <h2>PIN/Empresa seleccionado: ${pinId}</h2>
            <p>Todos los marcajes serán procesados para este identificador.</p>
            <p><a href="/">Volver a la página principal</a></p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Ruta raíz para verificar que el servidor está en línea
app.get('/', (req, res) => {
  // Verificar si hay un parámetro de PIN en la consulta
  const pinId = req.query.pin;
  
  // Si se proporciona un PIN en la consulta, guardarlo
  if (pinId) {
    global.currentPin = pinId;
    console.log(`PIN/Empresa establecido desde query: ${pinId}`);
  }

  res.send(`
    <html>
      <head>
        <title>Servidor ZKTeco</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #333; }
          .container { max-width: 800px; margin: 0 auto; }
          .status { background-color: #dff0d8; padding: 15px; border-radius: 4px; }
          .pin-info { background-color: #d9edf7; padding: 15px; border-radius: 4px; margin-top: 20px; }
          ul { margin-top: 20px; }
          form { margin-top: 20px; }
          input, button { padding: 8px; margin-top: 10px; }
          button { background-color: #337ab7; color: white; border: none; cursor: pointer; }
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
            <p>PIN/Empresa actual: ${global.currentPin || 'No establecido'}</p>
          </div>
          
          ${global.currentPin ? `
          <div class="pin-info">
            <h2>PIN/Empresa seleccionado: ${global.currentPin}</h2>
            <p>Todos los marcajes serán procesados para este identificador.</p>
          </div>
          ` : ''}
          
          <form action="/" method="get">
            <h3>Seleccionar PIN/Empresa</h3>
            <input type="text" name="pin" placeholder="Ingrese PIN o ID de empresa" required>
            <button type="submit">Establecer PIN</button>
          </form>
          
          <h2>Endpoints disponibles:</h2>
          <ul>
            <li><a href="/info">/info</a> - Información del servidor</li>
            <li><a href="/records">/records</a> - Ver registros de asistencia</li>
            <li><code>/pin/NUMERO</code> - Establecer PIN o ID de empresa</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// Ruta para inicialización del dispositivo - MANTENER INTACTA
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

// Ruta para subir registros de asistencia - CUIDADO CON ESTA PARTE
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

// Ruta para obtener comandos - MANTENER INTACTA
app.get('/iclock/getrequest', (req, res) => {
  const { SN } = req.query;
  
  if (!SN) {
    return res.status(400).send('Error: SN no proporcionado');
  }
  
  // Actualizar última vez visto
  if (devices[SN]) {
    devices[SN].lastSeen = new Date();
  }
  
  // Para reducir el ruido en los logs, solo registramos comandos si hay un PIN establecido
  if (global.currentPin) {
    logEvent(SN, 'SOLICITUD_COMANDO', { currentPin: global.currentPin });
  }
  
  // Por defecto, no enviamos comandos
  res.status(200).send('OK');
});

// Ruta de información mejorada
app.get('/info', (req, res) => {
  const info = {
    devices: Object.keys(devices).map(sn => ({
      serialNumber: sn,
      lastSeen: devices[sn].lastSeen,
      options: devices[sn].options || {}
    })),
    totalDevices: Object.keys(devices).length,
    totalAttendanceRecords: attendanceRecords.length,
    serverTime: new Date(),
    currentPin: global.currentPin
  };
  
  res.json(info);
});

// Ruta de registros mejorada
app.get('/records', (req, res) => {
  // Filtrar por PIN/Empresa si se especifica en la consulta
  const pinFilter = req.query.pin || global.currentPin;
  let filteredRecords = attendanceRecords;
  
  if (pinFilter) {
    // Si se está filtrando por empresa, mostrar solo los registros de esa empresa
    filteredRecords = attendanceRecords.filter(record => record.empresa === pinFilter);
  }
  
  res.json({
    totalRecords: filteredRecords.length,
    currentPin: global.currentPin,
    records: filteredRecords
  });
});

// Función para procesar datos de asistencia - MODIFICADA
function processAttendanceData(deviceSN, data) {
  const records = data.trim().split('\n');
  const currentEmpresa = global.currentPin || 'default'; // Usar 'default' si no hay PIN establecido
  
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
        empresa: currentEmpresa // Añadir el PIN/Empresa a cada registro
      };
      
      // Almacenar registro
      attendanceRecords.push(attendanceRecord);
      
      // Log del marcaje
      logEvent(deviceSN, 'MARCAJE', {
        ...attendanceRecord,
        empresa: currentEmpresa
      });
      
      // Aquí puedes implementar lógica adicional con el PIN/Empresa
      // Por ejemplo, enviar a una API externa específica para esta empresa
      console.log(`Marcaje procesado para empresa: ${currentEmpresa}`);
    }
  });
  
  // Estadísticas
  console.log(`=== Marcajes Recibidos: ${records.length} ===`);
  console.log(`=== Total de Marcajes: ${attendanceRecords.length} ===`);
  console.log(`=== Empresa/PIN actual: ${currentEmpresa} ===`);
}

// Función para procesar opciones del dispositivo - SIN CAMBIOS
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
  console.log(`  PIN/Empresa actual: ${global.currentPin || 'No establecido'}`);
  console.log('  Endpoints disponibles:');
  console.log('  - GET  /                    : Página principal');
  console.log('  - GET  /pin/:pinId          : Establecer PIN/Empresa');
  console.log('  - GET  /?pin=NUMERO         : Establecer PIN/Empresa (alternativo)');
  console.log('  - GET  /info                : Información del servidor');
  console.log('  - GET  /records             : Ver registros de asistencia');
  console.log('=================================================');
});
