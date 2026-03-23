// ==========================================
// Netlify Serverless Function: get-report
// Busca evaluación DISC por código único y devuelve datos del perfil
// Base: BuenTrato (app2psDmvIE74vhkQ)
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    // Base principal BuenTrato
    const BASE_ID = "app2psDmvIE74vhkQ";

    if (!AIRTABLE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Airtable no configurado" })
        };
    }

    try {
        const { code } = JSON.parse(event.body);

        if (!code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Código requerido" })
            };
        }

        const codeClean = code.trim();

        // 1. Buscar evaluación por evaluacion_uid
        const evalTable = encodeURIComponent("EVALUACIONES");
        const formula = encodeURIComponent(`{evaluacion_uid} = '${codeClean}'`);
        const evalUrl = `https://api.airtable.com/v0/${BASE_ID}/${evalTable}?filterByFormula=${formula}&maxRecords=1`;

        const evalResp = await fetch(evalUrl, {
            headers: {
                "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

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

        // 2. Verificar que tiene resultados
        if (!evalRecord.resultados_json) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Esta evaluación aún no tiene resultados procesados." })
            };
        }

        // 3. Obtener datos de la persona vinculada
        let personName = "";
        let personEmail = "";
        if (evalRecord.persona && evalRecord.persona.length > 0) {
            const personId = evalRecord.persona[0];
            const personTable = encodeURIComponent("PERSONAS");
            const personUrl = `https://api.airtable.com/v0/${BASE_ID}/${personTable}/${personId}`;

            const personResp = await fetch(personUrl, {
                headers: {
                    "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (personResp.ok) {
                const personData = await personResp.json();
                personName = personData.fields.nombre_completo ||
                    `${personData.fields.nombre || ""} ${personData.fields.apellido || ""}`.trim();
                personEmail = personData.fields.email || "";
            }
        }

        // 4. Parsear resultados DISC
        const scores = JSON.parse(evalRecord.resultados_json);

        // Calcular porcentajes (los puntajes suman 24 para Natural y 24 para Adaptado)
        const totalNatural = (scores.D_Natural || 0) + (scores.I_Natural || 0) +
                            (scores.S_Natural || 0) + (scores.C_Natural || 0);
        const totalAdaptado = (scores.D_Adaptado || 0) + (scores.I_Adaptado || 0) +
                             (scores.S_Adaptado || 0) + (scores.C_Adaptado || 0);

        const toPerc = (val, total) => total > 0 ? Math.round((val / total) * 100) : 0;

        const discNatural = {
            D: toPerc(scores.D_Natural, totalNatural),
            I: toPerc(scores.I_Natural, totalNatural),
            S: toPerc(scores.S_Natural, totalNatural),
            C: toPerc(scores.C_Natural, totalNatural)
        };

        const discAdaptado = {
            D: toPerc(scores.D_Adaptado, totalAdaptado),
            I: toPerc(scores.I_Adaptado, totalAdaptado),
            S: toPerc(scores.S_Adaptado, totalAdaptado),
            C: toPerc(scores.C_Adaptado, totalAdaptado)
        };

        // Raw scores también (para el prompt de Claude)
        const rawNatural = {
            D: scores.D_Natural || 0,
            I: scores.I_Natural || 0,
            S: scores.S_Natural || 0,
            C: scores.C_Natural || 0
        };

        const rawAdaptado = {
            D: scores.D_Adaptado || 0,
            I: scores.I_Adaptado || 0,
            S: scores.S_Adaptado || 0,
            C: scores.C_Adaptado || 0
        };

        // 5. Determinar estilo primario
        const styles = [
            { key: "D", score: discNatural.D, name: "Dominancia" },
            { key: "I", score: discNatural.I, name: "Influencia" },
            { key: "S", score: discNatural.S, name: "Serenidad" },
            { key: "C", score: discNatural.C, name: "Cumplimiento" }
        ];
        styles.sort((a, b) => b.score - a.score);
        const primaryStyle = styles[0];
        const secondaryStyle = styles[1];

        // 6. Construir respuesta
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
