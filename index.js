// Ruta para capturar el PIN como segmento de URL: /pin/41038
app.get('/pin/:pinId', (req, res) => {
  const pinId = req.params.pinId;
  
  // Guardar el PIN en la sesión o en una variable global
  // para usarlo en otros endpoints si es necesario
  global.currentPin = pinId;
  
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

// También podemos soportar el PIN como parámetro de consulta: /?pin=41038
app.get('/', (req, res) => {
  const pinId = req.query.pin;
  
  // Si se proporciona un PIN, guardarlo
  if (pinId) {
    global.currentPin = pinId;
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
          </div>
          
          ${pinId ? `
          <div class="pin-info">
            <h2>PIN/Empresa seleccionado: ${pinId}</h2>
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
