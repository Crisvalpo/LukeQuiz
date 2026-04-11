import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { topic, count } = await req.json()
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

        if (!GEMINI_API_KEY) {
            throw new Error('Missing GEMINI_API_KEY')
        }

        const prompt = `Genera un quiz técnico y profesional sobre "${topic}". 
    Reglas:
    1. Genera exactamente ${count} preguntas.
    2. Las respuestas deben ser variadas y desafiantes.
    3. Para cada pregunta, identifica una palabra clave corta en inglés para buscar una imagen relacionada.
    4. Formato de respuesta: Un arreglo JSON de objetos.
    5. Cada objeto debe tener estas llaves:
       - text: La pregunta en español.
       - option_a: Opción A.
       - option_b: Opción B.
       - option_c: Opción C.
       - option_d: Opción D.
       - correct_option: Solo la letra (A, B, C o D).
       - image_url: Usa este formato exacto: https://image.pollinations.ai/prompt/{keyword_in_english}?width=800&height=600&nologo=true`

        console.log(`Generating quiz for topic: ${topic}, count: ${count}`);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                }),
            }
        )

        const result = await response.json()

        if (!response.ok) {
            console.error('Gemini API Error:', result);
            return new Response(JSON.stringify({ error: 'Gemini API Error', details: result }), {
                status: response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (!result.candidates || result.candidates.length === 0) {
            console.error('No candidates returned from Gemini:', result);
            return new Response(JSON.stringify({ error: 'No se generó contenido. Verifica los filtros de seguridad del tema.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const content = result.candidates[0].content.parts[0].text
        console.log('Gemini raw response:', content);

        const quizData = JSON.parse(content)

        return new Response(JSON.stringify(quizData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
