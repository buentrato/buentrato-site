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
        const { estilosData, company, memberCount } = body;

        if (!estilosData || !company || !memberCount) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos incompletos" }) };
        }

        const systemPrompt = `Eres un asesor estratégico especializado en Aprendizaje y Desarrollo (L&D) para equipos de RRHH y ejecutivos.
Tu rol es ayudar a líderes a diseñar estrategias de capacitación y comunicación que se alineen con cómo aprende su organización.

IMPORTANTE:
- Habla directamente al lector (tú/usted) como RRHH/CEO
- NO uses porcentajes exactos
- NO uses jerga técnica
- Traduce a lenguaje empresarial práctico
- Enfócate en: diseño de programas de capacitación empresarial, estrategia L&D, estrategia de comunicación interna
- Usa **negrita** para destacar ideas clave
- Escribe en prosa fluida, no en listas

Proporciona un análisis que hable sobre:
1. Cómo aprende tu organización y qué significa esto para diseño de capacitación
2. Qué riesgos enfrentas si tus programas de capacitación no se alinean con estos estilos
3. Cómo aprovechar la diversidad de estilos como fortaleza organizacional
4. Qué cambios en L&D y comunicación deberías implementar`;

        const userPrompt = `Analiza los estilos de aprendizaje de ${company} con ${memberCount} miembros basado en esta distribución:

Estilos Visuales: ${estilosData.visualPct} (${estilosData.visualCount} personas, promedio ${estilosData.visualAvg})
Estilos Auditivos: ${estilosData.auditivoPct} (${estilosData.auditivoCount} personas, promedio ${estilosData.auditivoAvg})
Estilos Verbales: ${estilosData.verbalPct} (${estilosData.verbalCount} personas, promedio ${estilosData.verbalAvg})
Estilos Kinestésicos: ${estilosData.kinestesicoPct} (${estilosData.kinestesicoCount} personas, promedio ${estilosData.kinestesicoAvg})

Responde en JSON con esta estructura exacta:
{
  "resumen": "2-3 frases sobre cómo aprende tu organización y qué significa esto para capacitación y comunicación",
  "riesgo": "Qué riesgos enfrentas si tus programas de capacitación y comunicación no se alinean con estos estilos (bajo engagement, baja retención de conocimiento, resistencia al cambio)",
  "oportunidad": "Cómo convertir la diversidad de estilos en fortaleza y qué estilo predominante deberías aprovechar",
  "recomendaciones": "3-4 frases con cambios concretos en L&D y comunicación (formato de capacitaciones, herramientas, estrategias de comunicación interna)"
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
