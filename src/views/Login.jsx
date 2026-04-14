import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { LogIn, Mail, ArrowRight } from 'lucide-react'
import LogoLukeQuiz from '../components/LogoLukeQuiz'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function Login() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        })
        if (error) toast.error('Error al iniciar sesión con Google')
    }

    const handleEmailLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin,
            }
        })

        if (error) {
            toast.error(error.message)
        } else {
            toast.success('¡Enlace enviado! Revisa tu correo')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
            <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-secondary/20 rounded-full blur-[120px] animate-pulse-slow" />

            <div className="w-full max-w-md relative z-10 animate-scale-in">
                <div className="glass p-10 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col items-center">
                    <LogoLukeQuiz className="w-64 h-auto mb-10" />

                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-display font-black text-white mb-2 uppercase tracking-tight">Bienvenido de nuevo</h1>
                        <p className="text-white/40 text-[12px] font-black uppercase tracking-[0.2em]">Accede para gestionar tus trivias</p>
                    </div>

                    <div className="w-full space-y-6">
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full bg-white text-black py-4 rounded-2xl font-black flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/5"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                            <span className="text-[14px]">CONTINUAR CON GOOGLE</span>
                        </button>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/5"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.3em]">
                                <span className="bg-surface px-4 text-white/20">O USAR EMAIL</span>
                            </div>
                        </div>

                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <div className="relative group">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                <input
                                    type="email"
                                    placeholder="TU EMAIL"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white text-[12px] font-bold tracking-widest focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary/10 border border-primary/30 hover:bg-primary text-primary hover:text-white py-5 rounded-2xl font-black text-[12px] tracking-[0.3em] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? 'ENVIANDO...' : 'ENVIAR ENLACE MÁGICO'}
                                <ArrowRight size={18} />
                            </button>
                        </form>
                    </div>

                    <p className="mt-10 text-[9px] text-white/20 font-black uppercase tracking-[0.2em] text-center max-w-[250px] leading-relaxed">
                        Al continuar, aceptas que Luke transforma tus trivias en experiencias Premium.
                    </p>
                </div>
            </div>
        </div>
    )
}
