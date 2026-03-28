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
        const { climaData, company, memberCount } = body;

        if (!climaData || !company || !memberCount) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos incompletos" }) };
        }

        const systemPrompt = `Eres un asesor estratégico especializado en clima organizacional para equipos de RRHH y ejecutivos.
Tu rol es traducir métricas de clima laboral en oportunidades de negocio y riesgos de retención de talento.

IMPORTANTE:
- Habla directamente al lector (tú/usted) como RRHH/CEO
- NO uses números exactos de scores
- NO uses jerga técnica
- Traduce a lenguaje empresarial práctico
- Enfócate en: sostenibilidad organizacional, riesgos para retención, patrones culturales, comparación con benchmarks
- Usa **negrita** para destacar ideas clave
- Escribe en prosa fluida, no en listas

Proporciona un análisis que hable sobre:
1. El estado general del clima como fortaleza o vulnerabilidad para la organización
2. Qué riesgos concretos enfrentas si no atiendes las áreas débiles
3. Cuál es tu mayor fortaleza y cómo puedes apalancarlo estratégicamente
4. Qué acciones concretas (programas, intervenciones, políticas) deberías considerar`;

        const userPrompt = `Analiza el clima organizacional de ${company} con ${memberCount} miembros basado en estos indicadores:

Seguridad Psicológica: ${climaData.seguridadPsi}
Comunicación: ${climaData.comunicacion}
Valoración: ${climaData.valoracion}
Colaboración: ${climaData.colaboracion}
Liderazgo: ${climaData.liderazgo}
Clima General: ${climaData.general}

Responde en JSON con esta estructura exacta:
{
  "resumen": "2-3 frases sobre el estado general del clima organizacional y su impacto en sostenibilidad",
  "riesgo": "Qué está en riesgo si no se atienden las áreas débiles (retención, productividad, reputación employer)",
  "oportunidad": "Tu área más fuerte y cómo apalancarla estratégicamente",
  "recomendaciones": "3-4 frases con acciones estratégicas concretas (programas, intervenciones, políticas)"
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
