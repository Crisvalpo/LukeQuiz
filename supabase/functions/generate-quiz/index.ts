import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization');
        console.log('Authorization header present:', !!authHeader);

        const { topic, description, count } = await req.json();
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

        console.log(`Generando quiz para tema: "${topic}", cantidad: ${count}`);

        if (!GEMINI_API_KEY) {
            console.error('Error: GEMINI_API_KEY no encontrada en los secretos de Supabase');
            throw new Error('Configuración incompleta: GEMINI_API_KEY no encontrada');
        }

        const prompt = `ACTÚA COMO UN API DE DATOS. 
        TEMA PRINCIPAL: "${topic}". 
        CONTEXTO ADICIONAL: "${description || 'No se proporcionó contexto extra'}".
        CANTIDAD DE PREGUNTAS: ${count || 5}. 
        IDIOMA: ESPAÑOL.
        REGLA CRÍTICA 1: RESPONDE ÚNICAMENTE CON UN ARRAY JSON. SIN SALUDOS, SIN COMENTARIOS.
        REGLA CRÍTICA 2: Las preguntas deben ser EXTREMADAMENTE CORTAS (MÁXIMO 12 PALABRAS). Este es un concurso de TV rápido, no un examen escrito.
        REGLA CRÍTICA 3: Las opciones DEBEN ser de una o dos palabras máximo.
        FORMATO: [{"text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "image_url": "", "keyword": "..."}]`;

        const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        let lastError = "";

        for (const modelName of models) {
            try {
                console.log(`Intentando con modelo: ${modelName}`);
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                response_mime_type: "application/json"
                            },
                            safetySettings: [
                                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                            ]
                        }),
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    console.error(`Error de Google (${modelName}):`, result.error?.message || response.statusText);
                    lastError = result.error?.message || `Error API ${response.status}`;
                    continue;
                }

                if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
                    console.error(`Estructura de respuesta inesperada de ${modelName}:`, JSON.stringify(result));
                    lastError = "Respuesta vacía o malformada de la IA";
                    continue;
                }

                let content = result.candidates[0].content.parts[0].text;
                const jsonMatch = content.match(/\[[\s\S]*\]/);

                if (!jsonMatch) {
                    console.error(`No se encontró JSON en el contenido de ${modelName}:`, content);
                    throw new Error("Respuesta no contiene un array JSON válido");
                }

                console.log('¡Generación exitosa!');
                return new Response(jsonMatch[0], {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            } catch (e: any) {
                console.error(`Excepción con ${modelName}:`, e.message);
                lastError = e.message;
            }
        }

        throw new Error(`Fallo total de modelos. Último error: ${lastError}`);

    } catch (error: any) {
        console.error('Error final en la Edge Function:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, // Cambiado a 500 para mayor claridad en el cliente
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
})
