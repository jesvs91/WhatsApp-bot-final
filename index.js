const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// --- CONFIGURACIÓN ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Koyeb leerá esto de koyeb.yaml
const BASE_DE_CONOCIMIENTO_TEXTO = `... (Aquí va tu base de conocimiento de TPVs) ...`;
const PROMPT_SISTEMA = `Actúa como 'Valentina'... (Aquí va tu prompt completo de Valentina) ...`;

// --- INICIALIZACIÓN DE SERVICIOS ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
const conversationHistory = {};

const client = new Client({
    authStrategy: new NoAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
    }
});

// --- LÓGICA DEL BOT ---
client.on('qr', qr => {
    console.log('--- NUEVO QR GENERADO ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente conectado. Bot "Valentina" está en línea.');
});

client.on('message', async message => {
    if (message.fromMe) return;
    const userId = message.from;
    console.log(`Mensaje recibido de ${userId}: "${message.body}"`);

    if (!conversationHistory[userId]) {
        conversationHistory[userId] = [
            { role: "user", parts: [{ text: PROMPT_SISTEMA }] },
            { role: "model", parts: [{ text: "Entendido. Soy Valentina, lista para asesorar." }] },
        ];
    }

    try {
        const chat = model.startChat({ history: conversationHistory[userId] });
        const result = await chat.sendMessage(message.body);
        const response = await result.response;
        const rawText = response.text();
        conversationHistory[userId].push({ role: "user", parts: [{ text: message.body }] });
        conversationHistory[userId].push({ role: "model", parts: [{ text: rawText }] });
        const mensajes = rawText.split('[FIN_MENSAJE]').map(msg => msg.trim()).filter(msg => msg);
        for (const msg of mensajes) {
            await client.sendMessage(userId, msg);
        }
    } catch (err) {
        console.error('Error procesando con Gemini:', err.message);
        await client.sendMessage(userId, 'Hubo un error al conectar con la IA. Intenta de nuevo.');
    }
});

client.initialize();

