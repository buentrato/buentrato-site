// ==========================================
// Netlify Serverless Function: get-team
// Lee datos del equipo desde Airtable
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Airtable no configurado. Agrega AIRTABLE_API_KEY y AIRTABLE_BASE_ID en las variables de entorno." })
        };
    }

    try {
        const { teamCode } = JSON.parse(event.body);

        if (!teamCode) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Código de equipo requerido" })
            };
        }

        // Tabla en Airtable
        const tableName = encodeURIComponent("Respuestas Equipo");

        // Obtener todos los registros (con paginación)
        let allRecords = [];
        let offset = null;

        do {
            let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?pageSize=100`;
            if (offset) url += `&offset=${offset}`;

            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("Airtable error:", errText);
                return {
                    statusCode: response.status,
                    body: JSON.stringify({ error: "Error al conectar con Airtable" })
                };
            }

            const data = await response.json();
            allRecords = allRecords.concat(data.records);
            offset = data.offset || null;
        } while (offset);

        // Generar códigos para cada combinación Empresa + Equipo
        // Formato del código: primeras letras de empresa + equipo en mayúsculas
        // Ejemplo: "Esri Colombia" + "GH" → "ESRI-GH"
        // También aceptar códigos personalizados del mapa TEAM_CODES

        const teamGroups = {};

        allRecords.forEach(record => {
            const fields = record.fields;
            const empresa = (fields["Empresa"] || "").trim();
            const equipo = (fields["Equipo"] || "").trim();
            const nombre = (fields["Nombre y apellido"] || "").trim();

            if (!empresa || !nombre) return;

            // Crear key del grupo
            const groupKey = equipo ? `${empresa}|||${equipo}` : `${empresa}|||_general`;

            if (!teamGroups[groupKey]) {
                teamGroups[groupKey] = {
                    empresa,
                    equipo: equipo || "General",
                    members: []
                };
            }

            // Parsear porcentajes (quitar % y convertir a número)
            const parsePerc = (val) => {
                if (!val) return 0;
                const str = String(val).replace("%", "").trim();
                return Math.round(parseFloat(str) * 100) / 100 || 0;
            };

            const discNatural = {
                D: parsePerc(fields["porcentaje_D_Natural"]),
                I: parsePerc(fields["porcentaje_I_Natural"]),
                S: parsePerc(fields["porcentaje_S_Natural"]),
                C: parsePerc(fields["porcentaje_C_Natural"])
            };

            const discAdaptado = {
                D: parsePerc(fields["porcentaje_D_Adaptado"]),
                I: parsePerc(fields["porcentaje_I_Adaptado"]),
                S: parsePerc(fields["porcentaje_S_Adaptado"]),
                C: parsePerc(fields["porcentaje_C_Adaptado"])
            };

            // Determinar estilo primario (el más alto del natural)
            const naturalScores = [
                { style: "D", score: discNatural.D },
                { style: "I", score: discNatural.I },
                { style: "S", score: discNatural.S },
                { style: "C", score: discNatural.C }
            ];
            naturalScores.sort((a, b) => b.score - a.score);
            const primaryStyle = naturalScores[0].style;

            teamGroups[groupKey].members.push({
                id: record.id,
                name: nombre,
                role: (fields["Cargo"] || "").trim(),
                disc: discNatural,
                discAdaptado: discAdaptado,
                primaryStyle
            });
        });

        // Generar código automático para cada grupo
        // Formato: Primeras 3-4 letras de empresa + guión + equipo (todo en mayúsculas, sin espacios)
        function generateCode(empresa, equipo) {
            const empCode = empresa
                .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
                .split(" ")
                .map(w => w.substring(0, 4).toUpperCase())
                .join("")
                .substring(0, 8);

            const eqCode = equipo === "General" ? "GEN" :
                equipo
                    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
                    .split(" ")
                    .map(w => w.substring(0, 4).toUpperCase())
                    .join("")
                    .substring(0, 6);

            return `${empCode}-${eqCode}`;
        }

        // Buscar el equipo que coincida con el código ingresado
        const codeUpper = teamCode.toUpperCase().trim();
        let matchedTeam = null;

        for (const [key, group] of Object.entries(teamGroups)) {
            const code = generateCode(group.empresa, group.equipo);
            if (code === codeUpper) {
                matchedTeam = {
                    code,
                    name: group.equipo === "General" ? group.empresa : `${group.empresa} - ${group.equipo}`,
                    company: group.empresa,
                    members: group.members
                };
                break;
            }
        }

        // Si no encontró por código generado, buscar por coincidencia parcial
        if (!matchedTeam) {
            for (const [key, group] of Object.entries(teamGroups)) {
                const code = generateCode(group.empresa, group.equipo);
                // Buscar coincidencia parcial
                if (code.includes(codeUpper) || codeUpper.includes(code)) {
                    matchedTeam = {
                        code,
                        name: group.equipo === "General" ? group.empresa : `${group.empresa} - ${group.equipo}`,
                        company: group.empresa,
                        members: group.members
                    };
                    break;
                }
            }
        }

        if (!matchedTeam) {
            // Devolver los códigos disponibles para debugging (quitar en producción)
            const availableCodes = Object.entries(teamGroups).map(([key, group]) => ({
                code: generateCode(group.empresa, group.equipo),
                name: group.equipo === "General" ? group.empresa : `${group.empresa} - ${group.equipo}`,
                count: group.members.length
            }));

            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    error: "Equipo no encontrado",
                    availableCodes
                })
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(matchedTeam)
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor" })
        };
    }
};
