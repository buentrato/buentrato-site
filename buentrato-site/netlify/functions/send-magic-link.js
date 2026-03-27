// ==========================================
// Netlify Serverless Function: send-magic-link
// Recibe un email, genera un token temporal,
// lo guarda en PERSONAS y envía un email con el link de acceso.
// ==========================================

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const BASE_BUENTRATO = "app2psDmvIE74vhkQ";
    const TABLE_PERSONAS = "tblw5g879AP13AiOw";
    const SITE_URL = "https://disc.buentrato.ai";

    if (!AIRTABLE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Airtable no configurado" }) };
    }

    const airtableHeaders = {
        "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
    };

    try {
        const { email } = JSON.parse(event.body);

        if (!email || !email.includes("@")) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Email inválido" })
            };
        }

        const emailClean = email.trim().toLowerCase();

        // 1. Buscar persona por email en PERSONAS
        const formula = encodeURIComponent(`LOWER({email}) = '${emailClean}'`);
        const url = `https://api.airtable.com/v0/${BASE_BUENTRATO}/${TABLE_PERSONAS}?filterByFormula=${formula}&maxRecords=1`;
        const personResp = await fetch(url, { headers: airtableHeaders });
        const personData = await personResp.json();
        const records = personData.records || [];

        if (records.length === 0) {
            // No revelar si el email existe o no (seguridad)
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: "Si tu email está registrado, recibirás un enlace de acceso en los próximos minutos."
                })
            };
        }

        const persona = records[0];

        // 2. Generar token (6 caracteres alfanuméricos, fácil de copiar)
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let token = "";
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Expira en 15 minutos
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // 3. Guardar token en PERSONAS
        const updateUrl = `https://api.airtable.com/v0/${BASE_BUENTRATO}/${TABLE_PERSONAS}/${persona.id}`;
        await fetch(updateUrl, {
            method: "PATCH",
            headers: airtableHeaders,
            body: JSON.stringify({
                fields: {
                    magic_token: token,
                    magic_token_expires: expires
                }
            })
        });

        // 4. Enviar email con Resend
        const magicLink = `${SITE_URL}/?token=${token}`;
        const nombre = persona.fields.nombre || "Hola";

        if (RESEND_API_KEY) {
            const emailResp = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: "BuenTrato.AI <portal@buentrato.ai>",
                    to: [emailClean],
                    subject: "Tu acceso al Portal BuenTrato.AI",
                    html: `
                        <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
                            <div style="text-align: center; margin-bottom: 24px;">
                                <img src="${SITE_URL}/logo.png" alt="BuenTrato.AI" style="height: 40px;">
                            </div>
                            <h2 style="color: #01516A; font-size: 20px; margin-bottom: 8px;">
                                ${nombre}, aquí está tu acceso
                            </h2>
                            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                                Haz clic en el botón para entrar a tu Portal de Desarrollo Personal.
                                Este enlace expira en 15 minutos.
                            </p>
                            <div style="text-align: center; margin: 28px 0;">
                                <a href="${magicLink}"
                                   style="background: linear-gradient(135deg, #0380A6, #04B5D6);
                                          color: white; text-decoration: none;
                                          padding: 14px 32px; border-radius: 8px;
                                          font-size: 15px; font-weight: 600;
                                          display: inline-block;">
                                    Entrar al Portal
                                </a>
                            </div>
                            <p style="color: #999; font-size: 12px; line-height: 1.5;">
                                Si no solicitaste este acceso, puedes ignorar este email.<br>
                                Este enlace es de un solo uso y expira en 15 minutos.
                            </p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                            <p style="color: #aaa; font-size: 11px; text-align: center;">
                                BuenTrato.AI — Mejores relaciones, mejores equipos
                            </p>
                        </div>
                    `
                })
            });

            if (!emailResp.ok) {
                const errText = await emailResp.text();
                console.error("Resend error:", errText);
                // No revelar el error al usuario
            }
        } else {
            console.warn("RESEND_API_KEY not configured. Magic link:", magicLink);
        }

        // 5. Respuesta genérica (no revelar si email existe)
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                success: true,
                message: "Si tu email está registrado, recibirás un enlace de acceso en los próximos minutos."
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
