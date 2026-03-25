exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Claude API key no configurada" }) };
    }

    try {
        const { profile, group } = JSON.parse(event.body);
        if (!profile || !profile.discNatural) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos incompletos" }) };
        }

        const p = profile;
        const base = `Eres un experto certificado en perfiles DISC de BuenTrato.AI. Escribe para ${p.name}, ${p.role} en ${p.company} (área ${p.area}).

DISC Natural: D:${p.discNatural.D}% I:${p.discNatural.I}% S:${p.discNatural.S}% C:${p.discNatural.C}%
DISC Adaptado: D:${p.discAdaptado.D}% I:${p.discAdaptado.I}% S:${p.discAdaptado.S}% C:${p.discAdaptado.C}%
Estilo primario: ${p.primaryStyleName} | Secundario: ${p.secondaryStyleName}

Reglas: Usa "tú". Español. Tono cálido y profesional. Sé específico con los datos DISC. Analiza diferencias Natural vs Adaptado cuando sean significativas. NO uses viñetas ni listas. Escribe en prosa fluida. Responde SOLO JSON válido sin markdown.`;

        let prompt, expectedKeys;

        if (group === "estilo") {
            prompt = base + `

Genera:
{
  "etiqueta_estilo": "Etiqueta de 3-5 palabras que defina su estilo (ej: 'Ejecutiva pragmática y directiva')",
  "caracteristicas": "2-3 párrafos describiendo sus características comportamentales. Incluye cómo se manifiesta su combinación DISC, fortalezas naturales, y cómo el perfil adaptado muestra ajustes al entorno laboral.",
  "estilo_personal": "2 párrafos explicando su estilo personal. Cómo lidera, decide, se relaciona con otros y qué la distingue."
}`;
            expectedKeys = ["etiqueta_estilo", "caracteristicas", "estilo_personal"];

        } else if (group === "interpersonal") {
            prompt = base + `

Genera:
{
  "habilidad_1_titulo": "Título corto de habilidad interpersonal 1",
  "habilidad_1": "Párrafo de 3-4 oraciones describiendo esta habilidad",
  "habilidad_2_titulo": "Título corto de habilidad interpersonal 2",
  "habilidad_2": "Párrafo de 3-4 oraciones describiendo esta habilidad",
  "habilidad_3_titulo": "Título corto de habilidad interpersonal 3",
  "habilidad_3": "Párrafo de 3-4 oraciones describiendo esta habilidad",
  "comunicacion_yo": "1-2 párrafos sobre cómo se comunica naturalmente. Su estilo, ritmo, qué prioriza.",
  "comunicacion_otros": "1-2 párrafos con consejos para comunicarse efectivamente con esta persona. Qué hacer y qué evitar."
}`;
            expectedKeys = ["habilidad_1_titulo", "habilidad_1", "comunicacion_yo", "comunicacion_otros"];

        } else if (group === "contexto") {
            prompt = base + `

Genera:
{
  "bajo_presion": "2 párrafos sobre cómo se comporta bajo presión. Qué tendencias afloran, riesgos, y cómo manejarlas.",
  "adaptacion": "2 párrafos analizando la diferencia entre Natural y Adaptado. Qué ajustes hace para el entorno laboral, si son sostenibles, y qué significa para su bienestar."
}`;
            expectedKeys = ["bajo_presion", "adaptacion"];

        } else {
            return { statusCode: 400, body: JSON.stringify({ error: "Grupo no válido. Use: estilo, interpersonal, contexto" }) };
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1500,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Claude API error:", errText);
            return { statusCode: response.status, body: JSON.stringify({ error: "Error API: " + response.status }) };
        }

        const data = await response.json();
        const rawText = data.content[0].text;

        let parsed;
        try {
            const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.error("Parse error:", e.message, "Raw:", rawText.substring(0, 500));
            return { statusCode: 500, body: JSON.stringify({ error: "Error procesando respuesta" }) };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sections: parsed })
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno" }) };
    }
};
