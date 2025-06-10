const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// =================================================================
// --- CONFIGURACIÓN ---
// =================================================================

// 1. OBTÉN TU API KEY DE: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = "AQUI_TU_AP"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=GEMINI_API_KEY"I_KEY_DE_GEMINI"; // <-- REEMPLAZA ESTO

// 2. SIMULACIÓN DE LA BASE DE CONOCIMIENTO (Como si la leyera de la hoja)
const BASE_DE_CONOCIMIENTO_TEXTO = `
--- TERMINAL: Mercado Pago ---
Formalidad: Ideal para negocios informales y emprendedores.
Requiere_RFC: No, para empezar.
Comision_Unica: Aproximadamente 2.89% + IVA.
Costo_Inicial: $899 MXN.
Ventaja_Clave: Sin renta mensual y fácil de empezar a usar.

--- TERMINAL: Spin by Oxxo ---
Formalidad: Para negocios pequeños, informales o formales.
Requiere_RFC: No es estrictamente necesario para empezar.
Comision_Unica: Alrededor de 3.5% + IVA.
Costo_Inicial: $499 MXN.
Ventaja_Clave: Costo inicial bajo y se compra en cualquier Oxxo.

--- TERMINAL: Getnet ---
Formalidad: Enfocado en negocios ya establecidos y formales.
Requiere_RFC: Sí, es un requisito.
Comision_Unica: Varía según el giro, pero suele ser competitiva.
Costo_Inicial: Renta mensual de $200 MXN + IVA.
Ventaja_Clave: Funciones más avanzadas y reportes detallados para negocios que lo necesitan.
`;

// 3. PROMPT DEL SISTEMA (La personalidad de "Valentina")
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

// =================================================================
// --- INICIALIZACIÓN DE SERVICIOS ---
// =================================================================

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
});

// =================================================================
// --- LÓGICA DEL BOT ---
// =================================================================

const conversationHistory = {}; // Objeto para guardar el historial por usuario

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Bot "Valentina" conectado y funcionando con Gemini.');
});

client.on('message', async message => {
  if (message.fromMe) return;

  const userId = message.from;

  // Inicializa el historial si es un usuario nuevo
  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [
      {
        role: "user",
        parts: [{ text: PROMPT_SISTEMA }],
      },
      {
        role: "model",
        parts: [{ text: "Entendido. Soy Valentina, lista para asesorar." }],
      },
    ];
  }

  try {
    // Inicia una sesión de chat con el historial del usuario
    const chat = model.startChat({
      history: conversationHistory[userId],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(message.body);
    const response = await result.response;
    const rawText = response.text();

    // Actualiza el historial con el último mensaje y la respuesta del bot
    conversationHistory[userId].push({ role: "user", parts: [{ text: message.body }] });
    conversationHistory[userId].push({ role: "model", parts: [{ text: rawText }] });

    // Divide la respuesta en múltiples mensajes usando [FIN_MENSAJE]
    const mensajes = rawText.split('[FIN_MENSAJE]').map(msg => msg.trim()).filter(msg => msg);

    for (const msg of mensajes) {
      await client.sendMessage(userId, msg);
    }

  } catch (err) {
    console.error('Error procesando con Gemini:', err);
    await message.reply('Hubo un error al conectar con la IA. Por favor, intenta de nuevo.');
  }
});

client.initialize();