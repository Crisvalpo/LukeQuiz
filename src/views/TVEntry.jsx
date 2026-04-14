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
        <div className="h-screen w-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 md:p-12 font-body text-white relative overflow-hidden">
            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-1/4 -left-12 w-1/2 h-1/2 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 -right-12 w-1/2 h-1/2 bg-pink-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="w-full max-w-2xl space-y-8 relative z-10 text-center flex flex-col items-center">
                <div className="space-y-6 w-full">
                    <button
                        onClick={() => navigate('/')}
                        className="absolute top-0 left-0 p-4 text-white/20 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                    >
                        <ChevronLeft size={14} /> Inicio
                    </button>

                    <LogoLukeQuiz className="w-64 md:w-80 h-auto mx-auto" />

                    <div className="flex flex-col items-center gap-4">
                        <div className="inline-flex items-center gap-3 bg-cyan-500/10 px-6 py-2 rounded-full border border-cyan-500/20">
                            <Monitor size={16} className="text-cyan-500" />
                            <p className="text-[10px] font-display font-black text-cyan-500 tracking-[0.4em] uppercase">Modo TV / Proyector</p>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase leading-none italic">
                            Conecta tu <span className="text-cyan-500">Pantalla</span>
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSumbit} className="w-full space-y-8">
                    <div className="relative group max-w-md mx-auto">
                        <input
                            ref={inputRef}
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className="w-full bg-black/40 border-4 border-white/10 rounded-3xl p-8 text-white font-display font-black text-5xl md:text-7xl text-center focus:border-cyan-500 focus:bg-cyan-500/5 focus:outline-none transition-all uppercase tracking-[0.2em] placeholder:opacity-10"
                            placeholder="PIN"
                            maxLength={8}
                            autoComplete="off"
                        />
                        <div className="absolute -bottom-10 left-0 right-0 text-center">
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                                <Keyboard size={12} /> Usa el teclado de tu TV
                            </p>
                        </div>
                    </div>

                    <div className="pt-8">
                        {loading ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="animate-spin text-cyan-500" size={48} />
                                <p className="text-[10px] font-black tracking-[0.4em] text-cyan-500 animate-pulse uppercase">Verificando sesión...</p>
                            </div>
                        ) : (
                            <button
                                type="submit"
                                className="bg-cyan-500 hover:bg-cyan-400 text-[#0f172a] px-12 py-5 rounded-2xl font-display font-black text-xl tracking-[0.2em] uppercase transition-all active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                            >
                                CONECTAR
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <footer className="absolute bottom-8 left-0 right-0 opacity-10 text-[9px] font-display font-black tracking-[0.5em] uppercase text-center pointer-events-none">
                LukeQuiz // Professional Trivia Projection
            </footer>
        </div>
    )
}
