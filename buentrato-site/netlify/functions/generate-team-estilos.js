// ==========================================
// Netlify Serverless Function: generate-team-estilos
// Genera análisis IA de estilos de aprendizaje del equipo
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
        const { estilosData, company, leaderName, memberCount } = JSON.parse(event.body);

        if (!estilosData) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos requeridos" }) };
        }

        const prompt = `Eres una coach de equipos de BuenTrato.AI. Estás analizando los ESTILOS DE APRENDIZAJE del equipo de ${leaderName || 'el líder'} en ${company || 'la empresa'} (${memberCount || '?'} personas evaluadas).

DATOS INTERNOS (distribución del equipo — para tu análisis, NO cites porcentajes exactos):
- Visual: ${estilosData.visualPct}% del equipo (${estilosData.visualCount} personas). Promedio: ${estilosData.visualAvg}
- Auditivo: ${estilosData.auditivoPct}% del equipo (${estilosData.auditivoCount} personas). Promedio: ${estilosData.auditivoAvg}
- Verbal: ${estilosData.verbalPct}% del equipo (${estilosData.verbalCount} personas). Promedio: ${estilosData.verbalAvg}
- Kinestésico: ${estilosData.kinestesicoPct}% del equipo (${estilosData.kinestesicoCount} personas). Promedio: ${estilosData.kinestesicoAvg}

REFERENCIA INTERNA (NO mencionar):
- Visual: aprende viendo — diagramas, gráficos, videos, mapas mentales
- Auditivo: aprende escuchando — charlas, podcasts, discusiones, explicaciones verbales
- Verbal: aprende leyendo/escribiendo — documentos, emails, resúmenes escritos
- Kinestésico: aprende haciendo — práctica, role-play, talleres, ejercicios manuales

REGLAS:
- Habla directo a ${leaderName || 'el líder'} (usa "tú").
- Español latinoamericano. Tono cálido y directo.
- NO cites porcentajes exactos. Traduce a: "la mayoría de tu equipo aprende mejor viendo", "hay un grupo importante que necesita practicar para entender".
- Da consejos MUY prácticos sobre cómo adaptar reuniones, capacitaciones, comunicaciones.
- Usa **negritas** para ideas clave.
- NO uses viñetas ni listas. Prosa fluida.
- Responde SOLO JSON válido sin markdown.

{
  "resumen": "2-3 oraciones: cómo aprende tu equipo en general. Cuál es el estilo dominante y qué significa para el día a día.",
  "fortaleza": "1-2 oraciones: qué tipo de comunicación y formación le funciona naturalmente al equipo.",
  "alerta": "1-2 oraciones: qué estilo está subrepresentado o descuidado, y qué consecuencias tiene (gente que se pierde en reuniones, que no retiene info, etc).",
  "recomendaciones": "3-4 oraciones con consejos concretos: cómo hacer reuniones, cómo enviar información, cómo capacitar, adaptando a la mezcla de estilos del equipo."
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
            return { statusCode: response.status, body: JSON.stringify({ error: "Error API" }) };
        }

        const data = await response.json();
        const rawText = data.content[0].text;

        let parsed;
        try {
            const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
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
