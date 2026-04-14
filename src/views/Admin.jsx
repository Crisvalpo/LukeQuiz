import React, { useState, useEffect } from 'react'
import { Crown, HardDrive, Key, Copy, Plus, RefreshCcw, LogOut, Home, CheckCircle, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function Admin() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    const [codes, setCodes] = useState([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [isLoadingCodes, setIsLoadingCodes] = useState(true)

    const isAdmin = user?.email === 'cristianluke@gmail.com'

    useEffect(() => {
        if (!loading && !isAdmin) {
            toast.error('Acceso denegado')
            navigate('/')
        }
    }, [user, loading, isAdmin, navigate])

    useEffect(() => {
        if (isAdmin) {
            fetchRecentCodes()
        }
    }, [isAdmin])

    const fetchRecentCodes = async () => {
        setIsLoadingCodes(true)
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) {
            toast.error('Error al cargar códigos')
        } else {
            setCodes(data)
        }
        setIsLoadingCodes(false)
    }

    const generateCode = async () => {
        setIsGenerating(true)
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
        const newCode = `${randomStr}`

        try {
            const { error } = await supabase
                .from('promo_codes')
                .insert([{
                    code: newCode,
                    type: '24h_pass'
                }])

            if (error) throw error

            toast.success('Pase de 24h generado', {
                description: `Código: ${newCode}`
            })
            fetchRecentCodes()
            copyToClipboard(newCode)
        } catch (error) {
            console.error('Error generating code:', error)
            toast.error('Error al generar código')
        } finally {
            setIsGenerating(false)
        }
    }

    const deleteCode = async (id) => {
        const { error } = await supabase
            .from('promo_codes')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error('Error al eliminar')
        } else {
            setCodes(codes.filter(c => c.id !== id))
            toast.success('Código eliminado')
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        toast.info('Copiado al portapapeles')
    }

    if (loading || !isAdmin) return null

    return (
        <div className="min-h-screen bg-surface font-sans text-white p-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-xl border border-primary/20">
                        <HardDrive className="text-primary" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight uppercase">Admin Panel</h1>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-none">LukeQUIZ Control</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                    <Home size={20} />
                </button>
            </div>

            {/* Main Action - Huge Button for Mobile */}
            <div className="mb-10 text-center">
                <button
                    onClick={generateCode}
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-br from-primary to-primary-hover p-6 rounded-2xl shadow-2xl shadow-primary/20 flex flex-col items-center gap-3 group active:scale-95 transition-all"
                >
                    <div className="bg-white/20 p-4 rounded-full group-hover:scale-110 transition-transform">
                        {isGenerating ? <RefreshCcw className="animate-spin" size={32} /> : <Plus size={32} />}
                    </div>
                    <span className="text-lg font-black tracking-[0.1em]">GENERAR PASE 24H</span>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-none">($1.000 CLP)</span>
                </button>
            </div>

            {/* Recent Codes */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
                    CÓDIGOS RECIENTES
                    <button onClick={fetchRecentCodes}><RefreshCcw size={12} className={isLoadingCodes ? 'animate-spin' : ''} /></button>
                </h3>

                <div className="space-y-3">
                    {codes.map((code) => (
                        <div
                            key={code.id}
                            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${code.used_at
                                ? 'bg-white/2 border-white/5 opacity-40'
                                : 'bg-surface-lowest border-white/10 shadow-lg'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {code.used_at ? <CheckCircle size={16} className="text-white/20" /> : <Key size={16} className="text-primary" />}
                                <div>
                                    <p className={`font-black tracking-widest text-sm ${code.used_at ? 'line-through' : ''}`}>
                                        {code.code}
                                    </p>
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                                        {code.used_at ? `USADO: ${new Date(code.used_at).toLocaleDateString()}` : 'DISPONIBLE'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {!code.used_at && (
                                    <button
                                        onClick={() => copyToClipboard(code.code)}
                                        className="p-2 bg-primary/10 rounded-lg text-primary hover:bg-primary/20 transition-colors"
                                    >
                                        <Copy size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteCode(code.id)}
                                    className="p-2 bg-red-500/10 rounded-lg text-red-500 hover:bg-red-500/20 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {codes.length === 0 && !isLoadingCodes && (
                        <p className="text-center py-10 text-white/20 text-xs font-bold uppercase tracking-widest">No hay códigos generados</p>
                    )}
                </div>
            </div>

            {/* User Badge */}
            <div className="fixed bottom-6 left-6 right-6 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-black text-xs text-black shadow-lg shadow-amber-500/20">
                        CL
                    </div>
                    <div className="leading-tight">
                        <p className="text-[10px] font-black text-white tracking-widest leading-none">CRISTIAN LUKE</p>
                        <p className="text-[8px] font-bold text-white/30 truncate max-w-[150px]">{user?.email}</p>
                    </div>
                </div>
                <div className="bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">PROPIETARIO</span>
                </div>
            </div>
        </div>
    )
}
