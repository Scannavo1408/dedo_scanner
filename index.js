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
    console.log(chalk.gray(`[${timestamp}]`) +
        chalk.yellow(` [${deviceSN}]`) +
        chalk.blue(` [${eventType}]`) +
        chalk.white(` ${JSON.stringify(details, null, 2)}`));
};

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

// Ruta para obtener comandos
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

    // Ejemplo: enviamos un comando de chequeo de datos
    // Descomentar para enviar un comando real al dispositivo
    // res.status(200).send('C:123456:CHECK');

    // Por defecto, no enviamos comandos
    res.status(200).send('OK');
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

            // Log del marcaje
            logEvent(deviceSN, 'MARCAJE', attendanceRecord);
        }
    });

    // Estadísticas
    console.log(chalk.green(`\n=== Marcajes Recibidos: ${records.length} ===`));
    console.log(chalk.green(`=== Total de Marcajes: ${attendanceRecords.length} ===\n`));
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

// Ruta para respuesta a comandos
app.post('/iclock/devicecmd', (req, res) => {
    const { SN } = req.query;
    const body = req.body;

    if (!SN) {
        return res.status(400).send('Error: SN no proporcionado');
    }

    logEvent(SN, 'RESPUESTA_COMANDO', { body });
    res.status(200).send('OK');
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

// Inicio del servidor
app.listen(port, () => {
    console.log(chalk.green('================================================='));
    console.log(chalk.green(`  Servidor ZKTeco corriendo en puerto ${port}`));
    console.log(chalk.green('  Desplegado en: ' + (process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`)));
    console.log(chalk.green('  Endpoints disponibles:'));
    console.log(chalk.green('  - GET  /       : Página principal'));
    console.log(chalk.green('  - GET  /info   : Información del servidor'));
    console.log(chalk.green('  - GET  /records: Ver registros de asistencia'));
    console.log(chalk.green('=================================================\n'));
});