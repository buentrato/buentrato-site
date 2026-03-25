// ==========================================
// Netlify Serverless Function: generate-plan
// Genera plan de desarrollo personalizado con Claude AI
// Recibe todos los resultados de instrumentos y genera en 3 grupos paralelos
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

        // DISC
        if (p.instruments.disc && p.instruments.disc.available) {
            const d = p.instruments.disc;
            dataContext += `\n=== PERFIL DISC ===
Estilo primario: ${d.primaryStyleName} (${d.primaryStyle})
Estilo secundario: ${d.secondaryStyleName} (${d.secondaryStyle})
Natural: D=${d.natural.D}%, I=${d.natural.I}%, S=${d.natural.S}%, C=${d.natural.C}%
Adaptado: D=${d.adaptado.D}%, I=${d.adaptado.I}%, S=${d.adaptado.S}%, C=${d.adaptado.C}%
Brecha Natural→Adaptado: D=${d.adaptado.D - d.natural.D > 0 ? '+' : ''}${d.adaptado.D - d.natural.D}%, I=${d.adaptado.I - d.natural.I > 0 ? '+' : ''}${d.adaptado.I - d.natural.I}%, S=${d.adaptado.S - d.natural.S > 0 ? '+' : ''}${d.adaptado.S - d.natural.S}%, C=${d.adaptado.C - d.natural.C > 0 ? '+' : ''}${d.adaptado.C - d.natural.C}%
(D=Dominancia/resultados, I=Influencia/personas, S=Serenidad/estabilidad, C=Cumplimiento/calidad)`;
        }

        // IE
        if (p.instruments.ie && p.instruments.ie.available) {
            const ie = p.instruments.ie;
            dataContext += `\n\n=== INTELIGENCIA EMOCIONAL (IE General: ${ie.general}% - ${ie.nivelGeneral}) ===
Autoconciencia: ${ie.scores.autoconciencia}% (${ie.niveles.autoconciencia})
Autorregulación: ${ie.scores.autorregulacion}% (${ie.niveles.autorregulacion})
Motivación: ${ie.scores.motivacion}% (${ie.niveles.motivacion})
Empatía: ${ie.scores.empatia}% (${ie.niveles.empatia})
Habilidades Sociales: ${ie.scores.habilidades_sociales}% (${ie.niveles.habilidades_sociales})
(Escala: Bajo ≤55%, Medio 56-80%, Alto >80%)`;
        }

        // Autoliderazgo
        if (p.instruments.autoliderazgo && p.instruments.autoliderazgo.available) {
            const al = p.instruments.autoliderazgo;
            dataContext += `\n\n=== AUTOLIDERAZGO (General: ${al.general}% - ${al.nivelGeneral}) ===
Autoconciencia: ${al.scores.autoconciencia}%
Autogestión: ${al.scores.autogestion}%
Regulación Emocional: ${al.scores.regulacion_emocional}%
Motivación: ${al.scores.motivacion}%
Adaptabilidad: ${al.scores.adaptabilidad}%`;
        }

        // Estilos de Aprendizaje
        if (p.instruments.estilos && p.instruments.estilos.available) {
            const es = p.instruments.estilos;
            dataContext += `\n\n=== ESTILOS DE APRENDIZAJE (Dominante: ${es.dominante}) ===
Visual: ${es.scores.visual}%
Auditivo: ${es.scores.auditivo}%
Verbal (Lector/Escritor): ${es.scores.verbal}%
Kinestésico: ${es.scores.kinestesico}%
Ranking: ${es.ranking.join(' > ')}`;
        }

        // Clima/Experiencia
        if (p.instruments.clima && p.instruments.clima.available) {
            const cl = p.instruments.clima;
            dataContext += `\n\n=== EXPERIENCIA EN EL EQUIPO (Clima General: ${cl.general}%) ===
Seguridad Psicológica: ${cl.scores.seguridad_psi}%
Comunicación: ${cl.scores.comunicacion}%
Valoración y Reconocimiento: ${cl.scores.valoracion}%
Colaboración y Apoyo: ${cl.scores.colaboracion}%
Liderazgo: ${cl.scores.liderazgo}%
(Escala: porcentaje de satisfacción)`;
        }

        const base = `Eres una psicóloga organizacional senior y coach ejecutiva de BuenTrato.AI. Estás creando un PLAN DE DESARROLLO PERSONALIZADO para ${firstName}, ${p.role} en ${p.company || 'su empresa'} (área: ${p.area || 'no especificada'}).

Tienes acceso a TODOS los resultados de sus evaluaciones:
${dataContext}

Reglas generales:
- Usa "tú". Español latinoamericano. Tono cálido, empático y profesional.
- CRUZA datos entre instrumentos para encontrar patrones (ej: si IE.autorregulación es baja Y DISC muestra alta D, hay un patrón de impulsividad bajo presión).
- Sé específica con los datos numéricos.
- NO uses viñetas, listas numeradas ni bullets. Escribe en prosa fluida.
- Para herramientas/ejercicios: escribe cada uno como un párrafo con título en negritas.
- Responde SOLO JSON válido sin markdown.`;

        let prompt;

        if (group === "resumen") {
            const estiloAprendizaje = (p.instruments.estilos && p.instruments.estilos.available)
                ? p.instruments.estilos.dominante : "no evaluado";

            prompt = base + `

Genera el RESUMEN EJECUTIVO del plan de desarrollo:
{
  "titulo_plan": "Frase de 5-10 palabras que capture la esencia de su plan de desarrollo (ej: 'Potenciar tu liderazgo emocional para inspirar equipos')",
  "resumen_ejecutivo": "3-4 párrafos de resumen ejecutivo. Primer párrafo: visión integral de quién es ${firstName} según TODOS sus resultados cruzados (no repitas cada instrumento por separado, sintetiza). Segundo párrafo: sus principales fortalezas cruzando instrumentos. Tercer párrafo: las principales oportunidades de desarrollo que emergen al cruzar los datos. Cuarto párrafo: la dirección general del plan.",
  "perfil_fortalezas": "1-2 párrafos describiendo sus TOP 3 fortalezas más notables, sustentadas con datos de múltiples instrumentos.",
  "nota_aprendizaje": "1 párrafo explicando que como su estilo de aprendizaje dominante es ${estiloAprendizaje}, las herramientas y recomendaciones del plan se han personalizado para aprovechar esta preferencia. Describe brevemente qué significa esto en la práctica."
}`;

        } else if (group === "areas_desarrollo") {
            const estiloAprendizaje = (p.instruments.estilos && p.instruments.estilos.available)
                ? p.instruments.estilos.dominante : "mixto";

            prompt = base + `

IMPORTANTE: Personaliza el TIPO de herramientas según su estilo de aprendizaje dominante (${estiloAprendizaje}):
- Si es Visual: recomienda mapas mentales, videos, infografías, diagramas, visualizaciones
- Si es Auditivo: recomienda podcasts, conversaciones, mentoring verbal, audiobooks
- Si es Verbal: recomienda lecturas, journaling, escritura reflexiva, artículos
- Si es Kinestésico: recomienda role-playing, ejercicios prácticos, simulaciones, learning by doing

Identifica las 4 ÁREAS DE DESARROLLO MÁS IMPORTANTES cruzando TODOS los instrumentos. Cada área debe estar sustentada por datos de AL MENOS 2 instrumentos diferentes. Prioriza por impacto en su rol como ${p.role}.

{
  "area1_nombre": "Nombre conciso del área (3-6 palabras)",
  "area1_fuentes": "De qué instrumentos viene (ej: 'DISC + IE + Clima')",
  "area1_nivel": "fortaleza|oportunidad|critica",
  "area1_analisis": "1-2 párrafos analizando esta área cruzando datos de múltiples instrumentos. Menciona porcentajes específicos.",
  "area1_herramienta1_titulo": "Nombre de la herramienta/ejercicio (3-6 palabras)",
  "area1_herramienta1": "2-3 oraciones describiendo el ejercicio o herramienta concreta, personalizada para su estilo de aprendizaje ${estiloAprendizaje}.",
  "area1_herramienta2_titulo": "Nombre de la segunda herramienta",
  "area1_herramienta2": "2-3 oraciones con otra herramienta concreta.",
  "area2_nombre": "...",
  "area2_fuentes": "...",
  "area2_nivel": "fortaleza|oportunidad|critica",
  "area2_analisis": "...",
  "area2_herramienta1_titulo": "...",
  "area2_herramienta1": "...",
  "area2_herramienta2_titulo": "...",
  "area2_herramienta2": "...",
  "area3_nombre": "...",
  "area3_fuentes": "...",
  "area3_nivel": "fortaleza|oportunidad|critica",
  "area3_analisis": "...",
  "area3_herramienta1_titulo": "...",
  "area3_herramienta1": "...",
  "area3_herramienta2_titulo": "...",
  "area3_herramienta2": "...",
  "area4_nombre": "...",
  "area4_fuentes": "...",
  "area4_nivel": "fortaleza|oportunidad|critica",
  "area4_analisis": "...",
  "area4_herramienta1_titulo": "...",
  "area4_herramienta1": "...",
  "area4_herramienta2_titulo": "...",
  "area4_herramienta2": "..."
}`;

        } else if (group === "roadmap") {
            prompt = base + `

Genera un ROADMAP DE DESARROLLO en 3 fases (30-60-90 días). Cada fase debe incluir acciones específicas y medibles basadas en los datos de los instrumentos.

{
  "fase1_titulo": "Título de la fase 1 (ej: 'Fundamentos y Quick Wins')",
  "fase1_periodo": "Primeros 30 días",
  "fase1_objetivo": "1 oración con el objetivo principal de esta fase.",
  "fase1_accion1_titulo": "Título de la acción (3-6 palabras)",
  "fase1_accion1": "2-3 oraciones describiendo una acción concreta y medible. Referencia datos específicos de los instrumentos.",
  "fase1_accion2_titulo": "Título de la segunda acción",
  "fase1_accion2": "2-3 oraciones con otra acción concreta.",
  "fase1_accion3_titulo": "Título de la tercera acción",
  "fase1_accion3": "2-3 oraciones con otra acción concreta.",
  "fase2_titulo": "Título de la fase 2 (ej: 'Desarrollo y Práctica')",
  "fase2_periodo": "Días 31-60",
  "fase2_objetivo": "1 oración con el objetivo principal.",
  "fase2_accion1_titulo": "...",
  "fase2_accion1": "...",
  "fase2_accion2_titulo": "...",
  "fase2_accion2": "...",
  "fase2_accion3_titulo": "...",
  "fase2_accion3": "...",
  "fase3_titulo": "Título de la fase 3 (ej: 'Integración y Consolidación')",
  "fase3_periodo": "Días 61-90",
  "fase3_objetivo": "1 oración con el objetivo principal.",
  "fase3_accion1_titulo": "...",
  "fase3_accion1": "...",
  "fase3_accion2_titulo": "...",
  "fase3_accion2": "...",
  "fase3_accion3_titulo": "...",
  "fase3_accion3": "...",
  "mensaje_cierre": "1-2 párrafos de cierre motivacional personalizado para ${firstName}. Reconoce sus fortalezas, anímala/o a comprometerse con el plan, y recuérdale que el desarrollo es un proceso continuo."
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
                max_tokens: 2500,
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
