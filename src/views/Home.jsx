import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlusCircle, Play, Settings, Terminal, Layout } from 'lucide-react'
import { generateJoinCode } from '../utils/helpers'
import { toast } from 'sonner'
import Modal from '../components/Modal'

export default function Home() {
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newQuizTitle, setNewQuizTitle] = useState('')
    const [newQuizDesc, setNewQuizDesc] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuizzes()
    }, [])

    const fetchQuizzes = async () => {
        const { data, error } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false })
        if (error) {
            toast.error('Error de Sincronización: No se pudo obtener los datos')
        } else {
            setQuizzes(data || [])
        }
        setLoading(false)
    }

    const startNewGame = async (quizId) => {
        const promise = new Promise(async (resolve, reject) => {
            const code = generateJoinCode()
            const { data: game, error } = await supabase
                .from('games')
                .insert({
                    quiz_id: quizId,
                    join_code: code,
                    status: 'waiting',
                    current_question_index: 0
                })
                .select()
                .single()

            if (error) reject(error)
            else resolve(game)
        })

        toast.promise(promise, {
            success: (game) => {
                window.open(`/screen/${game.id}`, '_blank')
                navigate(`/host/${game.id}`)
                return '¡Partida Iniciada!'
            },
            error: 'Error al iniciar el juego'
        })
    }

    const handleCreateQuiz = async (e) => {
        e.preventDefault()
        if (!newQuizTitle.trim()) return

        const { data, error } = await supabase
            .from('quizzes')
            .insert({
                title: newQuizTitle,
                description: newQuizDesc || 'Módulo de datos inicializado sin parámetros.'
            })
            .select()
            .single()

        if (error) {
            toast.error('Fallo al crear la trivia')
        } else {
            toast.success('Trivia Creada')
            setIsModalOpen(false)
            setNewQuizTitle('')
            setNewQuizDesc('')
            fetchQuizzes()
            navigate(`/edit/${data.id}`)
        }
    }

    return (
        <div className="min-h-screen bg-surface selection:bg-primary/30 font-body">
            {/* Background Glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-primary rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-20 border-b border-white/5 pb-12">
                    <div>
                        <div className="flex items-center gap-3 text-primary mb-2">
                            <Terminal size={18} />
                            <span className="font-display text-[10px] tracking-[0.4em] uppercase font-bold">Gestión de Trivias</span>
                        </div>
                        <h1 className="text-7xl font-display font-black tracking-tighter uppercase leading-none">
                            Mis <span className="text-primary italic">Trivias</span>
                        </h1>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group relative bg-primary px-8 py-4 rounded-2xl text-surface font-display font-black text-lg transition-all hover:scale-105 neon-glow-primary active:scale-95"
                    >
                        <div className="flex items-center gap-3">
                            <PlusCircle size={22} />
                            <span>CREAR TRIVIA</span>
                        </div>
                    </button>
                </header>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 glass rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {quizzes.map(q => (
                            <div key={q.id} className="glass rounded-3xl p-8 hover:bg-surface-high transition-all group border-white/5 hover:border-primary/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Layout size={80} />
                                </div>

                                <h3 className="text-3xl font-display font-bold mb-4 tracking-tight leading-none group-hover:text-primary transition-colors">
                                    {q.title}
                                </h3>
                                <p className="text-on-surface-variant font-medium text-sm mb-10 line-clamp-2 h-10">
                                    {q.description || 'Sistema inicializado. Sin parámetros adicionales definidos.'}
                                </p>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => startNewGame(q.id)}
                                        className="flex-1 bg-gradient-to-r from-primary to-primary-container text-surface font-display font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95"
                                    >
                                        <Play size={20} fill="currentColor" /> INICIAR
                                    </button>
                                    <button
                                        onClick={() => navigate(`/edit/${q.id}`)}
                                        className="bg-surface-highest p-4 rounded-2xl text-on-surface hover:bg-white/10 transition-colors border border-white/5"
                                    >
                                        <Settings size={22} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {quizzes.length === 0 && (
                            <div className="col-span-full py-32 flex flex-col items-center justify-center glass rounded-[3rem] border-dashed border-2 border-white/10 opacity-30">
                                <PlusCircle size={60} className="mb-6" />
                                <p className="text-3xl font-display font-bold uppercase tracking-widest">Sin Contenido</p>
                                <p className="mt-2 text-on-surface-variant">Crea tu primera trivia para comenzar</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="CREAR NUEVA TRIVIA"
            >
                <form onSubmit={handleCreateQuiz} className="space-y-12">
                    <div className="space-y-10">
                        <div className="space-y-4">
                            <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.3em] uppercase ml-1 flex items-center gap-2">
                                <Layout size={10} className="text-primary" /> Nombre de la Trivia
                            </label>
                            <input
                                className="w-full bg-surface-lowest border-2 border-white/5 rounded-3xl p-8 text-on-surface font-display text-4xl focus:border-primary focus:neon-glow-primary focus:outline-none transition-all placeholder:opacity-20 shadow-inner"
                                placeholder="Ej: Conocimientos Generales"
                                value={newQuizTitle}
                                onChange={(e) => setNewQuizTitle(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.3em] uppercase ml-1">Descripción</label>
                            <textarea
                                className="w-full bg-surface-lowest border-2 border-white/5 rounded-3xl p-6 text-on-surface-variant font-body text-base focus:border-primary/40 focus:outline-none transition-all placeholder:opacity-20 min-h-[140px] resize-none"
                                placeholder="Indica de qué trata esta trivia..."
                                value={newQuizDesc}
                                onChange={(e) => setNewQuizDesc(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-6 pt-6">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 bg-surface-high/50 border border-white/5 py-6 rounded-[2rem] font-display font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] bg-primary py-6 rounded-[2rem] font-display font-black uppercase tracking-[0.2em] text-surface neon-glow-primary active:scale-95 transition-all shadow-2xl hover:brightness-110"
                        >
                            Crear Trivia
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
