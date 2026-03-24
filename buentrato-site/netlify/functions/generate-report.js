exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Claude API key no configurada" }) };
    }

    try {
        const { profile } = JSON.parse(event.body);
        if (!profile || !profile.discNatural) {
            return { statusCode: 400, body: JSON.stringify({ error: "Datos incompletos" }) };
        }

        const p = profile;
        const prompt = `Eres experto DISC de BuenTrato.AI. Genera un informe corto para ${p.name} (${p.role}, ${p.company}).

DISC Natural: D:${p.discNatural.D}% I:${p.discNatural.I}% S:${p.discNatural.S}% C:${p.discNatural.C}%
DISC Adaptado: D:${p.discAdaptado.D}% I:${p.discAdaptado.I}% S:${p.discAdaptado.S}% C:${p.discAdaptado.C}%

Responde SOLO con JSON válido, sin markdown. Cada valor debe ser UN párrafo corto (3-4 oraciones máximo). Usa "tú". Español.

{"etiqueta_estilo":"3-5 palabras definiendo su estilo","caracteristicas":"1 párrafo sobre su combinación DISC y fortalezas","estilo_personal":"1 párrafo sobre cómo lidera y se relaciona","habilidad_1_titulo":"título corto","habilidad_1":"2 oraciones","habilidad_2_titulo":"título corto","habilidad_2":"2 oraciones","habilidad_3_titulo":"título corto","habilidad_3":"2 oraciones","comunicacion_yo":"1 párrafo cómo se comunica","comunicacion_otros":"1 párrafo cómo comunicarse con esta persona","bajo_presion":"1 párrafo comportamiento bajo presión","adaptacion":"1 párrafo diferencia Natural vs Adaptado"}`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1200,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Claude API error:", errText);
            return { statusCode: response.status, body: JSON.stringify({ error: "Error API: " + response.status }) };
        }

        const data = await response.json();
        const rawText = data.content[0].text;

        let parsed;
        try {
            const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.error("Parse error:", e.message, "Raw:", rawText.substring(0, 300));
            return { statusCode: 500, body: JSON.stringify({ error: "Error procesando respuesta" }) };
        }

        // Convertir al formato que espera el frontend
        const sections = {
            etiqueta_estilo: parsed.etiqueta_estilo || "",
            caracteristicas: parsed.caracteristicas || "",
            estilo_personal: parsed.estilo_personal || "",
            habilidades_interpersonales: [
                (parsed.habilidad_1_titulo || "Habilidad 1") + ". " + (parsed.habilidad_1 || ""),
                (parsed.habilidad_2_titulo || "Habilidad 2") + ". " + (parsed.habilidad_2 || ""),
                (parsed.habilidad_3_titulo || "Habilidad 3") + ". " + (parsed.habilidad_3 || "")
            ].join("|||"),
            comunicacion_como_me_comunico: parsed.comunicacion_yo || "",
            comunicacion_como_comunicarte_conmigo: parsed.comunicacion_otros || "",
            bajo_presion: parsed.bajo_presion || "",
            adaptacion: parsed.adaptacion || ""
        };

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sections })
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno" }) };
    }
};
