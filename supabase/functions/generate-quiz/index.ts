const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const bodyText = await req.text();
        const { topic, description, count } = JSON.parse(bodyText);
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

        if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no encontrada');

        const prompt = `ACTÚA COMO UN API DE DATOS. 
        TEMA PRINCIPAL: "${topic}". 
        CONTEXTO ADICIONAL: "${description || 'No se proporcionó contexto extra'}".
        CANTIDAD DE PREGUNTAS: ${count || 5}. 
        IDIOMA: ESPAÑOL.
        REGLA CRÍTICA 1: RESPONDE ÚNICAMENTE CON UN ARRAY JSON. SIN SALUDOS, SIN COMENTARIOS.
        REGLA CRÍTICA 2: Las preguntas deben ser EXTREMADAMENTE CORTAS (MÁXIMO 12 PALABRAS). Este es un concurso de TV rápido, no un examen escrito.
        REGLA CRÍTICA 3: Las opciones DEBEN ser de una o dos palabras máximo.
        FORMATO: [{"text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "image_url": "", "keyword": "..."}]`;

        const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
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
                            generationConfig: {
                                response_mime_type: "application/json"
                            }
                        }),
                    }
                );

                const result = await response.json();

                if (response.ok) {
                    let content = result.candidates[0].content.parts[0].text;
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (!jsonMatch) throw new Error("No se encontró un array JSON en la respuesta");

                    return new Response(jsonMatch[0], {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } else {
                    lastError = result.error?.message || "Error API";
                }
            } catch (e: any) {
                lastError = e.message;
            }
        }

        throw new Error(`Fallo total de modelos: ${lastError}`);

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
})
