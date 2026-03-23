const fetch = require("node-fetch");

exports.handler = async (event, context) => {
    // Add CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        const code = event.queryStringParameters?.code;
        if (!code) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing code parameter" })
            };
        }

        const apiKey = process.env.AIRTABLE_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Missing AIRTABLE_API_KEY" })
            };
        }

        // Query Airtable
        const baseId = "appaTeQAba3xYfycx";
        const tableId = "tbl6O1XFe2U1ylxud";
        const filterFormula = encodeURIComponent(`{Código Equipo} = "${code}"`);

        const response = await fetch(
            `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${filterFormula}`,
            {
                headers: { Authorization: `Bearer ${apiKey}` }
            }
        );

        if (!response.ok) {
            console.error("Airtable error:", response.status, await response.text());
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: "Team not found" })
            };
        }

        const data = await response.json();
        if (!data.records || data.records.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: "Team not found" })
            };
        }

        // Transform records to team structure
        const members = data.records.map(record => {
            const f = record.fields;

            // Extract DISC percentages (note the typos in field names)
            const discNatural = {
                D: Math.round((f.porcentaje_D_Natural || 0) * 100),
                I: Math.round((f.porcentaje_I_Natural || 0) * 100),
                S: Math.round((f.porcentaje_S_Natural || 0) * 100),
                C: Math.round((f.porcentaje_C_Natutal || 0) * 100) // Note: typo "Natutal"
            };

            const discAdaptado = {
                D: Math.round((f.porcentaje_D_Adaptado || 0) * 100),
                I: Math.round((f.porcentaje_I_Adaptado || 0) * 100),
                S: Math.round((f.porcentaje_S_Adaptado || 0) * 100),
                C: Math.round((f.Porcentaje_C_Adapatdo || 0) * 100) // Note: typo "Adapatdo"
            };

            // Determine primary style from natural percentages
            const naturalValues = Object.entries(discNatural);
            const primaryStyle = naturalValues.reduce((max, [style, val]) =>
                val > max.val ? { style, val } : max, { style: 'D', val: 0 }).style;

            return {
                id: record.id,
                name: f.Nombre || "",
                role: f.Cargo || "",
                disc: discNatural,
                discAdaptado,
                primaryStyle
            };
        });

        const team = {
            name: data.records[0].fields["Nombre Equipo"] || "Team",
            company: data.records[0].fields["Empresa"] || "",
            members
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(team)
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
