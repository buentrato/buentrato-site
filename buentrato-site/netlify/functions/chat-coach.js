// ==========================================
// Netlify Serverless Function: chat-coach
// Chat personalizado con coach IA de BuenTrato
// Responde SOLO basado en los datos reales de la persona
// y su equipo. Sin inventar ni suponer datos.
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
        const { question, history, personData, teamData } = JSON.parse(event.body);

        if (!question) {
            return { statusCode: 400, body: JSON.stringify({ error: "Pregunta requerida" }) };
        }

        if (!personData) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos de la persona requeridos" }) };
        }

        // Build person context
        const p = personData;
        let personContext = `=== TÚ: ${p.name} (${p.role || 'sin cargo'}) ===`;

        if (p.disc) {
            personContext += `\nPersonalidad DISC — Natural: D=${p.disc.D}% I=${p.disc.I}% S=${p.disc.S}% C=${p.disc.C}%`;
            if (p.discAdaptado) {
                personContext += ` | Adaptado: D=${p.discAdaptado.D}% I=${p.discAdaptado.I}% S=${p.discAdaptado.S}% C=${p.discAdaptado.C}%`;
            }
        }

        if (p.ie) {
            personContext += `\nInteligencia Emocional — Autoconciencia: ${p.ie.autoconciencia || '?'}, Autorregulación: ${p.ie.autorregulacion || '?'}, Motivación: ${p.ie.motivacion || '?'}, Empatía: ${p.ie.empatia || '?'}, Hab. Sociales: ${p.ie.habilidadesSociales || '?'} (General: ${p.ie.general || '?'}, Nivel: ${p.ie.nivelGeneral || '?'})`;
        }

        if (p.autoliderazgo) {
            const al = p.autoliderazgo;
            personContext += `\nAutoliderazgo — Autoconciencia: ${al.autoconciencia || '?'}, Autogestión: ${al.autogestion || '?'}, Reg. Emocional: ${al.regulacionEmocional || '?'}, Motivación: ${al.motivacion || '?'}, Adaptabilidad: ${al.adaptabilidad || '?'} (General: ${al.general || '?'}, Nivel: ${al.nivelGeneral || '?'})`;
        }

        if (p.estilos) {
            personContext += `\nEstilos de Aprendizaje — Visual: ${p.estilos.visual || '?'}, Auditivo: ${p.estilos.auditivo || '?'}, Verbal: ${p.estilos.verbal || '?'}, Kinestésico: ${p.estilos.kinestesico || '?'}`;
        }

        if (p.clima) {
            const cl = p.clima;
            personContext += `\nClima percibido — Seguridad Psicológica: ${cl.seguridadPsi || '?'}, Comunicación: ${cl.comunicacion || '?'}, Valoración: ${cl.valoracion || '?'}, Colaboración: ${cl.colaboracion || '?'}, Liderazgo: ${cl.liderazgo || '?'} (General: ${cl.general || '?'})`;
        }

        // Build team context if available
        let teamContext = '';
        if (teamData && teamData.members && teamData.members.length > 0) {
            const teammates = teamData.members.filter(m => m.email !== p.email);
            if (teammates.length > 0) {
                teamContext = `\n\n=== COMPAÑEROS DE EQUIPO (${teamData.company || 'Empresa'}) ===`;
                teammates.forEach(m => {
                    teamContext += `\n\n${m.name} (${m.role || 'sin cargo'}):`;
                    if (m.disc) teamContext += ` DISC Natural D=${m.disc.D}% I=${m.disc.I}% S=${m.disc.S}% C=${m.disc.C}%`;
                    if (m.ie) teamContext += ` | IE General: ${m.ie.general || '?'}, Empatía: ${m.ie.empatia || '?'}, Hab.Sociales: ${m.ie.habilidadesSociales || '?'}`;
                    if (m.autoliderazgo) teamContext += ` | Autoliderazgo: ${m.autoliderazgo.general || '?'}`;
                    if (m.estilos) {
                        const scores = [
                            { n: 'Visual', v: m.estilos.visual },
                            { n: 'Auditivo', v: m.estilos.auditivo },
                            { n: 'Verbal', v: m.estilos.verbal },
                            { n: 'Kinestésico', v: m.estilos.kinestesico }
                        ].sort((a, b) => (b.v || 0) - (a.v || 0));
                        teamContext += ` | Aprende mejor: ${scores[0].n}`;
                    }
                });
            }
        }

        const systemPrompt = `Eres el coach personal de BuenTrato.AI para ${p.name.split(' ')[0]}. Responde sus preguntas sobre sí misma/o, sus relaciones de equipo, y cómo mejorar en su trabajo.

DATOS INTERNOS (para tu análisis — NUNCA cites puntajes, siglas DISC/IE, ni nombres técnicos de instrumentos):
${personContext}${teamContext}

CLAVES INTERNAS (NO mencionar):
- DISC: D=resultados/directo, I=personas/sociable, S=estabilidad/pausado, C=calidad/metódico
- IE: capacidades emocionales (empatía, autocontrol, motivación, habilidades sociales)
- Autoliderazgo: madurez personal (autogestión, regulación emocional, adaptabilidad)
- Estilos: Visual/Auditivo/Verbal/Kinestésico = cómo prefieren recibir información
- Clima: percepción del entorno laboral

REGLAS:
1. Responde EXCLUSIVAMENTE con base en los datos que tienes. Si no tienes datos sobre algo, dilo: "Eso no lo puedo saber con las evaluaciones que tenemos."
2. NUNCA inventes datos ni supongas información que no esté en el contexto.
3. Traduce TODO a lenguaje cotidiano: comportamientos, situaciones, ejemplos del día a día.
4. Usa "tú" siempre. Español latinoamericano. Tono cálido y directo.
5. Sé conciso/a: respuestas de 2-4 párrafos cortos máximo, a menos que te pidan profundizar.
6. Usa **negritas** para resaltar ideas clave (máx 3-4 por respuesta).
7. NO uses viñetas ni listas. Prosa fluida.
8. Si preguntan sobre un compañero específico, busca en los datos del equipo y responde con base en esos datos.
9. Cuando des consejos, sé específico/a: "cuando estés en una reunión con Pedro, intenta..." NO genérico.
10. Si preguntan algo fuera del ámbito laboral/profesional, redirige amablemente.`;

        // Build messages array with history
        const messages = [];

        if (history && Array.isArray(history)) {
            // Include last 8 messages of history to stay within token limits
            const recentHistory = history.slice(-8);
            recentHistory.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }

        messages.push({ role: "user", content: question });

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
                system: systemPrompt,
                messages
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Claude API error:", errText);
            return { statusCode: response.status, body: JSON.stringify({ error: "Error del asistente" }) };
        }

        const data = await response.json();
        const reply = data.content[0].text;

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reply })
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno" }) };
    }
};
