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
      
      // Log del marcaje
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

// MIDDLEWARE PARA CAPTURAR TODAS LAS SOLICITUDES
// Este middleware se ejecutará para TODAS las solicitudes, independientemente de la ruta
app.use((req, res, next) => {
  const fullPath = req.path;
  const method = req.method;
  const query = req.query;
  const { SN, table, Stamp, options, pushver, language } = req.query;
  const body = req.body;
  
  console.log(`=== Solicitud recibida: ${method} ${fullPath} ===`);
  
  // Verificar si la ruta contiene "/41038/iclock/"
  if (fullPath.includes('/41038/iclock/')) {
    // Manejar según la parte final de la ruta
    if (fullPath.endsWith('/iclock/cdata')) {
      if (method === 'GET') {
        // Inicialización del dispositivo
        if (!SN) {
          return res.status(400).send('Error: SN no proporcionado');
        }
        
        // Registrar dispositivo si es nuevo
        if (!devices[SN]) {
          devices[SN] = {
            lastSeen: new Date(),
            info: {}
          };
          logEvent(SN, 'REGISTRO', { firstConnection: true, path: fullPath });
        }
        
        // Actualizar última vez visto
        devices[SN].lastSeen = new Date();
        
        // Log de la inicialización
        logEvent(SN, 'INICIALIZACION', { 
          pushver, 
          language, 
          options,
          path: fullPath
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
        }
        
        // Procesar según el tipo de tabla
        switch (table) {
          case 'ATTLOG':
            // Datos de marcación de asistencia
            processAttendanceData(SN, body);
            return res.status(200).send(`OK: ${body.trim().split('\n').length}`);
            
          case 'OPERLOG':
            // Datos de operaciones
            logEvent(SN, 'OPERACION', { data: body, path: fullPath });
            return res.status(200).send('OK: 1');
            
          case 'options':
            // Datos de configuración del dispositivo
            processOptions(SN, body);
            return res.status(200).send('OK');
            
          default:
            logEvent(SN, 'DATOS_DESCONOCIDOS', { table, body, path: fullPath });
            return res.status(200).send('OK');
        }
      }
    } 
    else if (fullPath.endsWith('/iclock/getrequest')) {
      // Solicitud de comandos
      if (!SN) {
        return res.status(400).send('Error: SN no proporcionado');
      }
      
      // Actualizar última vez visto
      if (devices[SN]) {
        devices[SN].lastSeen = new Date();
      }
      
      logEvent(SN, 'SOLICITUD_COMANDO', { path: fullPath });
      
      // Por defecto, no enviamos comandos
      return res.status(200).send('OK');
    }
    
    // Para cualquier otra ruta que contenga /41038/iclock/ pero no coincida con los patrones anteriores
    logEvent('RUTA_ICLOCK', '41038', {
      path: fullPath,
      method,
      query,
      body: typeof body === 'object' ? JSON.stringify(body) : body ? body.toString() : '',
      receivedAt: new Date()
    });
    
    // Responder siempre con OK para evitar errores
    return res.status(200).send('OK');
  }
  
  // Si la ruta empieza con /41038 pero no contiene /iclock/
  if (fullPath.startsWith('/41038')) {
    logEvent('RUTA_41038', 'GENERAL', {
      path: fullPath,
      method,
      query,
      body: typeof body === 'object' ? JSON.stringify(body) : body ? body.toString() : '',
      receivedAt: new Date()
    });
    
    // Responder siempre con OK para evitar errores
    return res.status(200).send('OK');
  }
  
  // Para las rutas que no coinciden con ninguno de los patrones anteriores,
  // continuamos con el flujo normal de Express
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
            <li>El servidor captura todas las rutas que contengan /41038/iclock/</li>
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

// Inicio del servidor
app.listen(port, () => {
  console.log('=================================================');
  console.log(`  Servidor ZKTeco corriendo en puerto ${port}`);
  console.log('  El servidor ha sido configurado para capturar');
  console.log('  todas las solicitudes con /41038/iclock/ en la ruta');
  console.log('=================================================');
});
