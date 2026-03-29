// ==========================================
// Netlify Serverless Function: verify-token
// Valida un magic token, lo invalida (single-use),
// y retorna el mismo perfil que get-portal.
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

    const INSTRUMENTS = {
        disc: {
            table: "tbl6O1XFe2U1ylxud",
            codeField: null,
            label: "Informe DISC Individual",
            path: "/informe"
        },
        clima: {
            table: "tblkAJMyxVstzPsLc",
            codeField: "codigo_personal",
            label: "Experiencia en el equipo",
            path: "/experiencia"
        },
        ie: {
            table: "tblUlRhcLNtaQjlwz",
            codeField: "codigo_personal",
            label: "Inteligencia Emocional",
            path: "/ie"
        },
        autoliderazgo: {
            table: "tblpqKUEScrSIYJXe",
            codeField: "codigo_personal",
            label: "Autoliderazgo",
            path: "/autoliderazgo"
        },
        estilos: {
            table: "tblQuSde7mjDWChyR",
            codeField: "codigo_personal",
            label: "Estilos de Aprendizaje",
            path: "/estilos"
        }
    };

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
        const { token } = JSON.parse(event.body);

        if (!token || token.length < 6) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Token inválido" })
            };
        }

        // 1. Buscar persona por magic_token
        const personRecords = await airtableFetch(
            BASE_BUENTRATO,
            TABLE_PERSONAS,
            `{magic_token} = '${token}'`
        );

        if (personRecords.length === 0) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Enlace inválido o expirado. Solicita uno nuevo." })
            };
        }

        const persona = personRecords[0];
        const fields = persona.fields;

        // 2. Verificar expiración
        const expires = fields.magic_token_expires;
        if (expires && new Date(expires) < new Date()) {
            // Token expirado — limpiar
            await fetch(`https://api.airtable.com/v0/${BASE_BUENTRATO}/${TABLE_PERSONAS}/${persona.id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ fields: { magic_token: "", magic_token_expires: "" } })
            });
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Este enlace ha expirado. Solicita uno nuevo." })
            };
        }

        // 3. Invalidar token (single-use)
        await fetch(`https://api.airtable.com/v0/${BASE_BUENTRATO}/${TABLE_PERSONAS}/${persona.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ fields: { magic_token: "", magic_token_expires: "" } })
        });

        // 4. Obtener el codigo_portal (necesario para navegación interna)
        const portalCode = fields.codigo_portal;
        const email = fields.email;

        if (!email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Persona sin email registrado" })
            };
        }

        // 5. Consultar instrumentos disponibles (misma lógica que get-portal)
        const emailFormula = `FIND('${email}', ARRAYJOIN({Email}, ','))`;

        const promises = {};

        promises.disc = airtableFetch(
            BASE_BUENTRATO,
            TABLE_EVALUACIONES,
            `AND({persona} = '${email}', {estado} = 'Completada')`,
            5
        ).catch(() => []);

        for (const [key, inst] of Object.entries(INSTRUMENTS)) {
            if (key === "disc") continue;
            promises[key] = airtableFetch(
                BASE_PRUEBAS,
                inst.table,
                emailFormula
            ).catch(() => []);
        }

        const keys = Object.keys(promises);
        const results = await Promise.all(Object.values(promises));
        const resolved = {};
        keys.forEach((k, i) => { resolved[k] = results[i]; });

        // 6. Construir instrumentos disponibles
        const available = {};

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

        available.feedback = {
            available: available.disc && available.disc.available,
            code: null,
            path: "/disc"
        };

        const availableCount = ['disc', 'ie', 'autoliderazgo', 'estilos', 'clima']
            .filter(k => available[k] && available[k].available).length;
        available.plan = {
            available: availableCount >= 2,
            code: null,
            path: "/plan"
        };

        // 7. Armar perfil
        const profile = {
            name: fields.nombre_completo || ((fields.nombre || "") + " " + (fields.apellido || "")).trim(),
            firstName: fields.nombre,
            email: fields.email,
            role: fields.cargo_actual || "",
            area: fields.area_actual || "",
            portalCode: portalCode || null,
            esLider: fields.es_lider === true,
            rolPortal: fields.rol_portal || null,
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
