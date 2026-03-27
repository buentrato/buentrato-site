// ==========================================
// Netlify Serverless Function: get-disc-team
// Recibe un email, busca la empresa de la persona,
// y retorna todos los miembros de esa empresa que
// tienen DISC completado, con sus porcentajes.
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_BUENTRATO = "app2psDmvIE74vhkQ";
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";
    const TABLE_PERSONAS = "tblw5g879AP13AiOw";
    const TABLE_DISC = "tbl6O1XFe2U1ylxud";

    if (!AIRTABLE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Airtable no configurado" }) };
    }

    const headers = {
        "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
    };

    async function airtableGet(baseId, tableId, formula, maxRecords = 100) {
        const encoded = encodeURIComponent(formula);
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encoded}&maxRecords=${maxRecords}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.records || [];
    }

    try {
        const { email } = JSON.parse(event.body);

        if (!email) {
            return { statusCode: 400, body: JSON.stringify({ error: "Email requerido" }) };
        }

        // 1. Buscar persona y su empresa en PERSONAS
        const personRecords = await airtableGet(
            BASE_BUENTRATO,
            TABLE_PERSONAS,
            `LOWER({email}) = '${email.trim().toLowerCase()}'`,
            1
        );

        if (personRecords.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "Persona no encontrada" }) };
        }

        const persona = personRecords[0].fields;
        const empresaIds = persona.empresa; // linked record array

        if (!empresaIds || empresaIds.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "Persona sin empresa asignada" }) };
        }

        // 2. Buscar todas las personas de la misma empresa
        const allPersonas = await airtableGet(
            BASE_BUENTRATO,
            TABLE_PERSONAS,
            `AND({empresa} = '${empresaIds[0]}', {activo} = TRUE())`,
            100
        );

        // Recoger emails de todos los compañeros
        const companyEmails = allPersonas
            .map(r => r.fields.email)
            .filter(e => e);

        if (companyEmails.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "No hay compañeros en esta empresa" }) };
        }

        // 3. Buscar registros DISC de todos los emails de la empresa
        // Construimos un OR con FIND para cada email
        const emailConditions = companyEmails.map(e =>
            `FIND('${e.toLowerCase()}', LOWER(ARRAYJOIN({Email}, ',')))`
        ).join(', ');
        const discFormula = `OR(${emailConditions})`;

        const discRecords = await airtableGet(
            BASE_PRUEBAS,
            TABLE_DISC,
            discFormula,
            100
        );

        if (discRecords.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "Ningún compañero tiene DISC completado" }) };
        }

        // 4. Armar los miembros del equipo con porcentajes DISC
        const members = discRecords.map(r => {
            const f = r.fields;
            const name = Array.isArray(f.Nombre) ? f.Nombre[0] : (f["Nombre y apellido"] || "Sin nombre");
            const memberEmail = Array.isArray(f.Email) ? f.Email[0] : (f["Email de contacto"] || "");
            const role = Array.isArray(f["Cargo actual"]) ? f["Cargo actual"][0] : (f.Cargo || "");

            // Determinar estilo primario Natural
            const dNat = f.porcentaje_D_Natural || 0;
            const iNat = f.porcentaje_I_Natural || 0;
            const sNat = f.porcentaje_S_Natural || 0;
            const cNat = f.porcentaje_C_Natutal || 0; // typo en Airtable
            const scores = { D: dNat, I: iNat, S: sNat, C: cNat };
            const primaryStyle = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

            return {
                id: f.Numero || r.id,
                name: name.trim().replace(/\s+/g, ' '),
                email: memberEmail.toLowerCase(),
                role: role,
                disc: {
                    D: Math.round(dNat * 100),
                    I: Math.round(iNat * 100),
                    S: Math.round(sNat * 100),
                    C: Math.round(cNat * 100)
                },
                discAdaptado: {
                    D: Math.round((f.porcentaje_D_Adaptado || 0) * 100),
                    I: Math.round((f.porcentaje_I_Adaptado || 0) * 100),
                    S: Math.round((f.porcentaje_S_Adaptado || 0) * 100),
                    C: Math.round((f.Porcentaje_C_Adapatdo || 0) * 100) // typo en Airtable
                },
                primaryStyle
            };
        });

        // Obtener nombre de empresa (del primer persona record)
        const empresaName = Array.isArray(persona.empresa)
            ? (allPersonas[0]?.fields?.empresa?.[0] || "Equipo")
            : "Equipo";

        // Buscar nombre de empresa desde el lookup si existe
        // Usamos el nombre del primer miembro del DISC como referencia
        const firstDisc = discRecords[0]?.fields;
        const companyName = Array.isArray(firstDisc?.Empresa) ? firstDisc.Empresa[0] : "Equipo";

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                company: companyName,
                name: companyName,
                members,
                personEmail: email.trim().toLowerCase()
            })
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor" })
        };
    }
};
