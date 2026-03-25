// ==========================================
// Netlify Serverless Function: get-autoliderazgo
// Busca respuesta de Autoliderazgo por codigo_personal
// Base PRUEBAS (appaTeQAba3xYfycx) → Autoliderazgo_Respuestas
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";
    const TABLE_AUTO = "tblpqKUEScrSIYJXe";

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
        const url = `https://api.airtable.com/v0/${BASE_PRUEBAS}/${TABLE_AUTO}?filterByFormula=${formula}&maxRecords=1`;

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

        // Convertir totales a porcentaje según máximo de cada dimensión
        // Autoconciencia: 4 preguntas → max 12
        // Autogestión: 5 preguntas → max 15
        // Regulación Emocional: 1 pregunta → max 3
        // Motivación: 3 preguntas → max 9
        // Adaptabilidad: 2 preguntas → max 6
        const toPct = (val, max) => Math.round(((val || 0) / max) * 100);

        const scores = {
            autoconciencia: toPct(r["Total Autoconciencia"], 12),
            autogestion: toPct(r["Total Autogestión"], 15),
            regulacion_emocional: toPct(r["Total Regulación Emocional"], 3),
            motivacion: toPct(r["Total Motivación"], 9),
            adaptabilidad: toPct(r["Total Adaptabilidad"], 6)
        };

        const niveles = {
            autoconciencia: r["Nivel Autoconciencia"] || "",
            autogestion: r["Nivel Autogestión"] || "",
            regulacion_emocional: r["Nivel Regulación Emocional"] || "",
            motivacion: r["Nivel Motivación"] || "",
            adaptabilidad: r["Nivel Adaptabilidad"] || ""
        };

        const nombre = r.Nombre ? r.Nombre[0] : "Participante";
        const empresa = r.Empresa ? r.Empresa[0] : "";
        const cargo = r.Cargo ? r.Cargo[0] : "";
        const area = r.Área ? r.Área[0] : "";
        const email = r.Email ? r.Email[0] : "";

        const fecha = r["Fecha"]
            ? new Date(r["Fecha"]).toLocaleDateString("es-CO", { year: "numeric", month: "long" })
            : "";

        // Total General: max 45
        const totalGeneral = toPct(r["Total General"], 45);

        const profile = {
            name: nombre,
            role: cargo,
            company: empresa,
            area: area,
            email: email,
            date: fecha,
            scores: scores,
            niveles: niveles,
            totalGeneral: totalGeneral,
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
