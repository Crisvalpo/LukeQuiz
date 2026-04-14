import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Monitor, Loader2, Delete, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import LogoLukeQuiz from '../components/LogoLukeQuiz'

export default function TVEntry() {
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleNumberClick = (num) => {
        if (code.length < 6) {
            setCode(prev => prev + num)
        }
    }

    const handleDelete = () => {
        setCode(prev => prev.slice(0, -1))
    }

    useEffect(() => {
        if (code.length === 6) {
            verifyCode()
        }
    }, [code])

    const verifyCode = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('games')
            .select('id')
            .eq('join_code', code.toUpperCase())
            .single()

        if (error || !data) {
            toast.error('CÓDIGO INVÁLIDO')
            setCode('')
            setLoading(false)
        } else {
            toast.success('CONECTANDO A LA PANTALLA...')
            setTimeout(() => {
                navigate(`/screen/${data.id}`)
            }, 1000)
        }
    }

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key >= '0' && e.key <= '9') {
                handleNumberClick(e.key)
            } else if (e.key === 'Backspace') {
                handleDelete()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [code])

    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 font-body text-white relative overflow-hidden">
            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none opacity-10">
                <div className="absolute top-1/4 -left-12 w-1/3 h-1/3 bg-primary rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 -right-12 w-1/3 h-1/3 bg-secondary rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="w-full max-w-4xl space-y-12 relative z-10 text-center">
                <div className="space-y-4">
                    <button
                        onClick={() => navigate('/')}
                        className="absolute top-0 left-0 p-4 text-white/20 hover:text-white transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                    >
                        <ChevronLeft size={16} /> Volver
                    </button>
                    <LogoLukeQuiz className="w-72 h-auto mx-auto mb-8" />
                    <div className="inline-flex items-center gap-3 bg-primary/10 px-6 py-2 rounded-full border border-primary/20 mb-4">
                        <Monitor size={16} className="text-primary" />
                        <p className="text-[10px] font-display font-black text-primary tracking-[0.4em] uppercase">Modo TV / Proyector</p>
                    </div>
                    <h1 className="text-5xl font-display font-black tracking-tighter uppercase leading-none italic">
                        Conecta tu <span className="text-primary">Pantalla</span>
                    </h1>
                    <p className="text-sm font-bold text-white/40 uppercase tracking-[0.2em]">Ingresa el PIN de 6 dígitos del juego</p>
                </div>

                <div className="flex justify-center gap-4">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                        <div
                            key={idx}
                            className={`w-16 h-20 md:w-24 md:h-32 bg-black/40 border-2 rounded-2xl flex items-center justify-center text-4xl md:text-6xl font-display font-black transition-all duration-300 ${code[idx] ? 'border-primary text-white shadow-lg shadow-primary/20 scale-105' : 'border-white/10 text-white/5'}`}
                        >
                            {code[idx] || '•'}
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <Loader2 className="animate-spin text-primary" size={48} />
                        <p className="text-xs font-black tracking-[0.4em] text-primary animate-pulse uppercase">Sincronizando...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-6 max-w-md mx-auto pt-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumberClick(num.toString())}
                                className="h-20 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl text-3xl font-display font-black transition-all active:scale-95 flex items-center justify-center"
                            >
                                {num}
                            </button>
                        ))}
                        <div />
                        <button
                            onClick={() => handleNumberClick('0')}
                            className="h-20 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl text-3xl font-display font-black transition-all active:scale-95 flex items-center justify-center"
                        >
                            0
                        </button>
                        <button
                            onClick={handleDelete}
                            className="h-20 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/30 rounded-2xl text-red-500 transition-all active:scale-95 flex items-center justify-center"
                        >
                            <Delete size={32} />
                        </button>
                    </div>
                )}
            </div>

            <footer className="mt-20 opacity-20 text-[10px] font-display font-black tracking-[0.6em] uppercase text-center border-t border-white/5 pt-8 w-full max-w-4xl">
                Esperando PIN de sesión activa // LukeQuiz TV Link
            </footer>
        </div>
    )
}
