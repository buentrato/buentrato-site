// ==========================================
// Netlify Serverless Function: generate-team-clima
// Genera análisis IA del clima laboral del equipo
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "API no configurada" }) };
    }

    try {
        const { climaData, company, leaderName, memberCount } = JSON.parse(event.body);

        if (!climaData) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos de clima requeridos" }) };
        }

        const prompt = `Eres una coach de equipos de BuenTrato.AI. Estás analizando los resultados de CLIMA LABORAL del equipo de ${leaderName || 'el líder'} en ${company || 'la empresa'} (${memberCount || '?'} personas respondieron).

DATOS INTERNOS (escala 1-5, para tu análisis — NO cites puntajes exactos, traduce a lenguaje cotidiano):
- Seguridad Psicológica: ${climaData.seguridadPsi} de 5
- Comunicación: ${climaData.comunicacion} de 5
- Valoración y Reconocimiento: ${climaData.valoracion} de 5
- Colaboración y Apoyo: ${climaData.colaboracion} de 5
- Liderazgo: ${climaData.liderazgo} de 5
- Clima General: ${climaData.general} de 5

REFERENCIA INTERNA (NO mencionar):
- 4.0+ = Excelente (verde)
- 3.0-3.9 = Bueno/Aceptable (amarillo)
- Menos de 3.0 = Necesita atención (rojo)

REGLAS:
- Habla directo a ${leaderName || 'el líder'} (usa "tú").
- Español latinoamericano. Tono cálido y directo.
- NUNCA cites puntajes numéricos exactos (NO "3.8 de 5"). Traduce a: "tu equipo se siente bastante seguro", "la comunicación está bien pero puede mejorar", "hay una alerta en reconocimiento".
- Usa **negritas** para ideas clave.
- NO uses viñetas ni listas. Prosa fluida.
- Sé específico con recomendaciones.
- Responde SOLO JSON válido sin markdown.

{
  "resumen": "2-3 oraciones: panorama general del clima. Qué se siente bien y qué necesita atención.",
  "fortaleza": "1-2 oraciones: la dimensión más fuerte del equipo y por qué importa.",
  "alerta": "1-2 oraciones: la dimensión más débil o que necesita más atención. Si todo está bien, menciona dónde hay más oportunidad de crecer.",
  "recomendaciones": "2-3 oraciones con acciones concretas que ${leaderName || 'el líder'} puede tomar para mejorar el clima."
}`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1000,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Claude API error:", errText);
            return { statusCode: response.status, body: JSON.stringify({ error: "Error API" }) };
        }

        const data = await response.json();
        const rawText = data.content[0].text;

        let parsed;
        try {
            const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.error("Parse error:", e.message);
            return { statusCode: 500, body: JSON.stringify({ error: "Error procesando respuesta" }) };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ analysis: parsed })
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno" }) };
    }
};
