// ============================================================
// Genera el paquete de frases del presentador con Google Cloud TTS
// Uso:  GOOGLE_TTS_API_KEY=tu_key node scripts/generate-voice-pack.mjs
// Opcional: VOICE=es-ES-Studio-C (calidad superior) — por defecto usa
// la misma voz que las preguntas (es-ES-Neural2-A) para coherencia.
// Salida: public/sounds/voice/*.mp3 (la PWA los precachea)
// ============================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_KEY = process.env.GOOGLE_TTS_API_KEY
if (!API_KEY) {
    console.error('Falta GOOGLE_TTS_API_KEY en el entorno')
    process.exit(1)
}
const VOICE = process.env.VOICE || 'es-ES-Neural2-A'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds', 'voice')
mkdirSync(OUT, { recursive: true })

// SSML con prosodia de presentador de concursos
const LINES = {
    bienvenida: '<speak><prosody rate="105%" pitch="+2st">¡Bienvenidos a <emphasis>Luke Quiz</emphasis>! Prepárense para jugar.</prosody></speak>',
    tres_dos_uno: '<speak><prosody rate="95%">¡Tres... dos... uno!</prosody></speak>',
    se_acabo_el_tiempo: '<speak><prosody rate="105%" pitch="+1st">¡Se acabó el tiempo!</prosody></speak>',
    veamos_resultados: '<speak><prosody rate="105%">¡Veamos los resultados!</prosody></speak>',
    ultima_pregunta: '<speak><prosody rate="100%" pitch="+2st">¡Atención! <break time="200ms"/> ¡Última pregunta!</prosody></speak>',
    campeon: '<speak><prosody rate="100%" pitch="+3st">¡Tenemos un campeón! <break time="250ms"/> ¡Felicitaciones!</prosody></speak>',
    gracias_por_jugar: '<speak><prosody rate="100%">Gracias por jugar Luke Quiz. ¡Hasta la próxima!</prosody></speak>',
}

for (const [name, ssml] of Object.entries(LINES)) {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: { ssml },
            voice: { languageCode: 'es-ES', name: VOICE },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
        }),
    })
    if (!res.ok) {
        console.error(`✗ ${name}: ${res.status} ${(await res.text()).slice(0, 200)}`)
        continue
    }
    const { audioContent } = await res.json()
    writeFileSync(join(OUT, `${name}.mp3`), Buffer.from(audioContent, 'base64'))
    console.log(`✓ ${name}.mp3`)
}
console.log(`\nListo. Archivos en public/sounds/voice/ (voz: ${VOICE})`)
console.log('Tip: prueba VOICE=es-ES-Studio-C para comparar calidad.')
