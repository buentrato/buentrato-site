// ==========================================
// Netlify Serverless Function: get-report
// Busca evaluación DISC por código único y devuelve datos del perfil
// Base BuenTrato (app2psDmvIE74vhkQ) → datos de evaluación y persona
// Base PRUEBAS (appaTeQAba3xYfycx) → porcentajes DISC calculados
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_BUENTRATO = "app2psDmvIE74vhkQ";
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";
    const TABLE_RESPUESTAS = "tbl6O1XFe2U1ylxud";

    if (!AIRTABLE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Airtable no configurado" })
        };
    }

    const airtableHeaders = {
        "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
    };

    try {
        const { code } = JSON.parse(event.body);

        if (!code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Código requerido" })
            };
        }

        const codeClean = code.trim();

        // 1. Buscar evaluación por evaluacion_uid en BuenTrato
        const evalTable = encodeURIComponent("EVALUACIONES");
        const formula = encodeURIComponent(`{evaluacion_uid} = '${codeClean}'`);
        const evalUrl = `https://api.airtable.com/v0/${BASE_BUENTRATO}/${evalTable}?filterByFormula=${formula}&maxRecords=1`;

        const evalResp = await fetch(evalUrl, { headers: airtableHeaders });

        if (!evalResp.ok) {
            console.error("Airtable eval error:", await evalResp.text());
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Error al buscar evaluación" })
            };
        }

        const evalData = await evalResp.json();

        if (!evalData.records || evalData.records.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Código no encontrado. Verifica que sea correcto." })
            };
        }

        const evalRecord = evalData.records[0].fields;

        // 2. Obtener datos de la persona vinculada
        let personName = "";
        let personEmail = "";
        if (evalRecord.persona && evalRecord.persona.length > 0) {
            const personId = evalRecord.persona[0];
            const personTable = encodeURIComponent("PERSONAS");
            const personUrl = `https://api.airtable.com/v0/${BASE_BUENTRATO}/${personTable}/${personId}`;

            const personResp = await fetch(personUrl, { headers: airtableHeaders });

            if (personResp.ok) {
                const personData = await personResp.json();
                personName = personData.fields.nombre_completo ||
                    `${personData.fields.nombre || ""} ${personData.fields.apellido || ""}`.trim();
                personEmail = personData.fields.email || "";
            }
        }

        // 3. Buscar porcentajes DISC en base PRUEBAS por email
        let discNatural = { D: 0, I: 0, S: 0, C: 0 };
        let discAdaptado = { D: 0, I: 0, S: 0, C: 0 };
        let rawNatural = { D: 0, I: 0, S: 0, C: 0 };
        let rawAdaptado = { D: 0, I: 0, S: 0, C: 0 };

        if (personEmail) {
            const respFormula = encodeURIComponent(`{Email} = '${personEmail}'`);
            const respUrl = `https://api.airtable.com/v0/${BASE_PRUEBAS}/${TABLE_RESPUESTAS}?filterByFormula=${respFormula}&maxRecords=1`;

            const respResp = await fetch(respUrl, { headers: airtableHeaders });

            if (respResp.ok) {
                const respData = await respResp.json();

                if (respData.records && respData.records.length > 0) {
                    const r = respData.records[0].fields;

                    // Porcentajes vienen como decimales (0.36 = 36%)
                    // Nota: hay typos en Airtable: "porcentaje_C_Natutal", "Porcentaje_C_Adapatdo"
                    discNatural = {
                        D: Math.round((r.porcentaje_D_Natural || 0) * 100),
                        I: Math.round((r.porcentaje_I_Natural || 0) * 100),
                        S: Math.round((r.porcentaje_S_Natural || 0) * 100),
                        C: Math.round((r.porcentaje_C_Natutal || 0) * 100)
                    };

                    discAdaptado = {
                        D: Math.round((r.porcentaje_D_Adaptado || 0) * 100),
                        I: Math.round((r.porcentaje_I_Adaptado || 0) * 100),
                        S: Math.round((r.porcentaje_S_Adaptado || 0) * 100),
                        C: Math.round((r.Porcentaje_C_Adapatdo || 0) * 100)
                    };

                    // Raw scores también
                    rawNatural = {
                        D: r.Puntaje_D_Natural || 0,
                        I: r.Puntaje_I_Natural || 0,
                        S: r.Puntaje_S_Natural || 0,
                        C: r.Puntaje_C_Natural || 0
                    };

                    rawAdaptado = {
                        D: r.Puntaje_D_Adaptado || 0,
                        I: r.Puntaje_I_Adaptado || 0,
                        S: r.Puntaje_S_Adaptado || 0,
                        C: r.Puntaje_C_Adaptado || 0
                    };
                } else {
                    console.error("No se encontró registro en PRUEBAS para email:", personEmail);
                }
            } else {
                console.error("Error buscando en PRUEBAS:", await respResp.text());
            }
        }

        // 4. Determinar estilo primario
        const styles = [
            { key: "D", score: discNatural.D, name: "Dominancia" },
            { key: "I", score: discNatural.I, name: "Influencia" },
            { key: "S", score: discNatural.S, name: "Serenidad" },
            { key: "C", score: discNatural.C, name: "Cumplimiento" }
        ];
        styles.sort((a, b) => b.score - a.score);
        const primaryStyle = styles[0];
        const secondaryStyle = styles[1];

        // 5. Construir respuesta
        const profile = {
            name: personName || "Participante",
            email: personEmail,
            role: evalRecord.snapshot_cargo || "",
            area: evalRecord.snapshot_area || "",
            company: evalRecord.snapshot_empresa || "",
            project: evalRecord.snapshot_proyecto || "",
            date: evalRecord.fecha_realizacion || "",
            code: codeClean,
            primaryStyle: primaryStyle.key,
            primaryStyleName: primaryStyle.name,
            secondaryStyle: secondaryStyle.key,
            secondaryStyleName: secondaryStyle.name,
            discNatural,
            discAdaptado,
            rawNatural,
            rawAdaptado
        };

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profile)
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor" })
        };
    }
};
