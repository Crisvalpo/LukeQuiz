import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Monitor, Loader2, ChevronLeft, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import LogoLukeQuiz from '../components/LogoLukeQuiz'
import CastButton from '../components/CastButton'

export default function TVEntry() {
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const inputRef = useRef(null)

    useEffect(() => {
        // Auto-focus input for TV keyboard
        if (inputRef.current) {
            inputRef.current.focus()
        }

        // Attempt to lock orientation to landscape
        const lockOrientation = async () => {
            try {
                if (screen.orientation && screen.orientation.lock) {
                    await screen.orientation.lock('landscape')
                }
            } catch (err) {
                console.log('Orientation lock not possible without fullscreen or not supported:', err)
            }
        }
        lockOrientation()
    }, [])

    const handleSumbit = async (e) => {
        if (e) e.preventDefault()
        if (code.length < 4) {
            toast.error('PIN DEMASIADO CORTO')
            return
        }
        verifyCode()
    }

    const verifyCode = async () => {
        setLoading(true)
        console.log('Verifying PIN:', code.toUpperCase())
        try {
            const { data, error } = await supabase
                .from('games')
                .select('id')
                .eq('join_code', code.toUpperCase())
                .single()

            if (error || !data) {
                toast.error('CÓDIGO INVÁLIDO')
                setLoading(false)
            } else {
                toast.success('CONECTANDO...')
                setTimeout(() => {
                    navigate(`/screen/${data.id}`)
                }, 800)
            }
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    return (
        <div className="h-screen w-screen bg-surface flex flex-col items-center justify-center p-[5vh] font-body text-white relative overflow-hidden">
            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-1/4 -left-[10vw] w-[50vw] h-[50vh] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 -right-[10vw] w-[50vw] h-[50vh] bg-secondary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="w-full max-w-[70vw] space-y-[4vh] relative z-10 text-center flex flex-col items-center">
                <div className="space-y-[3vh] w-full">
                    <div className="flex flex-col items-center gap-[1vh] mb-[4vh]">
                        <div className="inline-flex items-center gap-[1.5vh] bg-secondary/10 px-[3vh] py-[1vh] rounded-full border border-secondary/20 mb-[2vh]">
                            <Monitor size={18} className="text-secondary" />
                            <p className="text-[1.2vh] font-display font-black text-secondary tracking-[0.4em] uppercase">Proyección Profesional</p>
                        </div>
                        <h1 className="text-[7vh] font-display font-black tracking-tighter uppercase leading-none italic">
                            Conecta tu <span className="text-secondary">Pantalla</span>
                        </h1>
                        <p className="text-white/20 text-[1.4vh] font-bold tracking-[0.3em] uppercase mt-[1vh]">Ingresa el PIN de la partida para comenzar</p>
                    </div>
                </div>

                <form onSubmit={handleSumbit} className="w-full space-y-[4vh]">
                    <div className="relative group max-w-[40vw] mx-auto">
                        <input
                            ref={inputRef}
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className="w-full bg-black/40 border-[0.4vh] border-white/10 rounded-[4vh] p-[4vh] text-white font-display font-black text-[8vh] text-center focus:border-primary focus:bg-primary/5 focus:outline-none transition-all uppercase tracking-[0.2em] placeholder:opacity-10"
                            placeholder="PIN"
                            maxLength={8}
                            autoComplete="off"
                        />
                        <div className="absolute -bottom-[4vh] left-0 right-0 text-center">
                            <p className="text-[1.2vh] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center justify-center gap-[1vh]">
                                <Keyboard size={14} /> Usa el teclado de tu TV
                            </p>
                        </div>
                    </div>

                    <div className="pt-[4vh]">
                        {loading ? (
                            <div className="flex flex-col items-center gap-[2vh]">
                                <Loader2 className="animate-spin text-primary" size={48} />
                                <p className="text-[1.2vh] font-black tracking-[0.4em] text-primary animate-pulse uppercase">Verificando sesión...</p>
                            </div>
                        ) : (
                            <button
                                type="submit"
                                className="bg-primary hover:bg-primary/80 text-surface px-[8vw] py-[2.5vh] rounded-[2vh] font-display font-black text-[3vh] tracking-[0.2em] uppercase transition-all active:scale-95 shadow-[0_0_4vh_rgba(236,72,153,0.3)]"
                            >
                                CONECTAR
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <footer className="absolute bottom-0 left-0 right-0 p-[4vh] flex items-center justify-between border-t border-white/5 bg-black/20 backdrop-blur-xl">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-[1vh] text-white/40 hover:text-primary transition-all font-display font-black text-[1.2vh] tracking-[0.3em] uppercase group"
                >
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Volver al Inicio
                </button>

                <p className="absolute left-1/2 -translate-x-1/2 text-[1vh] font-display font-black tracking-[0.6em] text-white/10 uppercase pointer-events-none">
                    LukeQuiz // Professional Projection Mode
                </p>

                <div className="flex items-center gap-[2vh]">
                    <p className="text-[1vh] font-black tracking-widest text-white/20 uppercase">Transmitir Pantalla</p>
                    <CastButton url={window.location.href} />
                </div>
            </footer>

            {/* Orientation Lock Overlay */}
            <div className="tv-landscape-lock">
                <div className="rotate-icon">
                    <div className="absolute inset-2 border-2 border-white/20 rounded-sm" />
                </div>
                <h2 className="text-[3vh] font-black mb-[2vh] uppercase tracking-[0.2em] text-primary">Gira tu Pantalla</h2>
                <p className="text-white/60 font-medium uppercase tracking-[0.2em] text-[1.5vh]">Esta vista solo funciona en modo horizontal</p>
            </div>
        </div>
    )
}
