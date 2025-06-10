const wppconnect = require('@wppconnect-team/wppconnect');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// =================================================================
// --- CONFIGURACIÓN ---
// =================================================================

const GEMINI_API_KEY = "AIzaSyDdrQ3USvyaUk8SFq01B1CunboFGHbH84o";
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
Actúa como 'Valentina', un asesor experta y precisa de Soluciones de Pago MX...
(El resto del prompt de Valentina va aquí, exactamente como lo tenías)
`;

// =================================================================
// --- INICIALIZACIÓN DE SERVICIOS ---
// =================================================================

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
const conversationHistory = {};

// =================================================================
// --- CREACIÓN DEL CLIENTE WPPCONNECT (CORRECCIÓN FINAL PARA LA NUBE) ---
// =================================================================

wppconnect
  .create({
    session: 'valentina-session',
    catchQR: (base64Qr, asciiQR) => {
      console.log(base64Qr); // El log de Koyeb mostrará este texto largo
    },
    statusFind: (statusSession, session) => {
      console.log('Estado de la sesión:', statusSession);
    },
    puppeteerOptions: {
      // ESTA LÍNEA ES LA CORRECCIÓN. Le dice al sistema que no use su propio Chrome.
      args: ['--no-sandbox']
    }
  })
  .then((client) => start(client))
  .catch((e) => console.log('Error al crear el cliente: ', e));


// =================================================================
// --- LÓGICA DEL BOT ---
// =================================================================

function start(client) {
  client.onMessage(async (message) => {
    if (message.isGroupMsg || !message.body) return;

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
            await client.sendText(userId, msg);
        }
    } catch (err) {
        console.error('Error procesando con Gemini:', err.message);
        await client.sendText(userId, 'Hubo un error al conectar con la IA. Intenta de nuevo.');
    }
  });
}
