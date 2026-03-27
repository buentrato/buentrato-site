// ==========================================
// Netlify Serverless Function: get-team-instruments
// Recibe un email, busca la empresa de la persona,
// y retorna todos los miembros con TODOS sus instrumentos:
// DISC, IE, Autoliderazgo, Estilos de Aprendizaje, Clima
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_BUENTRATO = "app2psDmvIE74vhkQ";
    const BASE_PRUEBAS = "appaTeQAba3xYfycx";
    const TABLE_PERSONAS = "tblw5g879AP13AiOw";
    const TABLE_EMPRESAS = "tblrxyUed67FrozPf";

    // Tablas de instrumentos en base PRUEBAS
    const TABLE_DISC = "tbl6O1XFe2U1ylxud";
    const TABLE_IE = "tblUlRhcLNtaQjlwz";
    const TABLE_AUTOLIDERAZGO = "tblpqKUEScrSIYJXe";
    const TABLE_ESTILOS = "tblQuSde7mjDWChyR";
    const TABLE_CLIMA = "tblkAJMyxVstzPsLc";

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

    async function airtableGetRecord(baseId, tableId, recordId) {
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) return null;
        return await resp.json();
    }

    try {
        const { email } = JSON.parse(event.body);
        if (!email) {
            return { statusCode: 400, body: JSON.stringify({ error: "Email requerido" }) };
        }

        // 1. Buscar persona y su empresa
        const personRecords = await airtableGet(
            BASE_BUENTRATO, TABLE_PERSONAS,
            `LOWER({email}) = '${email.trim().toLowerCase()}'`, 1
        );
        if (personRecords.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "Persona no encontrada" }) };
        }

        const persona = personRecords[0].fields;
        const empresaIds = persona.empresa;
        if (!empresaIds || empresaIds.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "Persona sin empresa asignada" }) };
        }

        // 2. Obtener empresa y sus personas
        const empresaRecord = await airtableGetRecord(BASE_BUENTRATO, TABLE_EMPRESAS, empresaIds[0]);
        if (!empresaRecord) {
            return { statusCode: 404, body: JSON.stringify({ error: "Empresa no encontrada" }) };
        }

        const empresaName = empresaRecord.fields.nombre || "Equipo";
        const personaIds = empresaRecord.fields.PERSONAS || [];
        if (personaIds.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "No hay personas en esta empresa" }) };
        }

        // 3. Buscar todas las personas activas de la empresa
        const idConditions = personaIds.map(id => `RECORD_ID() = '${id}'`).join(', ');
        const allPersonas = await airtableGet(
            BASE_BUENTRATO, TABLE_PERSONAS,
            `AND(OR(${idConditions}), {activo} = TRUE())`, 100
        );

        const companyEmails = allPersonas.map(r => r.fields.email).filter(e => e);
        if (companyEmails.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "No hay compañeros activos" }) };
        }

        // 4. Construir fórmula de búsqueda por email para tablas de PRUEBAS
        // Para DISC usamos ARRAYJOIN porque Email es linked
        const emailConditionsArrayJoin = companyEmails.map(e =>
            `FIND('${e.toLowerCase()}', LOWER(ARRAYJOIN({Email}, ',')))`
        ).join(', ');
        const discFormula = `OR(${emailConditionsArrayJoin})`;

        // Para IE, Autoliderazgo, Estilos, Clima el Email es campo directo
        const emailConditionsDirect = companyEmails.map(e =>
            `LOWER({Email}) = '${e.toLowerCase()}'`
        ).join(', ');
        const directFormula = `OR(${emailConditionsDirect})`;

        // 5. Consultar TODOS los instrumentos en paralelo
        const [discRecords, ieRecords, autoRecords, estilosRecords, climaRecords] = await Promise.all([
            airtableGet(BASE_PRUEBAS, TABLE_DISC, discFormula, 100),
            airtableGet(BASE_PRUEBAS, TABLE_IE, directFormula, 100),
            airtableGet(BASE_PRUEBAS, TABLE_AUTOLIDERAZGO, directFormula, 100),
            airtableGet(BASE_PRUEBAS, TABLE_ESTILOS, directFormula, 100),
            airtableGet(BASE_PRUEBAS, TABLE_CLIMA, directFormula, 100)
        ]);

        // 6. Indexar resultados por email para lookup rápido
        function indexByEmail(records, emailField = "Email") {
            const map = {};
            records.forEach(r => {
                const f = r.fields;
                let em = f[emailField];
                if (Array.isArray(em)) em = em[0]; // linked field
                if (em) map[em.toLowerCase()] = f;
            });
            return map;
        }

        const ieByEmail = indexByEmail(ieRecords);
        const autoByEmail = indexByEmail(autoRecords);
        const estilosByEmail = indexByEmail(estilosRecords);
        const climaByEmail = indexByEmail(climaRecords);

        // 7. Armar miembros con TODOS los instrumentos
        const members = discRecords.map(r => {
            const f = r.fields;
            const name = Array.isArray(f.Nombre) ? f.Nombre[0] : (f["Nombre y apellido"] || "Sin nombre");
            const memberEmail = (Array.isArray(f.Email) ? f.Email[0] : (f["Email de contacto"] || "")).toLowerCase();
            const role = Array.isArray(f["Cargo actual"]) ? f["Cargo actual"][0] : (f.Cargo || "");

            // DISC Natural
            const dNat = f.porcentaje_D_Natural || 0;
            const iNat = f.porcentaje_I_Natural || 0;
            const sNat = f.porcentaje_S_Natural || 0;
            const cNat = f.porcentaje_C_Natutal || 0; // typo en Airtable
            const scores = { D: dNat, I: iNat, S: sNat, C: cNat };
            const primaryStyle = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

            const member = {
                name: name.trim().replace(/\s+/g, ' '),
                email: memberEmail,
                role,
                primaryStyle,
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
                    C: Math.round((f.Porcentaje_C_Adapatdo || 0) * 100)
                }
            };

            // IE
            const ie = ieByEmail[memberEmail];
            if (ie) {
                member.ie = {
                    autoconciencia: ie["Promedio Autoconciencia"],
                    autorregulacion: ie["Promedio Autorregulación"],
                    motivacion: ie["Promedio Motivación"],
                    empatia: ie["Promedio Empatía"],
                    habilidadesSociales: ie["Promedio Habilidades Sociales"],
                    general: ie["Promedio General"],
                    nivelGeneral: ie["Nivel General"]
                };
            }

            // Autoliderazgo
            const auto = autoByEmail[memberEmail];
            if (auto) {
                member.autoliderazgo = {
                    autoconciencia: auto["Total Autoconciencia"],
                    autogestion: auto["Total Autogestión"],
                    regulacionEmocional: auto["Total Regulación Emocional"],
                    motivacion: auto["Total Motivación"],
                    adaptabilidad: auto["Total Adaptabilidad"],
                    general: auto["Total General"],
                    nivelGeneral: auto["Nivel General"]
                };
            }

            // Estilos de Aprendizaje
            const est = estilosByEmail[memberEmail];
            if (est) {
                member.estilos = {
                    visual: est["Visual"],
                    auditivo: est["Auditivo"],
                    verbal: est["Verbal"],
                    kinestesico: est["Kinestésico"]
                };
            }

            // Clima
            const clm = climaByEmail[memberEmail];
            if (clm) {
                member.clima = {
                    seguridadPsi: clm["promedio seguridad psi"],
                    comunicacion: clm["promedio comunicacion"],
                    valoracion: clm["promedio valoración y reconocimiento"],
                    colaboracion: clm["promedio colaboración y apoyo"],
                    liderazgo: clm["promedio liderazgo"],
                    general: clm["promedio clima general"]
                };
            }

            return member;
        });

        // 8. Resumen de instrumentos disponibles
        const instrumentCounts = {
            disc: members.length,
            ie: members.filter(m => m.ie).length,
            autoliderazgo: members.filter(m => m.autoliderazgo).length,
            estilos: members.filter(m => m.estilos).length,
            clima: members.filter(m => m.clima).length
        };

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                company: empresaName,
                members,
                personEmail: email.trim().toLowerCase(),
                instrumentCounts
            })
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno del servidor" }) };
    }
};
