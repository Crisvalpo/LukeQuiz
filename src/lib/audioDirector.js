// ============================================================
// AudioDirector — el "presentador" sonoro de LukeQuiz
// SFX estilo concurso sintetizados con Web Audio (sin assets:
// latencia cero, sin descargas, calidad constante) + frases de
// voz pregrabadas opcionales en /sounds/voice/*.mp3
// (generarlas con: node scripts/generate-voice-pack.mjs)
// ============================================================

class AudioDirector {
    constructor() {
        this.ctx = null
        this.sfxGain = null
        this.enabled = true
        this._lastTickSecond = null
    }

    // Llamar desde un gesto del usuario (click/tap) para desbloquear audio
    ensure() {
        if (!this.enabled) return false
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext
            if (!AC) return false
            this.ctx = new AC()
            this.sfxGain = this.ctx.createGain()
            this.sfxGain.gain.value = 0.35
            this.sfxGain.connect(this.ctx.destination)
        }
        if (this.ctx.state === 'suspended') this.ctx.resume()
        return true
    }

    get ready() {
        return !!this.ctx && this.ctx.state === 'running' && this.enabled
    }

    // Ducking: atenúa los SFX (tic-tac incluido) mientras habla una voz,
    // para que el presentador nunca compita con el reloj
    setVoiceDucking(active) {
        if (!this.ctx || !this.sfxGain) return
        const t = this.ctx.currentTime
        this.sfxGain.gain.cancelScheduledValues(t)
        this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, t)
        this.sfxGain.gain.linearRampToValueAtTime(active ? 0.06 : 0.35, t + 0.15)
    }

    // --- RELOJ DE CONCURSO ---------------------------------------
    // Llamar una vez por segundo con el tiempo restante.
    // > 5s: tic-tac sobrio alternado. <= 5s: doble tic agudo (apremio).
    tick(remaining) {
        if (!this.ready || remaining <= 0) return
        if (this._lastTickSecond === remaining) return // evita dobles del mismo segundo
        this._lastTickSecond = remaining

        const urgent = remaining <= 5
        const isTock = remaining % 2 === 0
        this._tickOnce(urgent, isTock)
        if (urgent) setTimeout(() => { if (this.ready) this._tickOnce(true, !isTock) }, 250)
    }

    _tickOnce(urgent, isTock) {
        const t = this.ctx.currentTime
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'square'
        osc.frequency.value = urgent ? (isTock ? 1320 : 1560) : (isTock ? 740 : 980)
        filter.type = 'bandpass'
        filter.frequency.value = osc.frequency.value
        filter.Q.value = 7

        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(urgent ? 0.95 : 0.5, t + 0.003)
        gain.gain.exponentialRampToValueAtTime(0.001, t + (urgent ? 0.09 : 0.07))

        osc.connect(filter); filter.connect(gain); gain.connect(this.sfxGain)
        osc.start(t); osc.stop(t + 0.12)
    }

    // --- BOCINA "SE ACABÓ EL TIEMPO" ------------------------------
    timeUp() {
        if (!this.ready) return
        this._lastTickSecond = null
        const t = this.ctx.currentTime
        ;[0, 0.28].forEach((offset) => {
            const osc = this.ctx.createOscillator()
            const osc2 = this.ctx.createOscillator()
            const gain = this.ctx.createGain()
            osc.type = 'sawtooth'; osc2.type = 'sawtooth'
            osc.frequency.setValueAtTime(196, t + offset)
            osc2.frequency.setValueAtTime(147, t + offset)
            gain.gain.setValueAtTime(0, t + offset)
            gain.gain.linearRampToValueAtTime(0.7, t + offset + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.24)
            osc.connect(gain); osc2.connect(gain); gain.connect(this.sfxGain)
            osc.start(t + offset); osc.stop(t + offset + 0.26)
            osc2.start(t + offset); osc2.stop(t + offset + 0.26)
        })
    }

    // --- STING DE RESULTADOS (arpegio ascendente corto) -----------
    resultsSting() {
        if (!this.ready) return
        this._lastTickSecond = null
        const notes = [523.25, 659.25, 783.99] // C5 E5 G5
        this._arpeggio(notes, 0.09, 0.35, 'triangle')
    }

    // --- FANFARRIA DEL PODIO --------------------------------------
    podium() {
        if (!this.ready) return
        this._lastTickSecond = null
        const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5] // C5 E5 G5 C6 G5 C6
        this._arpeggio(notes, 0.14, 0.6, 'triangle', true)
    }

    _arpeggio(freqs, step, sustain, wave, chordEnd = false) {
        const t = this.ctx.currentTime
        freqs.forEach((f, i) => {
            const osc = this.ctx.createOscillator()
            const gain = this.ctx.createGain()
            osc.type = wave
            osc.frequency.value = f
            const start = t + i * step
            const isLast = i === freqs.length - 1
            const dur = isLast ? sustain : step * 1.4
            gain.gain.setValueAtTime(0, start)
            gain.gain.linearRampToValueAtTime(0.55, start + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
            osc.connect(gain); gain.connect(this.sfxGain)
            osc.start(start); osc.stop(start + dur + 0.05)
            // Acorde final para la fanfarria
            if (chordEnd && isLast) {
                [f * 0.5, f * 0.75].forEach((h) => {
                    const o2 = this.ctx.createOscillator(); const g2 = this.ctx.createGain()
                    o2.type = wave; o2.frequency.value = h
                    g2.gain.setValueAtTime(0, start)
                    g2.gain.linearRampToValueAtTime(0.3, start + 0.02)
                    g2.gain.exponentialRampToValueAtTime(0.001, start + dur)
                    o2.connect(g2); g2.connect(this.sfxGain)
                    o2.start(start); o2.stop(start + dur + 0.05)
                })
            }
        })
    }

    // --- FRASES DEL PRESENTADOR (pregrabadas, opcionales) ---------
    // Nombres esperados en /sounds/voice/: bienvenida, tres_dos_uno,
    // se_acabo_el_tiempo, veamos_resultados, ultima_pregunta,
    // campeon, gracias_por_jugar
    say(name) {
        if (!this.enabled) return
        try {
            const el = new Audio(`/sounds/voice/${name}.mp3`)
            el.volume = 1
            el.addEventListener('play', () => this.setVoiceDucking(true))
            el.addEventListener('ended', () => this.setVoiceDucking(false))
            el.addEventListener('error', () => this.setVoiceDucking(false))
            el.play().catch(() => { /* archivo no existe o autoplay bloqueado: silencio */ })
        } catch { /* noop */ }
    }
}

export const audioDirector = new AudioDirector()
