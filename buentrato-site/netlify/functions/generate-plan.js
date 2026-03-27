// ==========================================
// Netlify Serverless Function: generate-plan
// Genera plan de desarrollo personalizado con Claude AI
// VERSION 2: Conciso y visual — keywords destacadas, textos cortos
// Grupos: "resumen", "areas_desarrollo", "roadmap"
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
        if (!profile || !profile.instruments) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos incompletos" }) };
        }

        const p = profile;
        const firstName = p.name.split(' ')[0];

        // Build comprehensive data context from ALL instruments
        let dataContext = "";

        if (p.instruments.disc && p.instruments.disc.available) {
            const d = p.instruments.disc;
            dataContext += `\n=== PERFIL DISC ===
Estilo primario: ${d.primaryStyleName} (${d.primaryStyle})
Estilo secundario: ${d.secondaryStyleName} (${d.secondaryStyle})
Natural: D=${d.natural.D}%, I=${d.natural.I}%, S=${d.natural.S}%, C=${d.natural.C}%
Adaptado: D=${d.adaptado.D}%, I=${d.adaptado.I}%, S=${d.adaptado.S}%, C=${d.adaptado.C}%
(D=Dominancia/resultados, I=Influencia/personas, S=Serenidad/estabilidad, C=Cumplimiento/calidad)`;
        }

        if (p.instruments.ie && p.instruments.ie.available) {
            const ie = p.instruments.ie;
            dataContext += `\n\n=== INTELIGENCIA EMOCIONAL (General: ${ie.general}% - ${ie.nivelGeneral}) ===
Autoconciencia: ${ie.scores.autoconciencia}%, Autorregulación: ${ie.scores.autorregulacion}%, Motivación: ${ie.scores.motivacion}%, Empatía: ${ie.scores.empatia}%, Habilidades Sociales: ${ie.scores.habilidades_sociales}%
(Bajo ≤55%, Medio 56-80%, Alto >80%)`;
        }

        if (p.instruments.autoliderazgo && p.instruments.autoliderazgo.available) {
            const al = p.instruments.autoliderazgo;
            dataContext += `\n\n=== AUTOLIDERAZGO (General: ${al.general}%) ===
Autoconciencia: ${al.scores.autoconciencia}%, Autogestión: ${al.scores.autogestion}%, Regulación Emocional: ${al.scores.regulacion_emocional}%, Motivación: ${al.scores.motivacion}%, Adaptabilidad: ${al.scores.adaptabilidad}%`;
        }

        if (p.instruments.estilos && p.instruments.estilos.available) {
            const es = p.instruments.estilos;
            dataContext += `\n\n=== ESTILOS DE APRENDIZAJE (Dominante: ${es.dominante}) ===
Visual: ${es.scores.visual}%, Auditivo: ${es.scores.auditivo}%, Verbal: ${es.scores.verbal}%, Kinestésico: ${es.scores.kinestesico}%`;
        }

        if (p.instruments.clima && p.instruments.clima.available) {
            const cl = p.instruments.clima;
            dataContext += `\n\n=== EXPERIENCIA EN EL EQUIPO (Clima: ${cl.general}%) ===
Seguridad Psicológica: ${cl.scores.seguridad_psi}%, Comunicación: ${cl.scores.comunicacion}%, Valoración: ${cl.scores.valoracion}%, Colaboración: ${cl.scores.colaboracion}%, Liderazgo: ${cl.scores.liderazgo}%`;
        }

        const estiloAprendizaje = (p.instruments.estilos && p.instruments.estilos.available)
            ? p.instruments.estilos.dominante : "mixto";

        const base = `Eres una coach de equipos de BuenTrato.AI creando un PLAN DE DESARROLLO para ${firstName}, ${p.role} en ${p.company || 'su empresa'} (área: ${p.area || 'no especificada'}).

DATOS INTERNOS de todas sus evaluaciones (para tu análisis — NO cites porcentajes ni siglas técnicas constantemente. Traduce todo a lenguaje cotidiano):
${dataContext}

REGLAS CRÍTICAS DE FORMATO:
- Usa "tú". Español latinoamericano. Tono cálido y directo, como un coach que te conoce.
- SÉ CONCISA: frases cortas y directas. Máximo 3 oraciones por campo de texto.
- CRUZA datos entre instrumentos para encontrar patrones, pero explícalos en lenguaje práctico (ej: "eres buena leyendo a las personas pero te cuesta expresar lo que necesitas" en vez de "IE Empatía 80% + DISC I bajo").
- Usa **negritas** para resaltar las 2-3 palabras clave más importantes de cada texto (comportamientos, habilidades, acciones — NO porcentajes ni siglas).
- Los consejos deben ser concretos: "haz esto", "evita esto", "cuando pase X, intenta Y".
- NO uses viñetas, listas ni bullets.
- Responde SOLO JSON válido sin markdown.`;

        let prompt;

        if (group === "resumen") {
            prompt = base + `

Genera el resumen ejecutivo CONCISO:
{
  "titulo_plan": "Frase de 5-8 palabras que capture la esencia del plan (ej: 'Potenciar tu liderazgo emocional')",
  "subtitulo": "1 oración corta complementaria al título",
  "resumen": "Máximo 3 oraciones: quién es ${firstName} en el trabajo, qué la hace fuerte y dónde puede crecer. Resalta **palabras clave** en negritas. Lenguaje cotidiano.",
  "fortaleza1_nombre": "Nombre corto de su fortaleza #1 (2-4 palabras, sin siglas)",
  "fortaleza1_dato": "Breve referencia a de dónde viene esta fortaleza (ej: 'Resultados de personalidad y emociones')",
  "fortaleza1_texto": "1 oración explicando cómo se manifiesta en su trabajo. Usa **negritas** en keywords.",
  "fortaleza2_nombre": "Nombre corto de su fortaleza #2",
  "fortaleza2_dato": "Breve referencia a las evaluaciones que la sustentan",
  "fortaleza2_texto": "1 oración. Usa **negritas** en keywords.",
  "fortaleza3_nombre": "Nombre corto de su fortaleza #3",
  "fortaleza3_dato": "Breve referencia",
  "fortaleza3_texto": "1 oración. Usa **negritas** en keywords.",
  "nota_aprendizaje": "1 oración corta: su estilo dominante es ${estiloAprendizaje}, por lo que las herramientas están adaptadas a esa preferencia."
}`;

        } else if (group === "areas_desarrollo") {
            prompt = base + `

Personaliza herramientas según estilo de aprendizaje ${estiloAprendizaje}:
- Visual: mapas mentales, videos, diagramas
- Auditivo: podcasts, mentoring verbal, audiobooks
- Verbal: lecturas, journaling, escritura reflexiva
- Kinestésico: role-playing, ejercicios prácticos, simulaciones

Identifica 4 ÁREAS DE DESARROLLO cruzando AL MENOS 2 instrumentos cada una.

{
  "area1_nombre": "Nombre conciso (2-5 palabras)",
  "area1_fuentes": "Evaluaciones de origen (ej: 'Personalidad + Emociones')",
  "area1_nivel": "fortaleza|oportunidad|critica",
  "area1_insight": "1-2 oraciones con el hallazgo principal. Explica en lenguaje práctico qué pasa y por qué importa. Usa **negritas** en keywords.",
  "area1_herramienta1_titulo": "Nombre corto de la herramienta (2-5 palabras)",
  "area1_herramienta1_tipo": "lectura|ejercicio|practica|reflexion|curso",
  "area1_herramienta1": "1 oración concreta describiendo qué hacer. Personalizada para estilo ${estiloAprendizaje}.",
  "area1_herramienta2_titulo": "Nombre corto",
  "area1_herramienta2_tipo": "lectura|ejercicio|practica|reflexion|curso",
  "area1_herramienta2": "1 oración concreta.",
  "area2_nombre": "...",
  "area2_fuentes": "...",
  "area2_nivel": "fortaleza|oportunidad|critica",
  "area2_insight": "...",
  "area2_herramienta1_titulo": "...",
  "area2_herramienta1_tipo": "...",
  "area2_herramienta1": "...",
  "area2_herramienta2_titulo": "...",
  "area2_herramienta2_tipo": "...",
  "area2_herramienta2": "...",
  "area3_nombre": "...",
  "area3_fuentes": "...",
  "area3_nivel": "fortaleza|oportunidad|critica",
  "area3_insight": "...",
  "area3_herramienta1_titulo": "...",
  "area3_herramienta1_tipo": "...",
  "area3_herramienta1": "...",
  "area3_herramienta2_titulo": "...",
  "area3_herramienta2_tipo": "...",
  "area3_herramienta2": "...",
  "area4_nombre": "...",
  "area4_fuentes": "...",
  "area4_nivel": "fortaleza|oportunidad|critica",
  "area4_insight": "...",
  "area4_herramienta1_titulo": "...",
  "area4_herramienta1_tipo": "...",
  "area4_herramienta1": "...",
  "area4_herramienta2_titulo": "...",
  "area4_herramienta2_tipo": "...",
  "area4_herramienta2": "..."
}`;

        } else if (group === "roadmap") {
            prompt = base + `

Genera un ROADMAP 30-60-90 días. Acciones concretas y medibles, 1 oración cada una.

{
  "fase1_titulo": "Título corto fase 1 (ej: 'Quick Wins')",
  "fase1_objetivo": "1 oración con el objetivo.",
  "fase1_accion1": "1 oración: acción concreta y medible con **keywords** en negritas.",
  "fase1_accion2": "1 oración: otra acción concreta.",
  "fase1_accion3": "1 oración: otra acción concreta.",
  "fase2_titulo": "Título corto fase 2",
  "fase2_objetivo": "1 oración.",
  "fase2_accion1": "1 oración con **keywords**.",
  "fase2_accion2": "1 oración.",
  "fase2_accion3": "1 oración.",
  "fase3_titulo": "Título corto fase 3",
  "fase3_objetivo": "1 oración.",
  "fase3_accion1": "1 oración con **keywords**.",
  "fase3_accion2": "1 oración.",
  "fase3_accion3": "1 oración.",
  "mensaje_cierre": "2-3 oraciones de cierre motivacional para ${firstName}. Reconoce fortalezas y anima al compromiso."
}`;

        } else {
            return { statusCode: 400, body: JSON.stringify({ error: "Grupo no válido. Use: resumen, areas_desarrollo, roadmap" }) };
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
