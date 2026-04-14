import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Monitor, Loader2, ChevronLeft, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import LogoLukeQuiz from '../components/LogoLukeQuiz'

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
                    <button
                        onClick={() => navigate('/')}
                        className="absolute top-0 left-0 p-[2vh] text-white/20 hover:text-white transition-colors flex items-center gap-[1vh] text-[1.2vh] font-black uppercase tracking-widest"
                    >
                        <ChevronLeft size={16} /> Inicio
                    </button>

                    <LogoLukeQuiz className="w-[30vw] h-auto mx-auto" />

                    <div className="flex flex-col items-center gap-[2vh]">
                        <div className="inline-flex items-center gap-[1.5vh] bg-secondary/10 px-[3vh] py-[1vh] rounded-full border border-secondary/20">
                            <Monitor size={18} className="text-secondary" />
                            <p className="text-[1.2vh] font-display font-black text-secondary tracking-[0.4em] uppercase">Modo TV / Proyector</p>
                        </div>
                        <h1 className="text-[6vh] font-display font-black tracking-tighter uppercase leading-none italic">
                            Conecta tu <span className="text-secondary">Pantalla</span>
                        </h1>
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

            <footer className="absolute bottom-[4vh] left-0 right-0 opacity-10 text-[1.2vh] font-display font-black tracking-[0.5em] uppercase text-center pointer-events-none">
                LukeQuiz // Professional Trivia Projection
            </footer>
        </div>
    )
}
