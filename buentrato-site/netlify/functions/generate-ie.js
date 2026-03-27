// ==========================================
// Netlify Serverless Function: generate-ie
// Genera análisis personalizado de IE con Claude AI
// 2 grupos paralelos desde frontend para evitar timeout 30s
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

        // Build dimension context string
        const dimInfo = [
            { key: 'autoconciencia', name: 'Autoconciencia', desc: 'Reconocer tus emociones y cómo afectan tus pensamientos y comportamiento' },
            { key: 'autorregulacion', name: 'Autorregulación', desc: 'Manejar tus emociones de forma saludable y adaptarte a los cambios' },
            { key: 'motivacion', name: 'Motivación', desc: 'Impulso interno para alcanzar metas y mantener una actitud positiva' },
            { key: 'empatia', name: 'Empatía', desc: 'Comprender las emociones de los demás y responder con sensibilidad' },
            { key: 'habilidades_sociales', name: 'Habilidades Sociales', desc: 'Construir relaciones, comunicarte y colaborar de forma efectiva' }
        ];

        const scoresSummary = dimInfo.map(d =>
            `${d.name}: ${p.scores[d.key]}% (Nivel: ${p.niveles[d.key] || 'N/A'})`
        ).join('\n');

        const base = `Eres una coach de equipos de BuenTrato.AI. Escribes un informe de inteligencia emocional para ${firstName}, ${p.role} en ${p.company} (área: ${p.area}).

DATOS INTERNOS (para tu análisis — NO cites porcentajes en cada oración, úsalos con moderación y solo cuando aporten valor):
Índice General: ${p.ieGeneral}% (${p.nivelGeneral})
${scoresSummary}
Escala: Bajo (≤55%), Medio (56-80%), Alto (>80%)

Reglas:
- Usa "tú". Español latinoamericano. Tono cálido y directo, como un coach que te conoce.
- Traduce los datos a lenguaje cotidiano: en vez de "tu autoconciencia es 72%" di "tienes buena capacidad para reconocer lo que sientes". Puedes mencionar un porcentaje de vez en cuando para dar contexto, pero no en cada oración.
- Los nombres de las dimensiones (Autoconciencia, Empatía, etc.) son intuitivos y se pueden usar, pero el foco debe estar en comportamientos concretos, no en clasificaciones.
- Enfócate en lo práctico: qué hace bien, qué puede mejorar, y CÓMO hacerlo.
- NO uses viñetas, listas numeradas ni bullets. Escribe en prosa fluida.
- Para los tips: escribe cada tip como un párrafo corto (2-3 oraciones) con un título en negritas al inicio.
- Responde SOLO JSON válido sin markdown.`;

        let prompt, expectedKeys;

        if (group === "resumen") {
            prompt = base + `

Genera un análisis general personalizado:
{
  "resumen_titulo": "Frase de 4-8 palabras que defina su perfil emocional general (ej: 'Equilibrio emocional con espacio para crecer')",
  "resumen_texto": "2-3 párrafos describiendo cómo es ${firstName} emocionalmente en el trabajo. Qué hace bien, dónde tiene espacio para crecer, y cómo se nota en su día a día como ${p.role}. Lenguaje práctico y cercano."
}`;

        } else if (group === "dimensiones_1") {
            // Autoconciencia, Autorregulación, Motivación
            prompt = base + `

Genera análisis detallado para estas 3 dimensiones. Para cada una incluye qué significa su puntaje específico, cómo se manifiesta en el trabajo, y 2 tips prácticos para mejorar o mantener.

{
  "autoconciencia_analisis": "1-2 párrafos sobre qué tan bien ${firstName} reconoce sus emociones y cómo estas afectan su trabajo. Lenguaje práctico: qué hace bien y qué puede mejorar.",
  "autoconciencia_tip1_titulo": "Título corto del tip 1 (3-5 palabras)",
  "autoconciencia_tip1": "2-3 oraciones explicando este tip práctico y concreto para su contexto laboral como ${p.role}.",
  "autoconciencia_tip2_titulo": "Título corto del tip 2",
  "autoconciencia_tip2": "2-3 oraciones con otro tip práctico.",
  "autorregulacion_analisis": "1-2 párrafos sobre cómo ${firstName} maneja sus emociones cuando las cosas se ponen difíciles. Qué tan bien se adapta a los cambios y controla impulsos.",
  "autorregulacion_tip1_titulo": "Título corto del tip 1",
  "autorregulacion_tip1": "2-3 oraciones con tip práctico.",
  "autorregulacion_tip2_titulo": "Título corto del tip 2",
  "autorregulacion_tip2": "2-3 oraciones con tip práctico.",
  "motivacion_analisis": "1-2 párrafos sobre qué impulsa a ${firstName} a dar lo mejor y qué podría frenarle. Cómo mantiene la motivación cuando las cosas se complican.",
  "motivacion_tip1_titulo": "Título corto del tip 1",
  "motivacion_tip1": "2-3 oraciones con tip práctico.",
  "motivacion_tip2_titulo": "Título corto del tip 2",
  "motivacion_tip2": "2-3 oraciones con tip práctico."
}`;

        } else if (group === "dimensiones_2") {
            // Empatía, Habilidades Sociales
            prompt = base + `

Genera análisis detallado para estas 2 dimensiones. Para cada una incluye qué significa su puntaje específico, cómo se manifiesta en el trabajo, y 2 tips prácticos para mejorar o mantener.

{
  "empatia_analisis": "1-2 párrafos sobre cómo ${firstName} entiende y responde a lo que sienten los demás. Cómo se nota en su interacción con el equipo.",
  "empatia_tip1_titulo": "Título corto del tip 1 (3-5 palabras)",
  "empatia_tip1": "2-3 oraciones con tip práctico y concreto para su contexto.",
  "empatia_tip2_titulo": "Título corto del tip 2",
  "empatia_tip2": "2-3 oraciones con tip práctico.",
  "habilidades_sociales_analisis": "1-2 párrafos sobre cómo ${firstName} construye relaciones, colabora y se hace escuchar en el equipo. Qué le sale bien y dónde puede mejorar.",
  "habilidades_sociales_tip1_titulo": "Título corto del tip 1",
  "habilidades_sociales_tip1": "2-3 oraciones con tip práctico.",
  "habilidades_sociales_tip2_titulo": "Título corto del tip 2",
  "habilidades_sociales_tip2": "2-3 oraciones con tip práctico."
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
