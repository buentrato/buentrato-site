// ==========================================
// Netlify Serverless Function: generate-team-ie
// Genera análisis IA de inteligencia emocional del equipo
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
        const { ieData, company, leaderName, memberCount, members, leaderEmail } = JSON.parse(event.body);

        if (!ieData) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos de IE requeridos" }) };
        }

        // Build per-person detail — separate leader (tú) from team members
        let memberDetails = '';
        let leaderDetail = '';
        if (members && members.length > 0) {
            const teamMembers = [];

            members.forEach(m => {
                const ie = m.ie;
                const dims = [
                    { key: 'autoconciencia', label: 'Autoconciencia' },
                    { key: 'autorregulacion', label: 'Autorregulación' },
                    { key: 'motivacion', label: 'Motivación' },
                    { key: 'empatia', label: 'Empatía' },
                    { key: 'habilidadesSociales', label: 'Hab.Sociales' }
                ];
                const sorted = [...dims].sort((a, b) => (ie[b.key] || 0) - (ie[a.key] || 0));
                const strongest = sorted[0];
                const weakest = sorted[sorted.length - 1];
                const line = `Fortaleza=${strongest.label}(${ie[strongest.key]}), Área de crecimiento=${weakest.label}(${ie[weakest.key]}), General=${ie.general}`;

                if (leaderEmail && m.email && m.email.toLowerCase() === leaderEmail.toLowerCase()) {
                    leaderDetail = `\nTU PERFIL (${leaderName}): ${line} — Recuerda: a esta persona le hablas de "tú", NO la menciones en tercera persona.\n`;
                } else {
                    teamMembers.push(`- ${m.name}: ${line}`);
                }
            });

            if (teamMembers.length > 0) {
                memberDetails = '\nPERFIL DE CADA MIEMBRO DEL EQUIPO (menciona por nombre en las recomendaciones):\n' + teamMembers.join('\n') + '\n';
            }
        }

        const prompt = `Eres una coach de equipos de BuenTrato.AI. Estás analizando los resultados de INTELIGENCIA EMOCIONAL del equipo de ${leaderName || 'el líder'} en ${company || 'la empresa'} (${memberCount || '?'} personas evaluadas).

DATOS INTERNOS (promedios del equipo, escala 1-5 donde 5 es el máximo. Para tu análisis — NO cites puntajes exactos):
- Autoconciencia: ${ieData.autoconciencia} de 5
- Autorregulación: ${ieData.autorregulacion} de 5
- Motivación: ${ieData.motivacion} de 5
- Empatía: ${ieData.empatia} de 5
- Habilidades Sociales: ${ieData.habilidadesSociales} de 5
- IE General: ${ieData.general} de 5
${leaderDetail}${memberDetails}
REFERENCIA INTERNA (NO mencionar):
- 4.0+ = Alto (verde) — capacidad bien desarrollada
- 3.0-3.9 = Medio (amarillo) — funcional pero con espacio de mejora
- Menos de 3.0 = Bajo (rojo) — necesita desarrollo

REGLAS:
- Habla directo a ${leaderName || 'el líder'} (usa "tú").
- Español latinoamericano. Tono cálido y directo.
- NUNCA cites puntajes numéricos exactos. Traduce a: "tu equipo tiene muy buena empatía", "la autorregulación es un área que necesita trabajo".
- En las recomendaciones, MENCIONA A LOS MIEMBROS DEL EQUIPO POR NOMBRE cuando sea relevante. Ejemplo: "Con María podrías trabajar la autorregulación — ayúdala a identificar sus disparadores emocionales. Pedro en cambio tiene una empatía muy desarrollada, apóyate en él para mediar conversaciones difíciles."
- IMPORTANTE: Al líder (${leaderName}) siempre háblale de "tú". NUNCA lo menciones en tercera persona. Los demás miembros sí puedes mencionarlos por nombre.
- Explica cada dimensión en términos prácticos del día a día.
- Usa **negritas** para ideas clave.
- NO uses viñetas ni listas. Prosa fluida.
- Responde SOLO JSON válido sin markdown.

{
  "resumen": "2-3 oraciones: panorama general de la inteligencia emocional del equipo. Qué tan bien manejan sus emociones como grupo.",
  "fortaleza": "1-2 oraciones: la dimensión emocional más fuerte del equipo. Cómo se nota en el trabajo diario.",
  "alerta": "1-2 oraciones: la dimensión más débil o con más oportunidad de crecimiento. Qué consecuencias tiene en el día a día.",
  "recomendaciones": "3-5 oraciones con acciones concretas MENCIONANDO PERSONAS POR NOMBRE: qué trabajar con quién, en quién apoyarse para qué."
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
            const errText = await response.text();
            console.error("Claude API error:", errText);
            return { statusCode: response.status, body: JSON.stringify({ error: "Error API" }) };
        }

        const data = await response.json();
        const rawText = data.content[0].text;

        let parsed;
        try {
            const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.error("Parse error:", e.message);
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
