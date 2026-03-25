// ==========================================
// Netlify Serverless Function: get-plan
// Agrega TODOS los resultados de instrumentos para una persona
// Recibe portalCode → busca persona → consulta todas las tablas en paralelo
// Base BuenTrato (app2psDmvIE74vhkQ) → PERSONAS, EVALUACIONES
// Base PRUEBAS (appaTeQAba3xYfycx) → todas las tablas de respuestas
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_BUENTRATO = "app2psDmvIE74vhkQ";
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";

    const TABLE_PERSONAS = "tblw5g879AP13AiOw";
    const TABLE_EVALUACIONES = "tblsYWKZWqKpg2Emd";
    const TABLE_DISC = "tbl6O1XFe2U1ylxud";
    const TABLE_IE = "tblUlRhcLNtaQjlwz";
    const TABLE_AUTO = "tblpqKUEScrSIYJXe";
    const TABLE_ESTILOS = "tblQuSde7mjDWChyR";
    const TABLE_CLIMA = "tblkAJMyxVstzPsLc";

    if (!AIRTABLE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Airtable no configurado" }) };
    }

    const headers = {
        "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
    };

    async function airtableFetch(baseId, tableId, formula, maxRecords = 1) {
        const encoded = encodeURIComponent(formula);
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encoded}&maxRecords=${maxRecords}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.records || [];
    }

    try {
        const { portalCode } = JSON.parse(event.body);

        if (!portalCode) {
            return { statusCode: 400, body: JSON.stringify({ error: "Codigo de portal requerido" }) };
        }

        const codeClean = portalCode.trim();

        // 1. Buscar persona por codigo_portal
        const personRecords = await airtableFetch(
            BASE_BUENTRATO,
            TABLE_PERSONAS,
            `{codigo_portal} = '${codeClean}'`
        );

        if (personRecords.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "Codigo no encontrado." }) };
        }

        const persona = personRecords[0].fields;
        const email = persona.email;

        if (!email) {
            return { statusCode: 400, body: JSON.stringify({ error: "Persona sin email registrado" }) };
        }

        // 2. Consultar TODAS las tablas de instrumentos en paralelo
        const emailFormula = `FIND('${email}', ARRAYJOIN({Email}, ','))`;

        const [discEvals, ieRecords, autoRecords, estilosRecords, climaRecords, discRecords] = await Promise.all([
            // DISC: buscar evaluacion en EVALUACIONES para luego buscar en Respuestas Equipo
            airtableFetch(BASE_BUENTRATO, TABLE_EVALUACIONES, `AND({persona} = '${email}', {estado} = 'Completada')`, 5).catch(() => []),
            // IE
            airtableFetch(BASE_PRUEBAS, TABLE_IE, emailFormula).catch(() => []),
            // Autoliderazgo
            airtableFetch(BASE_PRUEBAS, TABLE_AUTO, emailFormula).catch(() => []),
            // Estilos
            airtableFetch(BASE_PRUEBAS, TABLE_ESTILOS, emailFormula).catch(() => []),
            // Clima
            airtableFetch(BASE_PRUEBAS, TABLE_CLIMA, emailFormula).catch(() => []),
            // DISC porcentajes desde Respuestas Equipo por email
            airtableFetch(BASE_PRUEBAS, TABLE_DISC, `{Email} = '${email}'`).catch(() => [])
        ]);

        // 3. Procesar cada instrumento
        const result = {
            name: persona.nombre_completo || (persona.nombre + " " + persona.apellido),
            firstName: persona.nombre,
            email: persona.email,
            role: persona.cargo_actual || "",
            area: persona.area_actual || "",
            instruments: {}
        };

        // --- DISC ---
        if (discRecords.length > 0) {
            const r = discRecords[0].fields;
            const discNatural = {
                D: Math.round((r.porcentaje_D_Natural || 0) * 100),
                I: Math.round((r.porcentaje_I_Natural || 0) * 100),
                S: Math.round((r.porcentaje_S_Natural || 0) * 100),
                C: Math.round((r.porcentaje_C_Natutal || 0) * 100)
            };
            const discAdaptado = {
                D: Math.round((r.porcentaje_D_Adaptado || 0) * 100),
                I: Math.round((r.porcentaje_I_Adaptado || 0) * 100),
                S: Math.round((r.porcentaje_S_Adaptado || 0) * 100),
                C: Math.round((r.Porcentaje_C_Adapatdo || 0) * 100)
            };
            const styles = [
                { key: "D", score: discNatural.D, name: "Dominancia" },
                { key: "I", score: discNatural.I, name: "Influencia" },
                { key: "S", score: discNatural.S, name: "Serenidad" },
                { key: "C", score: discNatural.C, name: "Cumplimiento" }
            ].sort((a, b) => b.score - a.score);

            result.instruments.disc = {
                available: true,
                natural: discNatural,
                adaptado: discAdaptado,
                primaryStyle: styles[0].key,
                primaryStyleName: styles[0].name,
                secondaryStyle: styles[1].key,
                secondaryStyleName: styles[1].name
            };
        } else {
            result.instruments.disc = { available: false };
        }

        // --- IE ---
        if (ieRecords.length > 0) {
            const r = ieRecords[0].fields;
            const toPercent = (val) => Math.round(((val || 0) / 5) * 100);
            result.instruments.ie = {
                available: true,
                scores: {
                    autoconciencia: toPercent(r["Promedio Autoconciencia"]),
                    autorregulacion: toPercent(r["Promedio Autorregulación"]),
                    motivacion: toPercent(r["Promedio Motivación"]),
                    empatia: toPercent(r["Promedio Empatía"]),
                    habilidades_sociales: toPercent(r["Promedio Habilidades Sociales"])
                },
                niveles: {
                    autoconciencia: r["Nivel Autoconciencia"] || "",
                    autorregulacion: r["Nivel Autorregulación"] || "",
                    motivacion: r["Nivel Motivación"] || "",
                    empatia: r["Nivel Empatía"] || "",
                    habilidades_sociales: r["Nivel Habilidades Sociales"] || ""
                },
                general: toPercent(r["Promedio General"]),
                nivelGeneral: r["Nivel General"] || ""
            };
        } else {
            result.instruments.ie = { available: false };
        }

        // --- Autoliderazgo ---
        if (autoRecords.length > 0) {
            const r = autoRecords[0].fields;
            const toPct = (val, max) => Math.round(((val || 0) / max) * 100);
            result.instruments.autoliderazgo = {
                available: true,
                scores: {
                    autoconciencia: toPct(r["Total Autoconciencia"], 12),
                    autogestion: toPct(r["Total Autogestión"], 15),
                    regulacion_emocional: toPct(r["Total Regulación Emocional"], 3),
                    motivacion: toPct(r["Total Motivación"], 9),
                    adaptabilidad: toPct(r["Total Adaptabilidad"], 6)
                },
                niveles: {
                    autoconciencia: r["Nivel Autoconciencia"] || "",
                    autogestion: r["Nivel Autogestión"] || "",
                    regulacion_emocional: r["Nivel Regulación Emocional"] || "",
                    motivacion: r["Nivel Motivación"] || "",
                    adaptabilidad: r["Nivel Adaptabilidad"] || ""
                },
                general: toPct(r["Total General"], 45),
                nivelGeneral: r["Nivel General"] || ""
            };
        } else {
            result.instruments.autoliderazgo = { available: false };
        }

        // --- Estilos de Aprendizaje ---
        if (estilosRecords.length > 0) {
            const r = estilosRecords[0].fields;
            const toPct = (val) => Math.round(((val || 0) / 6) * 100);
            const raw = {
                visual: r["Visual"] || 0,
                auditivo: r["Auditivo"] || 0,
                verbal: r["Verbal"] || 0,
                kinestesico: r["Kinestésico"] || 0
            };
            const estilos = [
                { id: "visual", label: "Visual", score: raw.visual },
                { id: "auditivo", label: "Auditivo", score: raw.auditivo },
                { id: "verbal", label: "Verbal", score: raw.verbal },
                { id: "kinestesico", label: "Kinestésico", score: raw.kinestesico }
            ].sort((a, b) => b.score - a.score);

            result.instruments.estilos = {
                available: true,
                scores: {
                    visual: toPct(raw.visual),
                    auditivo: toPct(raw.auditivo),
                    verbal: toPct(raw.verbal),
                    kinestesico: toPct(raw.kinestesico)
                },
                dominante: estilos[0].label,
                ranking: estilos.map(e => e.label)
            };
        } else {
            result.instruments.estilos = { available: false };
        }

        // --- Clima/Experiencia ---
        if (climaRecords.length > 0) {
            const r = climaRecords[0].fields;
            const toPercent = (val) => Math.round(((val || 0) / 5) * 100);
            result.instruments.clima = {
                available: true,
                scores: {
                    seguridad_psi: toPercent(r["promedio seguridad psi"]),
                    comunicacion: toPercent(r["promedio comunicacion"]),
                    valoracion: toPercent(r["promedio valoración y reconocimiento"]),
                    colaboracion: toPercent(r["promedio colaboración y apoyo"]),
                    liderazgo: toPercent(r["promedio liderazgo"])
                },
                general: toPercent(r["promedio clima general"])
            };
        } else {
            result.instruments.clima = { available: false };
        }

        // Count available instruments
        result.availableCount = Object.values(result.instruments).filter(i => i.available).length;

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno del servidor" }) };
    }
};
