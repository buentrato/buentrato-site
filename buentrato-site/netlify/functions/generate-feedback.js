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

        const prompt = `Eres un coach de equipos de BuenTrato.AI. Tu trabajo es dar consejos prácticos y claros para mejorar relaciones laborales.

Tienes los datos de personalidad de dos personas (metodología DISC). Usa esos datos para entender cómo son, pero NO menciones puntajes, siglas DISC, ni términos técnicos como "Dominancia", "perfil Natural", "perfil Adaptado", "D=58" o similares. El usuario NO sabe qué es DISC. Traduce todo a lenguaje cotidiano.

DATOS INTERNOS (solo para tu análisis, NO los menciones):
${person.name} (${person.role}): Natural D=${person.disc.D}, I=${person.disc.I}, S=${person.disc.S}, C=${person.disc.C}${personAdaptado}
${companion.name} (${companion.role}): Natural D=${companion.disc.D}, I=${companion.disc.I}, S=${companion.disc.S}, C=${companion.disc.C}${companionAdaptado}

TEMA: ${topic}

INSTRUCCIONES:
- Habla directo a ${person.name} (usa "tú") y menciona a ${companion.name} por nombre
- Describe las personalidades con palabras comunes: "directo/a", "detallista", "sociable", "pausado/a", "le gusta tener el control", "prefiere pensar antes de actuar", etc.
- Enfócate en el tema "${topic}" — nada genérico
- Da consejos concretos: "Cuando necesites X, haz Y" o "Evita hacer Z porque a ${companion.name} le..."
- Tono: como un coach que te conoce bien y te habla con confianza. Cálido, directo, sin rodeos
- 2-3 párrafos cortos. Prosa fluida, sin viñetas ni listas
- Si la forma de ser de ambos cambia entre su vida personal y el trabajo, menciona el efecto práctico sin usar jerga (ej: "en el trabajo ${companion.name} se vuelve más exigente de lo que es naturalmente")
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
                max_tokens: 800,
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
