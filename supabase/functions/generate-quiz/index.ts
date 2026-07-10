import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        // --- Verificación de usuario y premium (server-side) ---
        const authHeader = req.headers.get('Authorization')
        const token = authHeader?.replace('Bearer ', '')
        if (!token) return jsonResponse({ error: 'No autorizado' }, 401)

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { data: { user }, error: authError } = await admin.auth.getUser(token)
        if (authError || !user) return jsonResponse({ error: 'Sesión inválida' }, 401)

        const { data: profile } = await admin
            .from('profiles')
            .select('is_premium, premium_until')
            .eq('id', user.id)
            .maybeSingle()

        const isPremium = profile?.is_premium ||
            (profile?.premium_until && new Date(profile.premium_until) > new Date())
        if (!isPremium) {
            return jsonResponse({ error: 'Función exclusiva Premium', error_code: 'PREMIUM_REQUIRED' }, 403)
        }
        // --- Fin verificación ---

        const { topic, description, count } = await req.json();
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

        // Límites defensivos para evitar abuso de cuota
        const safeCount = Math.min(Math.max(parseInt(count) || 5, 1), 20)
        const safeTopic = String(topic || '').slice(0, 200)
        const safeDescription = String(description || '').slice(0, 500)

        console.log(`Generando quiz para tema: "${safeTopic}", cantidad: ${safeCount} (user: ${user.id})`);

        if (!GEMINI_API_KEY) {
            console.error('Error: GEMINI_API_KEY no encontrada en los secretos de Supabase');
            throw new Error('Configuración incompleta: GEMINI_API_KEY no encontrada');
        }

        const prompt = `ACTÚA COMO UN API DE DATOS.
        TEMA PRINCIPAL: "${safeTopic}".
        CONTEXTO ADICIONAL: "${safeDescription || 'No se proporcionó contexto extra'}".
        CANTIDAD DE PREGUNTAS: ${safeCount}.
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
        return jsonResponse({ error: error.message }, 500);
    }
})
