// ==========================================
// Netlify Serverless Function: get-clima
// Busca respuesta de clima por codigo_personal y devuelve promedios por dimension
// Base PRUEBAS (appaTeQAba3xYfycx) → Clima_Respuestas
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";
    const TABLE_CLIMA = "tblkAJMyxVstzPsLc";

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

        // Buscar en Clima_Respuestas por codigo_personal
        const formula = encodeURIComponent(`{codigo_personal} = '${codeClean}'`);
        const url = `https://api.airtable.com/v0/${BASE_PRUEBAS}/${TABLE_CLIMA}?filterByFormula=${formula}&maxRecords=1`;

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

        // Promedios vienen en escala 1-5, convertir a porcentaje (1=20%, 5=100%)
        const toPercent = (val) => Math.round(((val || 0) / 5) * 100);

        const scores = {
            seguridad_psi: toPercent(r["promedio seguridad psi"]),
            comunicacion: toPercent(r["promedio comunicacion"]),
            valoracion: toPercent(r["promedio valoración y reconocimiento"]),
            colaboracion: toPercent(r["promedio colaboración y apoyo"]),
            liderazgo: toPercent(r["promedio liderazgo"])
        };

        // Datos de la persona (vienen como arrays por ser lookups)
        const nombre = r.Nombre ? r.Nombre[0] : "Participante";
        const empresa = r.Empresa ? r.Empresa[0] : "";
        const cargo = r.Cargo ? r.Cargo[0] : "";
        const area = r.Área ? r.Área[0] : "";
        const email = r.Email ? r.Email[0] : "";

        // Fecha
        const fecha = r["Fecha de la prueba"]
            ? new Date(r["Fecha de la prueba"]).toLocaleDateString("es-CO", { year: "numeric", month: "long" })
            : "";

        const profile = {
            name: nombre,
            role: cargo,
            company: empresa,
            area: area,
            email: email,
            date: fecha,
            scores: scores,
            climaGeneral: toPercent(r["promedio clima general"]),
            lectura: r["lectura clima"] || "",
            textoBase: r["texto base clima"] || ""
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
