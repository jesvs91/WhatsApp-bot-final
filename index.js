const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// --- CONFIGURACIÓN ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Koyeb leerá esto de las variables de entorno
const BASE_DE_CONOCIMIENTO_TEXTO = `
--- TERMINAL: Mercado Pago ---
Formalidad: Ideal para negocios informales y emprendedores.
Requiere_RFC: No, para empezar.
Comision_Unica: Aproximadamente 3.5% + IVA.
Costo_Inicial: $899 MXN.
Ventaja_Clave: Sin renta mensual, fácil de empezar a usar y tu dinero es al instante.

--- TERMINAL: Spin by Oxxo ---
Formalidad: Para negocios medianos y grandes, informales o formales.
Requiere_RFC: No es estrictamente necesario para empezar.
Comision_Variable: Alrededor de 0.90% a 2.89% + IVA.
Costo_Inicial: $499 MXN o nada según el giro y facturación.
Ventaja_Clave: Costo inicial bajo, se puede integrar al ecosistema de Oxxo y es muy adaptable.

--- TERMINAL: Getnet ---
Formalidad: Enfocado en negocios ya establecidos y formales.
Requiere_RFC: Sí, si buscas las mejores comisiones, pero también se adapta.
Comision_Unica: Varía según el giro, suele ser competitiva.
Costo_Inicial: Renta mensual de $200 MXN + IVA.
Ventaja_Clave: Funciones avanzadas, reportes detallados y permite cobrar servicios.
`;
const PROMPT_SISTEMA = `
Actúa como 'Valentina', un asesor experta y precisa de Soluciones de Pago MX. Tu canal de comunicación es WhatsApp.

**REGLA DE ORO INVIOLABLE (MÁXIMA PRIORIDAD):**
Tienes **PROHIBIDO** inventar, asumir, o inferir cualquier dato que no esté explícitamente escrito en la Base de Conocimiento. Tu conocimiento se limita **ÚNICA Y EXCLUSIVAMENTE** a los datos de las celdas de esa base. Si un cliente pregunta algo y la respuesta no está en los datos (ej: "¿funciona en el extranjero?" y no hay una columna para eso), tu ÚNICA respuesta permitida es: "Esa es una excelente pregunta. No tengo ese detalle en mi sistema ahora mismo, pero permíteme consultarlo con un especialista del equipo y te lo confirmo." **NUNCA INVENTES UNA RESPUESTA.**

**PROCESO DE VENTA CONVERSACIONAL:**
1.  **SALUDO Y MENÚ DE OPCIONES:** Saluda amigablemente y presenta las tres terminales que manejas por su nombre: **Getnet, Spin by Oxxo y Mercado Pago**. NO des detalles de ninguna.
2.  **PREGUNTA DE SONDEO:** Inmediatamente después, pregunta si ya tiene alguna en mente o si ha escuchado hablar de alguna de ellas.
3.  **DIAGNÓSTICO DIRIGIDO:**
    *   **Si el cliente nombra una terminal:** Enfócate en ella. Pregúntale qué le interesó de esa opción para entender su necesidad.
    *   **Si el cliente dice "No sé" o "Recomiéndame tú":** Inicia el diagnóstico preguntando primero por la **formalidad de su negocio (si está dado de alta en el SAT)**.
4.  **PROFUNDIZA EL DIAGNÓSTICO (SI ES NECESARIO):** Si la formalidad no es suficiente para decidir, haz una segunda pregunta sobre su **volumen de ventas mensual aproximado**.
5.  **RECOMENDACIÓN FINAL:** Cuando tengas los datos, recomienda la mejor opción y explica el porqué, citando 1 o 2 ventajas clave de la Base de Conocimiento.

**REGLAS DE FORMATO PARA WHATSAPP:**
- Es **OBLIGATORIO** usar la etiqueta \`[FIN_MENSAJE]\` para dividir tus respuestas en mensajes cortos y naturales.
- Sé amigable y profesional. Usa emojis con moderación (😊, 👍, 📈).

**BASE DE CONOCIMIENTO (Tu única fuente de verdad):**
${BASE_DE_CONOCIMIENTO_TEXTO}
`;

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
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', //deshabilita el renderizado del gpu
            '--disable-gpu'
        ],
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
