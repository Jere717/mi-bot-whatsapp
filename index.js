// --- 1. IMPORTAR HERRAMIENTAS --- 
const qrcode = require('qrcode-terminal'); 
const { Client, LocalAuth } = require('whatsapp-web.js'); 
const { GoogleSpreadsheet } = require('google-spreadsheet'); 
const MistralClient = require('@mistralai/mistralai'); 
 
// --- 2. CONFIGURACIÓN INICIAL --- 
const ID_DE_TU_GOOGLE_SHEET = '1jjROnAY1TobjiDYwjHv8YD2i-D_LlwTtw79XZ1i-1Oo'; // Sacado de la URL de tu Google Sheet 
 
// Parsea las credenciales de Google desde la variable de entorno que configuraremos en Koyeb 
// ¡Esto es mucho más seguro que tener el archivo en el servidor! 
const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS); 
 
// --- 3. INICIALIZAR EL CLIENTE DE WHATSAPP --- 
// Usamos LocalAuth para que la sesión se guarde y no tengas que escanear el QR cada vez que se reinicie. 
const client = new Client({ 
authStrategy: new LocalAuth(), 
puppeteer: { 
headless: true, 
args: ['--no-sandbox', '--disable-setuid-sandbox'] // Argumentos necesarios para funcionar en servidores como Koyeb 
} 
}); 
 
// --- 4. EVENTOS DE WHATSAPP --- 
 
// Evento 1: Generar el código QR para escanear 
client.on('qr', qr => { 
console.log('¡Escanea este código QR con tu WhatsApp!'); 
qrcode.generate(qr, { small: true }); 
}); 
 
// Evento 2: Confirmar que la conexión fue exitosa 
client.on('ready', () => { 
console.log('✅ ¡Cliente de WhatsApp conectado y listo!'); 
console.log('         El bot está activo y esperando mensajes...'); 
}); 
 
// Evento 3: ¡El más importante! Escuchar y responder mensajes 
client.on('message', async message => { 
const userMessage = message.body; 
console.log(`Mensaje recibido de ${message.from}: "${userMessage}"`); 
 
try { 
// --- Conexión con Google Sheets --- 
const doc = new GoogleSpreadsheet(ID_DE_TU_GOOGLE_SHEET, { 
apiKey: null, // No usamos API Key, usamos Cuenta de Servicio 
access_token: null, // No usamos token, usamos Cuenta de Servicio 
service_account_auth: creds 
}); 
await doc.loadInfo(); // Cargar la información del documento 
 
// Leer configuración desde la hoja 'Configuracion' 
const configSheet = doc.sheetsByTitle['Configuracion']; 
await configSheet.loadCells('B9:D8'); // Cargar las celdas necesarias 
 
const mistralApiKey = configSheet.getCellByA1('D8').value; 
const botPrompt = configSheet.getCellByA1('B9').value; 
if (!mistralApiKey || !botPrompt) { 
console.error("Error: No se encontró la API Key de Mistral o el Prompt en la hoja de configuración."); 
message.reply("Lo siento, estoy teniendo problemas de configuración. Por favor, contacta a mi administrador."); 
return; 
} 
 
// --- Conexión con Mistral AI --- 
const mistralClient = new MistralClient(mistralApiKey); 
const chatResponse = await mistralClient.chat({ 
model: 'mistral-large-latest', 
messages: [{ role: 'user', content: `${botPrompt}\n\nCliente: ${userMessage}` }], 
}); 
 
const aiResponse = chatResponse.choices[0].message.content; 
 
// Enviar la respuesta de la IA al usuario por WhatsApp 
message.reply(aiResponse); 
console.log(`Respuesta enviada a ${message.from}: "${aiResponse}"`); 
// --- Guardar en la hoja de 'Solicitudes' --- 
const requestsSheet = doc.sheetsByTitle['Solicitudes']; 
await requestsSheet.addRow({ 
Fecha: new Date().toLocaleString(), 
Usuario: message.from, 
Mensaje: userMessage, 
Respuesta_IA: aiResponse 
}); 
 
} catch (error) { 
console.error('Ha ocurrido un error procesando el mensaje:', error); 
message.reply('Lo siento, algo salió mal. Inténtalo de nuevo más tarde.'); 
} 
}); 
 
// --- 5. INICIAR EL BOT --- 
client.initialize(); 
