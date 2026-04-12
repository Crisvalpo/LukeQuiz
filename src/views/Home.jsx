import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Play, Settings, Trash2, PlusCircle, Search } from 'lucide-react'
import { generateJoinCode } from '../utils/helpers'
import { toast } from 'sonner'
import Modal from '../components/Modal'
import LogoLukeQuiz from '../components/LogoLukeQuiz'

export default function Home() {
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuizzes()
    }, [])

    const fetchQuizzes = async () => {
        const { data, error } = await supabase
            .from('quizzes')
            .select('*, questions(id, image_url, is_cover)')
            .order('created_at', { ascending: false })

        if (error) {
            toast.error('Error de Carga: No se pudo obtener los datos')
        } else {
            const processed = (data || []).map(quiz => {
                const coverQ = quiz.questions?.find(q => q.is_cover && q.image_url)
                const firstImg = coverQ?.image_url || quiz.questions?.find(q => q.image_url)?.image_url || null
                return { ...quiz, cover_image: firstImg }
            })
            setQuizzes(processed)
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
                description: newQuizDesc || 'Trivia recién creada sin descripción.'
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

    const deleteQuiz = async (id, title) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la trivia "${title}"? Esta acción borrará todas las preguntas, partidas y resultados asociados.`)) return

        const promise = new Promise(async (resolve, reject) => {
            try {
                const { error: qError } = await supabase.from('quizzes').delete().eq('id', id)
                if (qError) throw qError
                resolve()
            } catch (err) {
                reject(err)
            }
        })

        toast.promise(promise, {
            loading: 'Eliminando registro...',
            success: () => {
                fetchQuizzes()
                return 'Juego eliminado con éxito'
            },
            error: (err) => `Error: ${err.message}`
        })
    }

    return (
        <div className="min-h-screen bg-surface selection:bg-primary/30 font-body relative overflow-hidden">
            {/* Background Glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-1/4 -right-12 w-1/3 h-1/3 bg-primary rounded-full blur-3xl" />
            </div>

            {/* Background Decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-24 left-12 w-12 h-12 border-4 border-primary/20 rotate-45 animate-float" />
                <div className="absolute bottom-48 left-20 w-10 h-10 border-4 border-accent/20 rotate-12 animate-float [animation-delay:4s]" />
                <div className="absolute inset-0 bg-radial-gradient" />
            </div>

            <div className="w-full h-screen flex flex-col px-6 md:px-12 pt-4 md:pt-6 pb-4 md:pb-6 relative z-10 max-w-[1700px] mx-auto">
                <header className="flex justify-between items-center mb-4 px-8 pt-2 md:pt-4 shrink-0 relative z-20">
                    <div className="space-y-4 text-left">
                        <p className="text-[12px] font-display font-black tracking-[0.4em] text-primary/40 uppercase">Haz de tus preguntas un Juego</p>
                        <LogoLukeQuiz className="w-80 h-auto -ml-3" />
                    </div>
                    <button
                        onClick={() => navigate('/edit/new')}
                        className="bg-primary hover:bg-primary-hover text-white px-10 py-5 rounded-2xl font-display font-black flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20 group"
                    >
                        <Plus size={24} className="group-hover:rotate-90 transition-transform" />
                        <span className="tracking-widest text-[14px]">NUEVO</span>
                    </button>
                </header>

                <div className="flex-1 w-full bg-surface-lowest/40 backdrop-blur-3xl rounded-3xl shadow-2xl flex flex-col relative overflow-hidden border border-white/10">
                    <div className="flex-1 min-h-0 bg-black/40 shadow-inner flex flex-col overflow-hidden relative group/inner">
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 md:px-16 pt-4 md:pt-6 pb-4 md:pb-6">
                            <div className="lg:px-2">
                                {loading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                            <div key={i} className="h-[14rem] bg-white/5 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {quizzes.map(q => (
                                            <div key={q.id} className="group relative bg-surface-lowest/40 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-500 hover:shadow-xl flex flex-col h-[14rem]">
                                                {q.cover_image && (
                                                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none z-0">
                                                        <img src={q.cover_image} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}

                                                <div className="relative z-20 flex-1 flex flex-col p-6">
                                                    <div className="flex justify-end gap-2 mb-2 relative z-30">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/edit/${q.id}`) }}
                                                            className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5 cursor-pointer"
                                                            title="Configurar Trivia"
                                                        >
                                                            <Settings size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); deleteQuiz(q.id, q.title) }}
                                                            className="p-2 bg-red-500/5 rounded-lg text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all border border-red-500/5 cursor-pointer"
                                                            title="Eliminar registro"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>

                                                    <div className="flex-1 flex flex-col justify-center">
                                                        <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:text-primary transition-colors line-clamp-2 leading-tight uppercase font-display">{q.title}</h3>
                                                        <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase opacity-60">
                                                            {q.questions?.length || 0} PREGUNTAS
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-4 pt-0 relative z-30 mt-auto">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startNewGame(q.id) }}
                                                        disabled={!q.questions || q.questions.length === 0}
                                                        className={`w-full py-3 rounded-xl flex items-center justify-center gap-3 transition-all text-[10px] font-black tracking-[0.3em] cursor-pointer ${!q.questions || q.questions.length === 0
                                                            ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                                                            : 'bg-white/10 hover:bg-primary hover:text-white border border-white/10 hover:border-transparent active:scale-[0.98]'
                                                            }`}
                                                    >
                                                        <Play size={14} fill="currentColor" className={!q.questions || q.questions.length === 0 ? 'opacity-20' : ''} />
                                                        {(!q.questions || q.questions.length === 0) ? 'SIN PREGUNTAS' : 'INICIAR JUEGO'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {quizzes.length === 0 && (
                                            <div className="col-span-full h-full min-h-[400px] flex flex-col items-center justify-center gap-8 opacity-40 hover:opacity-100 transition-opacity duration-700">
                                                <div className="p-8 bg-white/5 rounded-full border border-white/10">
                                                    <PlusCircle size={48} className="text-primary animate-pulse" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xl font-black uppercase tracking-[0.5em] text-white">No hay juegos creados</p>
                                                    <p className="mt-4 text-[10px] text-on-surface-variant font-bold tracking-[0.2em] uppercase">Inicia la creación de tu primera trivia</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
