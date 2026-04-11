const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const bodyText = await req.text();
        const { topic, count } = JSON.parse(bodyText);
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

        if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no encontrada');

        // Prompt ultra-estricto para evitar saludos
        const prompt = `ACTÚA COMO UN API DE DATOS. 
        GENERAR QUIZ SOBRE: "${topic}". 
        CANTIDAD: ${count}. 
        IDIOMA: ESPAÑOL.
        REGLA CRÍTICA: RESPONDE ÚNICAMENTE CON UN ARRAY JSON. SIN SALUDOS, SIN COMENTARIOS.
        CAMPO image_url: https://loremflickr.com/800/600/${topic.replace(/\s+/g, '')},{keyword_en_ingles},popculture
        FORMATO: [{"text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "image_url": "...", "keyword": "..."}]`;

        const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        let lastError = "";

        for (const modelName of models) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            // Forzamos modo JSON en la API de Google si el modelo lo permite
                            generationConfig: {
                                response_mime_type: "application/json"
                            }
                        }),
                    }
                );

                const result = await response.json();

                if (response.ok) {
                    let content = result.candidates[0].content.parts[0].text;

                    // Limpieza agresiva de cualquier texto extra antes o después del JSON
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (!jsonMatch) throw new Error("No se encontró un array JSON en la respuesta");

                    return new Response(jsonMatch[0], {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } else {
                    lastError = result.error?.message || "Error API";
                }
            } catch (e) {
                lastError = e.message;
            }
        }

        throw new Error(`Fallo total: ${lastError}`);

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
})
