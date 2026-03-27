// ==========================================
// Netlify Serverless Function: generate-autoliderazgo
// Genera análisis personalizado de Autoliderazgo con Claude AI
// 3 grupos paralelos desde frontend para evitar timeout 30s
// ==========================================

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
        if (!profile || !profile.scores) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos incompletos" }) };
        }

        const p = profile;
        const firstName = p.name.split(' ')[0];

        const dimInfo = [
            { key: 'autoconciencia', name: 'Autoconciencia', desc: 'Reconocer emociones, valores y patrones de comportamiento', preguntas: 4 },
            { key: 'autogestion', name: 'Autogestión', desc: 'Planificar, organizar tiempo y mantener enfoque en metas', preguntas: 5 },
            { key: 'regulacion_emocional', name: 'Regulación Emocional', desc: 'Manejar emociones ante presión o conflicto', preguntas: 1 },
            { key: 'motivacion', name: 'Motivación', desc: 'Impulso interno para sostenerse ante desafíos', preguntas: 3 },
            { key: 'adaptabilidad', name: 'Adaptabilidad', desc: 'Flexibilidad para ajustarse a cambios y aprender de errores', preguntas: 2 }
        ];

        const scoresSummary = dimInfo.map(d =>
            `${d.name}: ${p.scores[d.key]}% (Nivel: ${p.niveles[d.key] || 'N/A'}, ${d.preguntas} preguntas)`
        ).join('\n');

        const base = `Eres una coach de equipos de BuenTrato.AI. Escribes un informe de autoliderazgo para ${firstName}, ${p.role} en ${p.company} (área: ${p.area}).

DATOS INTERNOS (para tu análisis — NO cites porcentajes en cada oración, úsalos con moderación):
Índice General: ${p.totalGeneral}% (${p.nivelGeneral})
${scoresSummary}

Nota técnica interna: Regulación Emocional tiene solo 1 pregunta (dato limitado), Adaptabilidad tiene 2. No sobre-interpretes esas dimensiones.

Reglas:
- Usa "tú". Español latinoamericano. Tono cálido y directo, como un coach que te conoce.
- Traduce los datos a lenguaje cotidiano: en vez de "tu autogestión es 80%" di "eres bueno/a organizándote y cumpliendo lo que te propones". Puedes mencionar un porcentaje ocasionalmente para dar contexto, pero no en cada oración.
- Los nombres de las dimensiones son intuitivos y se pueden usar, pero el foco debe estar en comportamientos concretos y consejos prácticos.
- Enfócate en lo práctico: qué hace bien, qué puede mejorar, y CÓMO hacerlo.
- NO uses viñetas, listas numeradas ni bullets. Escribe en prosa fluida.
- Para los tips: escribe cada tip como un párrafo corto (2-3 oraciones) con un título en negritas al inicio.
- Responde SOLO JSON válido sin markdown.`;

        let prompt;

        if (group === "resumen") {
            prompt = base + `

Genera un análisis general personalizado:
{
  "resumen_titulo": "Frase de 4-8 palabras que defina su perfil de autoliderazgo (ej: 'Liderazgo personal con bases sólidas')",
  "resumen_texto": "2-3 párrafos describiendo cómo ${firstName} se lidera a sí mismo/a. Qué hace bien, dónde tiene espacio para crecer, y cómo se nota en su día a día como ${p.role}. Lenguaje práctico y cercano."
}`;

        } else if (group === "dimensiones_1") {
            prompt = base + `

Genera análisis detallado para estas 3 dimensiones. Para cada una incluye qué significa su puntaje específico, cómo se manifiesta en el trabajo, y 2 tips prácticos.

{
  "autoconciencia_analisis": "1-2 párrafos sobre qué tan bien ${firstName} se conoce a sí mismo/a: sus emociones, sus valores, sus patrones de comportamiento. Cómo se nota en su día a día.",
  "autoconciencia_tip1_titulo": "Título corto del tip 1 (3-5 palabras)",
  "autoconciencia_tip1": "2-3 oraciones con tip práctico y concreto.",
  "autoconciencia_tip2_titulo": "Título corto del tip 2",
  "autoconciencia_tip2": "2-3 oraciones con tip práctico.",
  "autogestion_analisis": "1-2 párrafos sobre cómo ${firstName} se organiza, planifica y mantiene el enfoque en sus metas. Qué hace bien y dónde puede mejorar.",
  "autogestion_tip1_titulo": "Título corto del tip 1",
  "autogestion_tip1": "2-3 oraciones con tip práctico.",
  "autogestion_tip2_titulo": "Título corto del tip 2",
  "autogestion_tip2": "2-3 oraciones con tip práctico.",
  "regulacion_emocional_analisis": "1 párrafo breve sobre cómo ${firstName} maneja sus emociones bajo presión o conflicto. Mantén el análisis breve y proporcionado.",
  "regulacion_emocional_tip1_titulo": "Título corto del tip 1",
  "regulacion_emocional_tip1": "2-3 oraciones con tip práctico.",
  "regulacion_emocional_tip2_titulo": "Título corto del tip 2",
  "regulacion_emocional_tip2": "2-3 oraciones con tip práctico."
}`;

        } else if (group === "dimensiones_2") {
            prompt = base + `

Genera análisis detallado para estas 2 dimensiones. Para cada una incluye qué significa su puntaje específico, cómo se manifiesta en el trabajo, y 2 tips prácticos.

{
  "motivacion_analisis": "1-2 párrafos sobre qué impulsa a ${firstName} a seguir adelante cuando las cosas se ponen difíciles. Qué le da energía y qué podría agotar su motivación.",
  "motivacion_tip1_titulo": "Título corto del tip 1 (3-5 palabras)",
  "motivacion_tip1": "2-3 oraciones con tip práctico.",
  "motivacion_tip2_titulo": "Título corto del tip 2",
  "motivacion_tip2": "2-3 oraciones con tip práctico.",
  "adaptabilidad_analisis": "1 párrafo sobre cómo ${firstName} se adapta a los cambios y aprende de los errores. Breve y práctico.",
  "adaptabilidad_tip1_titulo": "Título corto del tip 1",
  "adaptabilidad_tip1": "2-3 oraciones con tip práctico.",
  "adaptabilidad_tip2_titulo": "Título corto del tip 2",
  "adaptabilidad_tip2": "2-3 oraciones con tip práctico."
}`;

        } else {
            return { statusCode: 400, body: JSON.stringify({ error: "Grupo no válido. Use: resumen, dimensiones_1, dimensiones_2" }) };
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
                max_tokens: 2000,
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
