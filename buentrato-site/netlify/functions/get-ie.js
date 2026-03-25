// ==========================================
// Netlify Serverless Function: get-ie
// Busca respuesta de Inteligencia Emocional por codigo_personal
// Base PRUEBAS (appaTeQAba3xYfycx) → IE_Respuestas
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";
    const TABLE_IE = "tblUlRhcLNtaQjlwz";

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
                body: JSON.stringify({ error: "Codigo requerido" })
            };
        }

        const codeClean = code.trim();

        const formula = encodeURIComponent(`{codigo_personal} = '${codeClean}'`);
        const url = `https://api.airtable.com/v0/${BASE_PRUEBAS}/${TABLE_IE}?filterByFormula=${formula}&maxRecords=1`;

        const resp = await fetch(url, { headers: airtableHeaders });

        if (!resp.ok) {
            console.error("Airtable error:", await resp.text());
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Error al buscar en Airtable" })
            };
        }

        const data = await resp.json();

        if (!data.records || data.records.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Codigo no encontrado. Verifica que sea correcto." })
            };
        }

        const r = data.records[0].fields;

        // Promedios en escala 1-5, convertir a porcentaje
        const toPercent = (val) => Math.round(((val || 0) / 5) * 100);

        const scores = {
            autoconciencia: toPercent(r["Promedio Autoconciencia"]),
            autorregulacion: toPercent(r["Promedio Autorregulación"]),
            motivacion: toPercent(r["Promedio Motivación"]),
            empatia: toPercent(r["Promedio Empatía"]),
            habilidades_sociales: toPercent(r["Promedio Habilidades Sociales"])
        };

        const niveles = {
            autoconciencia: r["Nivel Autoconciencia"] || "",
            autorregulacion: r["Nivel Autorregulación"] || "",
            motivacion: r["Nivel Motivación"] || "",
            empatia: r["Nivel Empatía"] || "",
            habilidades_sociales: r["Nivel Habilidades Sociales"] || ""
        };

        const nombre = r.Nombre ? r.Nombre[0] : "Participante";
        const empresa = r.Empresa ? r.Empresa[0] : "";
        const cargo = r.Cargo ? r.Cargo[0] : "";
        const area = r.Área ? r.Área[0] : "";
        const email = r.Email ? r.Email[0] : "";

        const fecha = r["Fecha"]
            ? new Date(r["Fecha"]).toLocaleDateString("es-CO", { year: "numeric", month: "long" })
            : "";

        const profile = {
            name: nombre,
            role: cargo,
            company: empresa,
            area: area,
            email: email,
            date: fecha,
            scores: scores,
            niveles: niveles,
            ieGeneral: toPercent(r["Promedio General"]),
            nivelGeneral: r["Nivel General"] || "",
            lectura: r["Lectura General"] || "",
            interpretacion: r["Interpretación"] || ""
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
