const fetch = require("node-fetch");

exports.handler = async (event, context) => {
    // Add CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        const body = JSON.parse(event.body);
        const { person1, person2, topic, teamName } = body;

        if (!person1 || !person2 || !topic) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing required fields" })
            };
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" })
            };
        }

        // Build prompt for Claude
        const prompt = `Eres un experto en dinámicas humanas, comportamiento DISC y relaciones interpersonales en contextos laborales latinoamericanos.

Necesito que generes feedback personalizado en español sobre la relación entre dos personas respecto a un tema específico. El feedback debe ser práctico, empático y accionable.

PERSONAS:
- Persona 1: ${person1.name} (${person1.role})
  - Estilo DISC Natural: D=${person1.disc.D}%, I=${person1.disc.I}%, S=${person1.disc.S}%, C=${person1.disc.C}%
  - Estilo Primario: ${person1.primaryStyle}

- Persona 2: ${person2.name} (${person2.role})
  - Estilo DISC Natural: D=${person2.disc.D}%, I=${person2.disc.I}%, S=${person2.disc.S}%, C=${person2.disc.C}%
  - Estilo Primario: ${person2.primaryStyle}

TEMA A ABORDAR: ${topic}
EQUIPO: ${teamName || "Sin especificar"}

Por favor genera feedback con la siguiente estructura en JSON:
{
  "feedback": {
    "strengths": ["Lista de 2-3 fortalezas de su relación respecto a este tema"],
    "challenges": ["Lista de 2-3 desafíos o roces potenciales"],
    "tips": ["Tip 1 para mejorar la comunicación", "Tip 2 específico para ${topic}", "Tip 3 para fortalecer la relación"]
  }
}

El tono debe ser profesional pero cálido, reconociendo las diferencias como oportunidades de aprendizaje mutuo. Incluye referencias a los estilos DISC solo cuando sean relevantes y ayuden a la comprensión.`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Claude API error:", response.status, error);

            // Return fallback feedback
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    feedback: {
                        strengths: [
                            `${person1.name} y ${person2.name} pueden colaborar de manera efectiva en ${topic} aprovechando sus diferencias de estilos.`,
                            "Ambos tienen potencial para aprender mutuamente de sus perspectivas únicas."
                        ],
                        challenges: [
                            "Es importante que ambos reconozcan y respeten sus diferentes enfoques.",
                            "La comunicación explícita sobre expectativas es clave en este tema."
                        ],
                        tips: [
                            `En ${topic}, ${person1.name} debe comunicar claramente sus objetivos y ${person2.name} puede asegurar que se consideren todos los detalles.`,
                            "Acuerden previamente cómo abordarán este tema para evitar malentendidos.",
                            "Celebren los pequeños avances juntos para fortalecer la confianza mutua."
                        ]
                    }
                })
            };
        }

        const data = await response.json();
        const content = data.content[0].text;

        // Try to parse JSON from Claude's response
        let feedback;
        try {
            // Extract JSON from the response (Claude might include extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                feedback = parsed.feedback || parsed;
            } else {
                feedback = {
                    strengths: ["Los estilos de ambos pueden complementarse bien"],
                    challenges: ["Comunicación clara es esencial"],
                    tips: ["Establezcan expectativas claras", "Respeten los diferentes enfoques", "Comuníquense regularmente"]
                };
            }
        } catch (e) {
            console.log("Could not parse Claude JSON, using fallback");
            feedback = {
                strengths: ["Los estilos de ambos pueden complementarse bien"],
                challenges: ["Comunicación clara es esencial"],
                tips: ["Establezcan expectativas claras", "Respeten los diferentes enfoques", "Comuníquense regularmente"]
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ feedback })
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
