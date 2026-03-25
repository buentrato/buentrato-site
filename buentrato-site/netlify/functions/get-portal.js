// ==========================================
// Netlify Serverless Function: get-portal
// Busca persona por codigo_portal en PERSONAS (base BuenTrato)
// Luego consulta en paralelo cada tabla de PRUEBAS por email
// para saber qué instrumentos tiene disponibles.
// Retorna: datos personales + instrumentos habilitados con sus códigos
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_BUENTRATO = "app2psDmvIE74vhkQ";
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";

    // Tablas en base BuenTrato
    const TABLE_PERSONAS = "tblw5g879AP13AiOw";
    const TABLE_EVALUACIONES = "tblsYWKZWqKpg2Emd";

    // Tablas de respuestas en base PRUEBAS
    const INSTRUMENTS = {
        disc: {
            table: "tbl6O1XFe2U1ylxud",    // Respuestas Equipo
            codeField: null,                  // DISC usa evaluacion_uid de EVALUACIONES
            label: "Informe DISC Individual",
            path: "/informe"
        },
        clima: {
            table: "tblkAJMyxVstzPsLc",     // Clima_Respuestas
            codeField: "codigo_personal",
            label: "Experiencia en el equipo",
            path: "/experiencia"
        },
        ie: {
            table: "tblUlRhcLNtaQjlwz",     // IE_Respuestas
            codeField: "codigo_personal",
            label: "Inteligencia Emocional",
            path: "/ie"
        },
        autoliderazgo: {
            table: "tblpqKUEScrSIYJXe",      // Autoliderazgo_Respuestas
            codeField: "codigo_personal",
            label: "Autoliderazgo",
            path: "/autoliderazgo"
        },
        estilos: {
            table: "tblQuSde7mjDWChyR",      // Estilos_Aprendizaje_Respuestas
            codeField: "codigo_personal",
            label: "Estilos de Aprendizaje",
            path: "/estilos"
        }
    };

    if (!AIRTABLE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Airtable no configurado" })
        };
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
        const { code } = JSON.parse(event.body);

        if (!code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Codigo requerido" })
            };
        }

        const codeClean = code.trim();

        // 1. Buscar persona por codigo_portal en PERSONAS (base BuenTrato)
        const personRecords = await airtableFetch(
            BASE_BUENTRATO,
            TABLE_PERSONAS,
            `{codigo_portal} = '${codeClean}'`
        );

        if (personRecords.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Codigo no encontrado. Verifica que sea correcto." })
            };
        }

        const persona = personRecords[0].fields;
        const email = persona.email;
        const personaRecordId = personRecords[0].id;

        if (!email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Persona sin email registrado" })
            };
        }

        // 2. Consultar en paralelo: EVALUACIONES (para DISC) + cada tabla de PRUEBAS (por email)
        const emailFormula = `FIND('${email}', ARRAYJOIN({Email}, ','))`;

        const promises = {};

        // DISC: buscar evaluacion_uid en EVALUACIONES vinculadas a esta persona
        // {persona} es un linked record cuyo campo primario es email
        promises.disc = airtableFetch(
            BASE_BUENTRATO,
            TABLE_EVALUACIONES,
            `AND({persona} = '${email}', {estado} = 'Completada')`,
            5
        ).catch(() => []);

        // Resto de instrumentos: buscar en PRUEBAS por email
        for (const [key, inst] of Object.entries(INSTRUMENTS)) {
            if (key === "disc") continue;
            promises[key] = airtableFetch(
                BASE_PRUEBAS,
                inst.table,
                emailFormula
            ).catch(() => []);
        }

        // Ejecutar todas en paralelo
        const keys = Object.keys(promises);
        const results = await Promise.all(Object.values(promises));
        const resolved = {};
        keys.forEach((k, i) => { resolved[k] = results[i]; });

        // 3. Construir respuesta con instrumentos disponibles
        const available = {};

        // DISC: necesita evaluacion_uid para ir directo al informe
        if (resolved.disc && resolved.disc.length > 0) {
            const eval0 = resolved.disc[0].fields;
            if (eval0.evaluacion_uid) {
                available.disc = {
                    available: true,
                    code: eval0.evaluacion_uid,
                    path: INSTRUMENTS.disc.path + "?code=" + encodeURIComponent(eval0.evaluacion_uid)
                };
            } else {
                available.disc = { available: false };
            }
        } else {
            available.disc = { available: false };
        }

        // Resto de instrumentos
        for (const [key, inst] of Object.entries(INSTRUMENTS)) {
            if (key === "disc") continue;
            const records = resolved[key] || [];
            if (records.length > 0 && inst.codeField) {
                const codeVal = records[0].fields[inst.codeField];
                available[key] = {
                    available: true,
                    code: codeVal || null,
                    path: codeVal ? (inst.path + "?code=" + encodeURIComponent(codeVal)) : inst.path
                };
            } else {
                available[key] = { available: false };
            }
        }

        // Feedback de relacionamiento: siempre disponible si tiene DISC
        available.feedback = {
            available: available.disc && available.disc.available,
            code: null,
            path: "/disc"
        };

        // Plan de desarrollo: disponible si tiene al menos 2 instrumentos
        const availableCount = ['disc', 'ie', 'autoliderazgo', 'estilos', 'clima']
            .filter(k => available[k] && available[k].available).length;
        available.plan = {
            available: availableCount >= 2,
            code: null,
            path: "/plan"
        };

        // 4. Armar perfil
        const profile = {
            name: persona.nombre_completo || (persona.nombre + " " + persona.apellido),
            firstName: persona.nombre,
            email: persona.email,
            role: persona.cargo_actual || "",
            area: persona.area_actual || "",
            instruments: available
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
