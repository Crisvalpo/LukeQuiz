import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { text, questionId, quizId } = await req.json()
        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_TTS_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!text || !questionId) throw new Error('Faltan datos requeridos (text, questionId)')

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
        const LIMIT = 800000 // 80% de 1,000,000 de caracteres

        // 1. Verificar Cuota (Switch Killer)
        const { data: usageData, error: usageError } = await supabase
            .from('system_usage')
            .select('characters_used')
            .eq('id', currentMonth)
            .single()

        const currentUsage = usageData?.characters_used || 0
        if (currentUsage + text.length > LIMIT) {
            return new Response(JSON.stringify({
                error: 'SWITCH_KILLER: Se ha alcanzado el 80% de la cuota gratuita mensual de Google TTS.',
                usage: currentUsage
            }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Llamar a Google Cloud TTS
        const ttsResponse = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text },
                    voice: { languageCode: 'es-ES', name: 'es-ES-Neural2-A', ssmlGender: 'FEMALE' },
                    audioConfig: { audioEncoding: 'MP3' },
                }),
            }
        )

        if (!ttsResponse.ok) {
            const errorData = await ttsResponse.json()
            throw new Error(`Google TTS Error: ${JSON.stringify(errorData)}`)
        }

        const { audioContent } = await ttsResponse.json()
        const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))

        // 3. Guardar en Supabase Storage
        const fileName = `${quizId}/${questionId}.mp3`
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('quiz-audio')
            .upload(fileName, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: true
            })

        if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`)

        // 4. Actualizar Contador y Retornar URL
        await supabase.rpc('increment_tts_usage', {
            month_id: currentMonth,
            char_count: text.length
        })

        const { data: { publicUrl } } = supabase.storage
            .from('quiz-audio')
            .getPublicUrl(fileName)

        return new Response(JSON.stringify({ publicUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
