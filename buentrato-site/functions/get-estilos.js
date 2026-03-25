// ==========================================
// Netlify Serverless Function: get-estilos
// Busca respuesta de Estilos de Aprendizaje por codigo_personal
// Base PRUEBAS (appaTeQAba3xYfycx) → Estilos_Aprendizaje_Respuestas
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";
    const TABLE_ESTILOS = "tblQuSde7mjDWChyR";

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
        const url = `https://api.airtable.com/v0/${BASE_PRUEBAS}/${TABLE_ESTILOS}?filterByFormula=${formula}&maxRecords=1`;

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

        // 4 estilos, cada uno contado de 6 preguntas (max 6)
        // Convertir a porcentaje: (score / 6) * 100
        const MAX_SCORE = 6;
        const toPct = (val) => Math.round(((val || 0) / MAX_SCORE) * 100);

        const scores = {
            visual: toPct(r["Visual"]),
            auditivo: toPct(r["Auditivo"]),
            verbal: toPct(r["Verbal"]),
            kinestesico: toPct(r["Kinestésico"])
        };

        const raw = {
            visual: r["Visual"] || 0,
            auditivo: r["Auditivo"] || 0,
            verbal: r["Verbal"] || 0,
            kinestesico: r["Kinestésico"] || 0
        };

        // Determinar estilo dominante
        const estilos = [
            { id: "visual", label: "Visual", score: raw.visual },
            { id: "auditivo", label: "Auditivo", score: raw.auditivo },
            { id: "verbal", label: "Verbal", score: raw.verbal },
            { id: "kinestesico", label: "Kinestésico", score: raw.kinestesico }
        ];
        estilos.sort((a, b) => b.score - a.score);
        const dominante = estilos[0].label;

        const nombre = r.Nombre ? r.Nombre[0] : "Participante";
        const empresa = r.Empresa ? r.Empresa[0] : "";
        const cargo = r.Cargo ? r.Cargo[0] : "";
        const area = r.Área ? r.Área[0] : "";
        const email = r.Email ? r.Email[0] : "";

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
            raw: raw,
            dominante: dominante,
            ranking: estilos.map(e => e.label)
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
