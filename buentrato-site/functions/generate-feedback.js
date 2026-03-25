// ==========================================
// Netlify Serverless Function: generate-feedback
// Llama a Claude API para generar feedback DISC personalizado
// ==========================================

exports.handler = async (event) => {
    // Solo aceptar POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Verificar que la API key está configurada
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Claude API key no configurada" })
        };
    }

    try {
        const { person, companion, topic, topicId } = JSON.parse(event.body);

        const discDescriptions = {
            D: "Dominancia - Directo, decidido, orientado a resultados, competitivo",
            I: "Influencia - Entusiasta, optimista, colaborativo, expresivo",
            S: "Estabilidad - Paciente, confiable, buen oyente, leal",
            C: "Cumplimiento - Analítico, preciso, sistemático, cauteloso"
        };

        // Construir info de perfil adaptado si existe
        const personAdaptado = person.discAdaptado
            ? `\n- Puntajes Adaptado (cómo se comporta en el trabajo): D=${person.discAdaptado.D}, I=${person.discAdaptado.I}, S=${person.discAdaptado.S}, C=${person.discAdaptado.C}`
            : "";
        const companionAdaptado = companion.discAdaptado
            ? `\n- Puntajes Adaptado (cómo se comporta en el trabajo): D=${companion.discAdaptado.D}, I=${companion.discAdaptado.I}, S=${companion.discAdaptado.S}, C=${companion.discAdaptado.C}`
            : "";

        const prompt = `Eres un experto en perfiles DISC y relaciones laborales de la empresa BuenTrato.AI.

Genera un análisis personalizado y práctico para mejorar la relación entre dos personas de un equipo de trabajo.

PERSONA 1 (quien consulta):
- Nombre: ${person.name}
- Rol: ${person.role}
- Perfil DISC principal: ${discDescriptions[person.primaryStyle]}
- Puntajes Natural (personalidad base): D=${person.disc.D}, I=${person.disc.I}, S=${person.disc.S}, C=${person.disc.C}${personAdaptado}

PERSONA 2 (compañero/a):
- Nombre: ${companion.name}
- Rol: ${companion.role}
- Perfil DISC principal: ${discDescriptions[companion.primaryStyle]}
- Puntajes Natural (personalidad base): D=${companion.disc.D}, I=${companion.disc.I}, S=${companion.disc.S}, C=${companion.disc.C}${companionAdaptado}

TEMA ESPECÍFICO: ${topic}

INSTRUCCIONES:
- Escribe como si hablaras directamente a ${person.name} (usa "tú")
- Menciona a ${companion.name} por su nombre
- Sé específico al tema "${topic}" — no des consejos genéricos
- Usa un tono cálido pero profesional
- Considera los puntajes exactos DISC (tanto Natural como Adaptado si están disponibles), no solo el estilo primario
- Si hay diferencia significativa entre Natural y Adaptado, menciona cómo eso afecta la dinámica
- Da 2-3 párrafos cortos con insights profundos y accionables
- No uses viñetas ni listas — escribe en prosa fluida
- Escribe en español
- No incluyas encabezados ni títulos`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 600,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Claude API error:", errText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: "Error al generar feedback" })
            };
        }

        const data = await response.json();
        const feedback = data.content[0].text;

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback })
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor" })
        };
    }
};
