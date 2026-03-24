// ==========================================
// Netlify Serverless Function: generate-report
// Genera todas las secciones del informe DISC con Claude AI
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Claude API key no configurada" })
        };
    }

    try {
        const { profile } = JSON.parse(event.body);

        if (!profile || !profile.discNatural) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Datos de perfil incompletos" })
            };
        }

        const discLabels = {
            D: "Dominancia (D) — Directo, decidido, orientado a resultados, competitivo, asume riesgos",
            I: "Influencia (I) — Entusiasta, optimista, colaborativo, expresivo, persuasivo",
            S: "Serenidad (S) — Paciente, confiable, buen oyente, leal, busca estabilidad",
            C: "Cumplimiento (C) — Analítico, preciso, sistemático, cauteloso, orientado a calidad"
        };

        const prompt = `Eres un experto certificado en perfiles DISC de la empresa BuenTrato.AI. Genera un informe personalizado completo para esta persona.

DATOS DEL PARTICIPANTE:
- Nombre: ${profile.name}
- Cargo: ${profile.role}
- Área: ${profile.area}
- Empresa: ${profile.company}

PERFIL DISC NATURAL (personalidad base):
- D (Dominancia): ${profile.discNatural.D}% (puntaje raw: ${profile.rawNatural.D})
- I (Influencia): ${profile.discNatural.I}% (puntaje raw: ${profile.rawNatural.I})
- S (Serenidad): ${profile.discNatural.S}% (puntaje raw: ${profile.rawNatural.S})
- C (Cumplimiento): ${profile.discNatural.C}% (puntaje raw: ${profile.rawNatural.C})

PERFIL DISC ADAPTADO (cómo se comporta en el trabajo):
- D (Dominancia): ${profile.discAdaptado.D}% (puntaje raw: ${profile.rawAdaptado.D})
- I (Influencia): ${profile.discAdaptado.I}% (puntaje raw: ${profile.rawAdaptado.I})
- S (Serenidad): ${profile.discAdaptado.S}% (puntaje raw: ${profile.rawAdaptado.S})
- C (Cumplimiento): ${profile.discAdaptado.C}% (puntaje raw: ${profile.rawAdaptado.C})

Estilo primario Natural: ${discLabels[profile.primaryStyle]}
Estilo secundario Natural: ${discLabels[profile.secondaryStyle]}

INSTRUCCIONES GENERALES:
- Escribe como si hablaras directamente a ${profile.name} (usa "tú")
- Sé específico/a con los datos DISC exactos, no genérico
- Usa un tono cálido, profesional y empoderador
- Escribe en español
- Analiza la diferencia entre Natural y Adaptado — si es grande en alguna dimensión, menciónalo
- NO uses viñetas ni listas numeradas — escribe en prosa fluida
- NO incluyas encabezados ni títulos dentro de cada sección

Genera las siguientes secciones EN FORMATO JSON con estas claves exactas:

{
  "etiqueta_estilo": "Una etiqueta de 3-5 palabras que defina su estilo personal (ej: 'Ejecutiva pragmática y directiva', 'Líder analítico y metódico', 'Comunicador empático y estratégico')",

  "caracteristicas": "2-3 párrafos describiendo sus características comportamentales principales. Incluye cómo se manifiesta su combinación D/I/S/C, sus fortalezas naturales, y cómo su perfil adaptado muestra ajustes al entorno laboral.",

  "estilo_personal": "2 párrafos explicando su estilo personal en profundidad. Cómo lidera, decide, se relaciona con otros, y qué lo distingue.",

  "habilidades_interpersonales": "3 habilidades interpersonales clave, cada una en un párrafo corto (2-3 oraciones). Sepáralas con |||",

  "comunicacion_como_me_comunico": "1-2 párrafos sobre cómo esta persona se comunica naturalmente con otros. Su estilo, ritmo, qué prioriza al comunicar.",

  "comunicacion_como_comunicarte_conmigo": "1-2 párrafos con consejos específicos para que otros se comuniquen efectivamente con esta persona. Qué hacer y qué evitar.",

  "bajo_presion": "2 párrafos sobre cómo se comporta bajo presión o estrés. Qué tendencias afloran, qué riesgos tiene, y cómo puede manejarlas.",

  "adaptacion": "2 párrafos analizando la diferencia entre su perfil Natural y Adaptado. Qué ajustes está haciendo para su entorno laboral, si son sostenibles, y qué significa para su bienestar."
}

IMPORTANTE: Responde ÚNICAMENTE con el JSON válido, sin texto adicional antes o después.`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 3000,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Claude API error:", errText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: "Error al generar informe" })
            };
        }

        const data = await response.json();
        const rawText = data.content[0].text;

        // Intentar parsear JSON de la respuesta
        let sections;
        try {
            // Limpiar posibles backticks de markdown
            const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            sections = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error("JSON parse error:", parseErr, "Raw:", rawText.substring(0, 200));
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Error al procesar respuesta del informe" })
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sections })
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor" })
        };
    }
};
