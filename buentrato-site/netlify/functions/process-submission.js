// ==========================================
// Netlify Serverless Function: process-submission
// Procesa registros nuevos en Airtable:
//   1. Busca registros sin procesado_n8n en cada tabla de instrumentos
//   2. Genera codigo_personal para cada uno
//   3. Si la persona no tiene codigo_portal, lo genera
//   4. Para DISC, crea registro en EVALUACIONES si no existe
//
// Se puede llamar:
//   - POST con { table: "disc" } para procesar una tabla específica
//   - POST con { table: "all" } para procesar todas
//   - GET para procesar todas (útil para cron/scheduler)
// ==========================================

exports.handler = async (event) => {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_BUENTRATO = "app2psDmvIE74vhkQ";
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";

    const TABLE_PERSONAS = "tblw5g879AP13AiOw";
    const TABLE_EVALUACIONES = "tblsYWKZWqKpg2Emd";

    const INSTRUMENTS = {
        disc: {
            table: "tbl6O1XFe2U1ylxud",
            prefix: "DC",
            emailField: "Email",          // lookup field (array)
            personaField: "persona",      // linked record
            nameField: "Nombre"           // lookup field
        },
        ie: {
            table: "tblUlRhcLNtaQjlwz",
            prefix: "IE",
            emailField: "Email",
            personaField: "persona",
            nameField: "Nombre"
        },
        autoliderazgo: {
            table: "tblpqKUEScrSIYJXe",
            prefix: "AL",
            emailField: "Email",
            personaField: "persona",
            nameField: "Nombre"
        },
        estilos: {
            table: "tblQuSde7mjDWChyR",
            prefix: "EA",
            emailField: "Email",
            personaField: "persona",
            nameField: "Nombre"
        },
        clima: {
            table: "tblkAJMyxVstzPsLc",
            prefix: "CL",
            emailField: "Email",
            personaField: "persona",
            nameField: "Nombre"
        }
    };

    if (!AIRTABLE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Airtable no configurado" }) };
    }

    const headers = {
        "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
    };

    // --- Airtable helpers ---
    async function airtableGet(baseId, tableId, formula, maxRecords = 10) {
        const encoded = encodeURIComponent(formula);
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encoded}&maxRecords=${maxRecords}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            const errText = await resp.text();
            console.error(`Airtable GET error: ${resp.status}`, errText);
            return [];
        }
        const data = await resp.json();
        return data.records || [];
    }

    async function airtableUpdate(baseId, tableId, recordId, fields) {
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
        const resp = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ fields })
        });
        if (!resp.ok) {
            const errText = await resp.text();
            console.error(`Airtable PATCH error: ${resp.status}`, errText);
            return null;
        }
        return await resp.json();
    }

    async function airtableCreate(baseId, tableId, fields) {
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
        const resp = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ fields })
        });
        if (!resp.ok) {
            const errText = await resp.text();
            console.error(`Airtable POST error: ${resp.status}`, errText);
            return null;
        }
        return await resp.json();
    }

    // --- Code generation ---
    function generateCode(prefix) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = prefix + "-";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    function generatePortalCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "PT-";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    function generateEvalUid(name) {
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const slug = (name || "persona").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 30);
        return `EVAL_${date}_${slug}`;
    }

    // --- Main processing ---
    async function processTable(key) {
        const inst = INSTRUMENTS[key];
        const results = { table: key, processed: 0, errors: [] };

        // Buscar registros sin procesar (procesado_n8n != true)
        // Usamos NOT({procesado_n8n}) que es true cuando el campo es vacío/false
        const unprocessed = await airtableGet(
            BASE_PRUEBAS,
            inst.table,
            "NOT({procesado_n8n})",
            50
        );

        console.log(`[${key}] Found ${unprocessed.length} unprocessed records`);

        for (const record of unprocessed) {
            try {
                const fields = record.fields;

                // Obtener email (puede ser lookup array o texto directo)
                let email = null;
                const emailVal = fields[inst.emailField];
                if (Array.isArray(emailVal)) {
                    email = emailVal[0];
                } else if (typeof emailVal === 'string') {
                    email = emailVal;
                }
                // Fallback: campo de texto directo del formulario
                if (!email && fields["Email de contacto"]) {
                    email = fields["Email de contacto"];
                }

                if (!email) {
                    results.errors.push({ record: record.id, error: "Sin email" });
                    continue;
                }

                // 1. Generar codigo_personal
                const codigoPersonal = generateCode(inst.prefix);

                // 2. Actualizar registro con codigo_personal + procesado_n8n
                await airtableUpdate(BASE_PRUEBAS, inst.table, record.id, {
                    codigo_personal: codigoPersonal,
                    procesado_n8n: true
                });

                // 3. Verificar que la persona tenga codigo_portal en PERSONAS
                const personaRecords = await airtableGet(
                    BASE_BUENTRATO,
                    TABLE_PERSONAS,
                    `{email} = '${email}'`,
                    1
                );

                if (personaRecords.length > 0) {
                    const persona = personaRecords[0];
                    if (!persona.fields.codigo_portal) {
                        const portalCode = generatePortalCode();
                        await airtableUpdate(BASE_BUENTRATO, TABLE_PERSONAS, persona.id, {
                            codigo_portal: portalCode
                        });
                        console.log(`[${key}] Generated portal code ${portalCode} for ${email}`);
                    }

                    // 4. Para DISC: crear registro en EVALUACIONES si no existe
                    if (key === "disc") {
                        const existingEvals = await airtableGet(
                            BASE_BUENTRATO,
                            TABLE_EVALUACIONES,
                            `AND({persona} = '${email}', {estado} = 'Completada')`,
                            1
                        );

                        if (existingEvals.length === 0) {
                            const nombre = Array.isArray(fields[inst.nameField])
                                ? fields[inst.nameField][0]
                                : fields[inst.nameField] || email;
                            const evalUid = generateEvalUid(nombre);
                            await airtableCreate(BASE_BUENTRATO, TABLE_EVALUACIONES, {
                                evaluacion_uid: evalUid,
                                persona: [persona.id],
                                estado: "Completada",
                                fecha_realizacion: new Date().toISOString().split('T')[0]
                            });
                            console.log(`[${key}] Created EVALUACIONES record ${evalUid} for ${email}`);
                        }
                    }
                } else {
                    console.warn(`[${key}] No PERSONAS record found for ${email}`);
                    results.errors.push({ record: record.id, error: `No persona for ${email}` });
                }

                results.processed++;
                console.log(`[${key}] Processed ${record.id} → ${codigoPersonal}`);

            } catch (err) {
                console.error(`[${key}] Error processing ${record.id}:`, err);
                results.errors.push({ record: record.id, error: err.message });
            }
        }

        return results;
    }

    try {
        // Determinar qué tablas procesar
        let tablesToProcess = Object.keys(INSTRUMENTS);

        if (event.httpMethod === "POST" && event.body) {
            try {
                const body = JSON.parse(event.body);
                if (body.table && body.table !== "all") {
                    if (INSTRUMENTS[body.table]) {
                        tablesToProcess = [body.table];
                    } else {
                        return {
                            statusCode: 400,
                            body: JSON.stringify({ error: `Tabla no válida: ${body.table}. Opciones: ${Object.keys(INSTRUMENTS).join(', ')}, all` })
                        };
                    }
                }
            } catch (e) {
                // Body no es JSON válido, procesar todas
            }
        }

        console.log(`Processing tables: ${tablesToProcess.join(', ')}`);

        // Procesar todas las tablas en paralelo
        const allResults = await Promise.all(
            tablesToProcess.map(key => processTable(key))
        );

        const summary = {
            timestamp: new Date().toISOString(),
            tables: allResults,
            totalProcessed: allResults.reduce((sum, r) => sum + r.processed, 0),
            totalErrors: allResults.reduce((sum, r) => sum + r.errors.length, 0)
        };

        console.log(`Done. Processed: ${summary.totalProcessed}, Errors: ${summary.totalErrors}`);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(summary)
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno", details: error.message })
        };
    }
};
