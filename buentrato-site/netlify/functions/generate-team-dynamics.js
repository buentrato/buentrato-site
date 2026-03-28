// ==========================================
// Netlify Serverless Function: generate-team-dynamics
// Genera análisis de dinámicas de relacionamiento del equipo con Claude AI
// Recibe todos los miembros DISC y genera resumen para el líder
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
        const { members, company, leaderName } = JSON.parse(event.body);
        if (!members || members.length < 2) {
            return { statusCode: 400, body: JSON.stringify({ error: "Se necesitan al menos 2 miembros" }) };
        }

        // Build comprehensive member profiles with ALL instruments
        const membersSummary = members.map(m => {
            const d = m.disc || {};
            const da = m.discAdaptado || {};
            let profile = `### ${m.name} (${m.role || 'sin cargo'})`;
            profile += `\nPersonalidad DISC — Natural: D=${d.D}% I=${d.I}% S=${d.S}% C=${d.C}% | Adaptado: D=${da.D}% I=${da.I}% S=${da.S}% C=${da.C}%`;

            if (m.ie) {
                const ie = m.ie;
                profile += `\nInteligencia Emocional — Autoconciencia: ${ie.autoconciencia || '?'}, Autorregulación: ${ie.autorregulacion || '?'}, Motivación: ${ie.motivacion || '?'}, Empatía: ${ie.empatia || '?'}, Hab. Sociales: ${ie.habilidadesSociales || '?'} (General: ${ie.general || '?'}, Nivel: ${ie.nivelGeneral || '?'})`;
            }

            if (m.autoliderazgo) {
                const al = m.autoliderazgo;
                profile += `\nAutoliderazgo — Autoconciencia: ${al.autoconciencia || '?'}, Autogestión: ${al.autogestion || '?'}, Reg. Emocional: ${al.regulacionEmocional || '?'}, Motivación: ${al.motivacion || '?'}, Adaptabilidad: ${al.adaptabilidad || '?'} (General: ${al.general || '?'}, Nivel: ${al.nivelGeneral || '?'})`;
            }

            if (m.estilos) {
                const es = m.estilos;
                profile += `\nEstilos de Aprendizaje — Visual: ${es.visual || '?'}, Auditivo: ${es.auditivo || '?'}, Verbal: ${es.verbal || '?'}, Kinestésico: ${es.kinestesico || '?'}`;
            }

            if (m.clima) {
                const cl = m.clima;
                profile += `\nClima percibido — Seguridad Psicológica: ${cl.seguridadPsi || '?'}, Comunicación: ${cl.comunicacion || '?'}, Valoración: ${cl.valoracion || '?'}, Colaboración: ${cl.colaboracion || '?'}, Liderazgo: ${cl.liderazgo || '?'} (General: ${cl.general || '?'})`;
            }

            return profile;
        }).join('\n\n');

        // Detect which instruments are available
        const hasIE = members.some(m => m.ie);
        const hasAuto = members.some(m => m.autoliderazgo);
        const hasEstilos = members.some(m => m.estilos);
        const hasClima = members.some(m => m.clima);

        let instrumentsNote = 'Instrumentos disponibles: Personalidad (DISC)';
        if (hasIE) instrumentsNote += ', Inteligencia Emocional';
        if (hasAuto) instrumentsNote += ', Autoliderazgo';
        if (hasEstilos) instrumentsNote += ', Estilos de Aprendizaje';
        if (hasClima) instrumentsNote += ', Clima Laboral percibido';
        instrumentsNote += '.';

        let crossInstructions = '';
        if (hasIE) crossInstructions += '\n- CRUZA personalidad con inteligencia emocional: ej. alguien directo con baja empatía vs alguien directo con alta empatía generan dinámicas muy diferentes.';
        if (hasAuto) crossInstructions += '\n- USA autoliderazgo para evaluar madurez: ej. alguien impulsivo con buena autorregulación es diferente de alguien impulsivo sin ella.';
        if (hasEstilos) crossInstructions += '\n- CONSIDERA estilos de aprendizaje para recomendar cómo comunicarse entre ellos: ej. uno visual con otro verbal pueden tener desencuentros en reuniones.';
        if (hasClima) crossInstructions += '\n- INTEGRA la percepción de clima: si alguien percibe baja seguridad psicológica, las tensiones se amplifican.';

        const prompt = `Eres una coach de equipos de BuenTrato.AI. Estás preparando un resumen de DINÁMICAS DE RELACIONAMIENTO para ${leaderName || 'el líder'} sobre su equipo en ${company || 'la empresa'}.

DATOS INTERNOS del equipo (para tu análisis, NO cites puntajes, siglas, ni nombres de instrumentos. Traduce TODO a lenguaje cotidiano):

${instrumentsNote}

${membersSummary}

CLAVES INTERNAS (NO mencionar al usuario):
- DISC: D=resultados/directo, I=personas/sociable, S=estabilidad/pausado, C=calidad/metódico
- IE: mide capacidades emocionales (empatía, autocontrol, motivación, habilidades sociales)
- Autoliderazgo: madurez personal (autogestión, regulación emocional, adaptabilidad)
- Estilos: Visual/Auditivo/Verbal/Kinestésico = cómo prefieren recibir información
- Clima: cómo perciben su entorno laboral (seguridad, comunicación, valoración)

INSTRUCCIONES DE CRUCE:${crossInstructions}
- CRUZA todos los datos disponibles para dar insights más profundos y específicos.
- Si solo hay DISC para alguna persona, úsalo. Si hay más instrumentos, aprovéchalos para enriquecer el análisis.

REGLAS CRÍTICAS:
- Habla directo a ${leaderName || 'el líder'} (usa "tú").
- Español latinoamericano. Tono cálido y directo, como un coach que te conoce bien.
- NUNCA menciones puntajes, siglas (DISC, IE), ni términos técnicos como "Dominancia", "perfil Natural", "D=58%", "Autorregulación 3.5".
- Traduce TODO a comportamientos observables: "directo/a", "detallista", "sociable", "pausado/a", "empático/a", "se adapta fácil", "maneja bien la frustración", "aprende mejor viendo que oyendo", etc.
- Menciona a las personas POR SU NOMBRE.
- Sé específico: "María y Pedro trabajan bien cuando..." NO "algunos miembros del equipo..."
- Usa **negritas** para resaltar nombres y comportamientos clave.
- NO uses viñetas, listas numeradas ni bullets. Escribe en prosa fluida con párrafos cortos.
- Responde SOLO JSON válido sin markdown.

Genera:
{
  "titulo": "Frase de 4-8 palabras que capture la dinámica general del equipo",
  "resumen_equipo": "1-2 párrafos describiendo la personalidad colectiva del equipo: qué energía predomina, cómo es el ritmo, qué valoran como grupo, qué tan bien manejan sus emociones colectivamente. Menciona por nombre quiénes marcan el tono.",
  "conexiones_fuertes": "2-3 párrafos sobre los pares o grupos que conectan naturalmente. Explica POR QUÉ funcionan bien juntos (personalidad, emociones, estilos) y EN QUÉ circunstancias (ej: para proyectos creativos, para resolver problemas, para ejecutar rápido, para comunicar ideas). Usa nombres.",
  "tensiones_potenciales": "2-3 párrafos sobre los pares donde puede haber fricción. Explica qué comportamientos chocan, qué capacidades emocionales faltan o sobran, y en qué situaciones (ej: bajo presión, en reuniones, al tomar decisiones). Da consejos concretos para manejar cada tensión. Usa nombres.",
  "puntos_criticos": "1-2 párrafos sobre las situaciones que como líder debes vigilar especialmente: combinaciones de personas + circunstancias + debilidades emocionales que podrían generar conflicto real. Consejos de prevención.",
  "consejo_lider": "1 párrafo con 2-3 recomendaciones concretas para ${leaderName || 'el líder'} sobre cómo aprovechar las fortalezas del equipo y mitigar las tensiones. Incluye tips de comunicación si hay estilos de aprendizaje diferentes."
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
                max_tokens: 3000,
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
            body: JSON.stringify({ dynamics: parsed })
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno" }) };
    }
};
