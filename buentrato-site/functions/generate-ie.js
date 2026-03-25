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

        const base = `Eres una psicóloga organizacional experta en inteligencia emocional de BuenTrato.AI. Escribes para ${firstName}, ${p.role} en ${p.company} (área: ${p.area}).

Resultados de Inteligencia Emocional:
Índice General: ${p.ieGeneral}% (${p.nivelGeneral})
${scoresSummary}

Escala de niveles: Bajo (≤55%), Medio (56-80%), Alto (>80%)

Reglas:
- Usa "tú". Español latinoamericano. Tono cálido, empático y profesional.
- Sé específica con los datos numéricos.
- NO uses viñetas, listas numeradas ni bullets. Escribe en prosa fluida.
- Para los tips: escribe cada tip como un párrafo corto (2-3 oraciones) con un título en negritas al inicio.
- Responde SOLO JSON válido sin markdown.`;

        let prompt, expectedKeys;

        if (group === "resumen") {
            prompt = base + `

Genera un análisis general personalizado:
{
  "resumen_titulo": "Frase de 4-8 palabras que defina su perfil emocional general (ej: 'Equilibrio emocional con espacio para crecer')",
  "resumen_texto": "2-3 párrafos analizando su perfil general de IE. Menciona sus fortalezas principales (dimensiones más altas), las áreas de oportunidad (dimensiones más bajas), y cómo esta combinación se manifiesta en su rol laboral. Sé específica con los porcentajes. Explica qué significa su nivel general en términos prácticos del día a día."
}`;

        } else if (group === "dimensiones_1") {
            // Autoconciencia, Autorregulación, Motivación
            prompt = base + `

Genera análisis detallado para estas 3 dimensiones. Para cada una incluye qué significa su puntaje específico, cómo se manifiesta en el trabajo, y 2 tips prácticos para mejorar o mantener.

{
  "autoconciencia_analisis": "1-2 párrafos analizando su resultado de ${p.scores.autoconciencia}% en Autoconciencia (${p.niveles.autoconciencia}). Qué significa este nivel en su día a día laboral. Cómo se conecta con sus otras dimensiones.",
  "autoconciencia_tip1_titulo": "Título corto del tip 1 (3-5 palabras)",
  "autoconciencia_tip1": "2-3 oraciones explicando este tip práctico y concreto para su contexto laboral como ${p.role}.",
  "autoconciencia_tip2_titulo": "Título corto del tip 2",
  "autoconciencia_tip2": "2-3 oraciones con otro tip práctico.",
  "autorregulacion_analisis": "1-2 párrafos analizando su resultado de ${p.scores.autorregulacion}% en Autorregulación (${p.niveles.autorregulacion}). Qué significa y cómo impacta en su desempeño.",
  "autorregulacion_tip1_titulo": "Título corto del tip 1",
  "autorregulacion_tip1": "2-3 oraciones con tip práctico.",
  "autorregulacion_tip2_titulo": "Título corto del tip 2",
  "autorregulacion_tip2": "2-3 oraciones con tip práctico.",
  "motivacion_analisis": "1-2 párrafos analizando su resultado de ${p.scores.motivacion}% en Motivación (${p.niveles.motivacion}). Qué impulsa y qué podría frenar su motivación.",
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
  "empatia_analisis": "1-2 párrafos analizando su resultado de ${p.scores.empatia}% en Empatía (${p.niveles.empatia}). Cómo se manifiesta en su interacción con el equipo y cómo se conecta con sus otras dimensiones.",
  "empatia_tip1_titulo": "Título corto del tip 1 (3-5 palabras)",
  "empatia_tip1": "2-3 oraciones con tip práctico y concreto para su contexto.",
  "empatia_tip2_titulo": "Título corto del tip 2",
  "empatia_tip2": "2-3 oraciones con tip práctico.",
  "habilidades_sociales_analisis": "1-2 párrafos analizando su resultado de ${p.scores.habilidades_sociales}% en Habilidades Sociales (${p.niveles.habilidades_sociales}). Cómo impacta su capacidad de colaborar y liderar.",
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
