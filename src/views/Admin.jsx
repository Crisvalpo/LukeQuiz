import React, { useState, useEffect } from 'react'
import { Crown, HardDrive, Key, Copy, Plus, RefreshCcw, LogOut, Home, CheckCircle, Trash2, Users, FileText, ShieldAlert, Eye, EyeOff, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function Admin() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('codes') // 'codes' or 'moderation'
    const [codes, setCodes] = useState([])
    const [quizzes, setQuizzes] = useState([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [isLoadingData, setIsLoadingData] = useState(true)

    const isAdmin = user?.email === 'cristianluke@gmail.com'

    useEffect(() => {
        if (!loading && !isAdmin) {
            toast.error('Acceso denegado')
            navigate('/')
        }
    }, [user, loading, isAdmin, navigate])

    useEffect(() => {
        if (isAdmin) {
            if (activeTab === 'codes') fetchRecentCodes()
            else fetchAllQuizzes()
        }
    }, [isAdmin, activeTab])

    const fetchRecentCodes = async () => {
        setIsLoadingData(true)
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            toast.error('Error al cargar códigos')
        } else {
            setCodes(data)
        }
        setIsLoadingData(false)
    }

    const fetchAllQuizzes = async () => {
        setIsLoadingData(true)
        // Obtenemos todos los quizzes con información del perfil del creador
        const { data, error } = await supabase
            .from('quizzes')
            .select('*, profiles:user_id(nickname, email)')
            .order('created_at', { ascending: false })

        if (error) {
            toast.error('Error al cargar contenido')
        } else {
            // Agrupar por usuario para mejor visualización
            const grouped = data.reduce((acc, quiz) => {
                const userId = quiz.user_id || 'anonymous'
                if (!acc[userId]) {
                    acc[userId] = {
                        user: quiz.profiles || { nickname: 'Anónimo', email: 'N/A' },
                        quizzes: []
                    }
                }
                acc[userId].quizzes.push(quiz)
                return acc
            }, {})
            setQuizzes(Object.values(grouped))
        }
        setIsLoadingData(false)
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
        if (!confirm('¿Eliminar este código de acceso?')) return
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

    const deleteQuiz = async (id, title) => {
        if (!confirm(`MODERACIÓN: ¿Estás seguro de eliminar la trivia "${title}" de forma permanente?`)) return

        const { error } = await supabase
            .from('quizzes')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error('Error al eliminar contenido')
        } else {
            toast.success('Contenido eliminado por moderación')
            fetchAllQuizzes()
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        toast.info('Copiado al portapapeles')
    }

    if (loading || !isAdmin) return null

    return (
        <div className="min-h-screen bg-surface font-sans text-white p-6 pb-32">
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

            {/* Tabs */}
            <div className="flex gap-2 mb-8 bg-black/20 p-1 rounded-2xl border border-white/5">
                <button
                    onClick={() => setActiveTab('codes')}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'codes' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                >
                    <Key size={14} /> CÓDIGOS
                </button>
                <button
                    onClick={() => setActiveTab('moderation')}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'moderation' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white/60'}`}
                >
                    <ShieldAlert size={14} /> MODERACIÓN
                </button>
            </div>

            {activeTab === 'codes' ? (
                <>
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
                            <button onClick={fetchRecentCodes}><RefreshCcw size={12} className={isLoadingData ? 'animate-spin' : ''} /></button>
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
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-8">
                    <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
                        CONTROL DE CONTENIDO (PÚBLICO Y PRIVADO)
                        <button onClick={fetchAllQuizzes}><RefreshCcw size={12} className={isLoadingData ? 'animate-spin' : ''} /></button>
                    </h3>

                    <div className="space-y-6">
                        {quizzes.map((group) => (
                            <div key={group.user.email} className="bg-surface-lowest/40 rounded-2xl border border-white/5 p-4 space-y-4 shadow-xl">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-[10px] text-primary border border-primary/20">
                                            {group.user.nickname?.[0] || 'U'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{group.user.nickname}</p>
                                            <p className="text-[8px] font-bold text-white/30">{group.user.email}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 px-2 py-1 rounded-md">
                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{group.quizzes.length} TRIVIAS</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {group.quizzes.map((quiz) => (
                                        <div key={quiz.id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl group hover:bg-black/40 transition-all">
                                            <div className="flex items-center gap-3">
                                                {quiz.visibility === 'public' ? <Eye size={14} className="text-green-500/60" /> : <EyeOff size={14} className="text-amber-500/60" />}
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wide group-hover:text-primary transition-colors">{quiz.title}</p>
                                                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">
                                                        {new Date(quiz.created_at).toLocaleDateString()} • {quiz.visibility === 'public' ? 'PÚBLICO' : 'PRIVADO'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => navigate(`/edit/${quiz.id}`)}
                                                    className="p-2 text-white/10 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                    title="Editar"
                                                >
                                                    <Settings size={16} />
                                                </button>
                                                <button
                                                    onClick={() => deleteQuiz(quiz.id, quiz.title)}
                                                    className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* User Badge */}
            <div className="fixed bottom-6 left-6 right-6 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl flex items-center justify-between z-50 shadow-2xl">
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
                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">SUPERADMIN</span>
                </div>
            </div>
        </div>
    )
}
