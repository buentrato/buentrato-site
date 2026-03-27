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
        const base = `Eres un coach de equipos de BuenTrato.AI. Escribes un informe personal para ${p.name}, ${p.role} en ${p.company} (área ${p.area}).

DATOS INTERNOS (para tu análisis, úsalos pero NO cites puntajes como "D=58%" ni siglas sueltas como "D", "I", "S", "C"):
Natural: D:${p.discNatural.D}% I:${p.discNatural.I}% S:${p.discNatural.S}% C:${p.discNatural.C}%
Adaptado: D:${p.discAdaptado.D}% I:${p.discAdaptado.I}% S:${p.discAdaptado.S}% C:${p.discAdaptado.C}%
Estilo primario: ${p.primaryStyleName} | Secundario: ${p.secondaryStyleName}

Reglas:
- Usa "tú". Español latinoamericano. Tono cálido y directo, como un coach que te conoce.
- Traduce los datos a lenguaje cotidiano: en vez de "tu D es 58%" di "tiendes a ser directo/a y tomar el control". En vez de "Natural vs Adaptado" di "cómo eres naturalmente vs cómo te comportas en el trabajo".
- Puedes nombrar las dimensiones por su nombre completo (Dominancia, Influencia, Serenidad, Cumplimiento) cuando sea útil, pero no las conviertas en protagonistas del texto.
- Enfócate en lo que la persona HACE, SIENTE y PUEDE MEJORAR — no en clasificaciones técnicas.
- NO uses viñetas ni listas. Escribe en prosa fluida.
- Responde SOLO JSON válido sin markdown.`;

        let prompt, expectedKeys;

        if (group === "estilo") {
            prompt = base + `

Genera:
{
  "etiqueta_estilo": "Etiqueta de 3-5 palabras que defina su estilo (ej: 'Ejecutiva pragmática y directiva')",
  "caracteristicas": "2-3 párrafos describiendo cómo es esta persona en el día a día. Sus fortalezas naturales, cómo se comporta en el trabajo (si cambia respecto a cómo es naturalmente), y qué la hace única. Lenguaje práctico y cercano.",
  "estilo_personal": "2 párrafos explicando cómo lidera, cómo toma decisiones, cómo se relaciona con otros y qué la distingue. Consejos concretos de cómo aprovechar su estilo."
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
  "comunicacion_yo": "1-2 párrafos sobre cómo te comunicas. Tu estilo, tu ritmo, qué priorizas al hablar con otros. Escrito en lenguaje cotidiano.",
  "comunicacion_otros": "1-2 párrafos con consejos prácticos para que otros se comuniquen mejor contigo. Qué funciona y qué evitar. Tipo: 'Si necesitas algo de ti, ve directo al punto' o 'Dale tiempo para procesar antes de pedir una respuesta'."
}`;
            expectedKeys = ["habilidad_1_titulo", "habilidad_1", "comunicacion_yo", "comunicacion_otros"];

        } else if (group === "contexto") {
            prompt = base + `

Genera:
{
  "bajo_presion": "2 párrafos sobre cómo reaccionas cuando estás bajo presión. Qué comportamientos afloran, qué riesgos hay, y consejos concretos para manejarlo mejor. Lenguaje práctico.",
  "adaptacion": "2 párrafos sobre cómo cambias entre tu forma natural de ser y cómo te comportas en el trabajo. Si esos ajustes te cuestan energía, si son sostenibles, y qué puedes hacer para sentirte más cómodo/a. Sin jerga técnica."
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
