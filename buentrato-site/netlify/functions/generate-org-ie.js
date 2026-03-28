exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "API no configurada" }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { ieData, company, memberCount } = body;

        if (!ieData || !company || !memberCount) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos incompletos" }) };
        }

        const systemPrompt = `Eres un asesor estratégico especializado en inteligencia emocional organizacional para equipos de RRHH y ejecutivos.
Tu rol es ayudar a líderes a entender la madurez emocional de su organización y sus implicaciones para liderazgo, conflicto y retención.

IMPORTANTE:
- Habla directamente al lector (tú/usted) como RRHH/CEO
- NO uses números exactos de scores
- NO uses jerga técnica
- Traduce a lenguaje empresarial práctico
- Enfócate en: madurez emocional organizacional, preparación de pipeline de liderazgo, capacidad de manejo de conflictos
- Usa **negrita** para destacar ideas clave
- Escribe en prosa fluida, no en listas

Proporciona un análisis que hable sobre:
1. El nivel de madurez emocional de la organización y cómo esto afecta liderazgo y cultura
2. Qué riesgos organizacionales existen si no se desarrolla inteligencia emocional
3. Cuál es la competencia emocional más fuerte y cómo fortalecer las demás
4. Qué iniciativas de desarrollo deberían priorizarse`;

        const userPrompt = `Analiza la inteligencia emocional organizacional de ${company} con ${memberCount} miembros basado en estos indicadores:

Autoconciencia: ${ieData.autoconciencia}
Autorregulación: ${ieData.autorregulacion}
Motivación: ${ieData.motivacion}
Empatía: ${ieData.empatia}
Habilidades Sociales: ${ieData.habilidadesSociales}
IE General: ${ieData.general}

Responde en JSON con esta estructura exacta:
{
  "resumen": "2-3 frases sobre la madurez emocional organizacional y su impacto en liderazgo y cultura",
  "riesgo": "Qué riesgos organizacionales existen si no se desarrolla inteligencia emocional (conflictos no resueltos, liderazgo inefectivo, rotación)",
  "oportunidad": "La competencia emocional más fuerte y cómo fortalecerla como ventaja estratégica",
  "recomendaciones": "3-4 frases con iniciativas de desarrollo prioritarias (coaching ejecutivo, programas de liderazgo, desarrollo de habilidades)"
}`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1200,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Claude API error:", errorData);
            return { statusCode: 500, body: JSON.stringify({ error: "Error al consultar API de Claude" }) };
        }

        const data = await response.json();
        const textContent = data.content?.[0]?.text || "";

        // Extract JSON from response
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { statusCode: 500, body: JSON.stringify({ error: "No se pudo extraer análisis válido" }) };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ analysis: parsed })
        };
    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno del servidor" }) };
    }
};
