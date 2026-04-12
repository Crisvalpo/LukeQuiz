import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlusCircle, Plus, Play, Settings, Terminal, Layout, Trash2, BookOpen, Brain } from 'lucide-react'
import { generateJoinCode } from '../utils/helpers'
import { toast } from 'sonner'
import Modal from '../components/Modal'
import LogoLukeQuiz from '../components/LogoLukeQuiz'

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
                const { error: gError } = await supabase.from('games').delete().eq('quiz_id', id)
                if (gError) throw gError
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
                                            <div key={q.id} className="group relative bg-surface-lowest/40 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-500 hover:shadow-xl flex flex-col p-6 h-[14rem]">
                                                {q.cover_image && (
                                                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
                                                        <img src={q.cover_image} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}

                                                <div className="relative z-20 flex-1">
                                                    <div className="flex items-start justify-between">
                                                        <div className="p-3 bg-primary/10 rounded-xl w-fit mb-8 text-primary border border-primary/20">
                                                            <Brain size={20} />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => navigate(`/edit/${q.id}`)}
                                                                className="p-3 bg-white/5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                                                                title="Configurar Trivia"
                                                            >
                                                                <Settings size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteQuiz(q.id, q.title)}
                                                                className="p-3 bg-red-500/5 rounded-xl text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all border border-red-500/5"
                                                                title="Eliminar registro"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-white mb-4 tracking-tight group-hover:text-primary transition-colors line-clamp-2 leading-tight">{q.title}</h3>
                                                    <div className="flex items-center gap-4 opacity-40">
                                                        <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-[0.2em]">{q.id.slice(0, 8)}</span>
                                                        <div className="h-1 w-1 bg-white/20 rounded-full" />
                                                        <span className="text-[10px] font-black tracking-widest text-primary uppercase">
                                                            {q.questions?.length || 0} PREGUNTAS
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-12 pt-10 border-t border-white/5 relative z-20">
                                                    <button
                                                        onClick={() => startNewGame(q.id)}
                                                        disabled={!q.questions || q.questions.length === 0}
                                                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-4 transition-all text-[11px] font-black tracking-widest ${!q.questions || q.questions.length === 0
                                                            ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                                                            : 'bg-white/5 hover:bg-primary hover:text-white border border-white/10 hover:border-transparent active:scale-[0.98]'
                                                            }`}
                                                    >
                                                        <Play size={16} fill="currentColor" className={!q.questions || q.questions.length === 0 ? 'opacity-20' : ''} />
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

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="CREAR JUEGO"
            >
                <form onSubmit={handleCreateQuiz} className="space-y-24">
                    <div className="space-y-16">
                        <div className="space-y-6">
                            <label className="text-xs font-black text-primary uppercase tracking-[0.5em] block mb-2 opacity-70">
                                Nombre del Juego <span className="text-white">*</span>
                            </label>
                            <input
                                className="w-full bg-surface-lowest border-b-2 border-white/5 px-0 py-6 text-white text-3xl font-black italic focus:border-primary focus:outline-none transition-all placeholder:text-white/5"
                                placeholder="Escribe el nombre aquí..."
                                value={newQuizTitle}
                                onChange={(e) => setNewQuizTitle(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>

                        <div className="space-y-6">
                            <label className="text-xs font-black text-secondary uppercase tracking-[0.5em] block mb-2 opacity-70">Descripción</label>
                            <textarea
                                className="w-full bg-surface-lowest border-b-2 border-white/5 px-0 py-6 text-on-surface-variant text-lg focus:border-secondary focus:outline-none transition-all placeholder:text-white/5 min-h-[140px] resize-none font-medium leading-relaxed"
                                placeholder="De qué trata este juego..."
                                value={newQuizDesc}
                                onChange={(e) => setNewQuizDesc(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-8 pt-8 border-t border-white/5 text-center">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 text-xs font-black uppercase tracking-[0.4em] text-on-surface-variant hover:text-white transition-all py-6 border border-white/5 rounded-sm hover:bg-white/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] btn-vibrant py-6 rounded-sm text-md font-black uppercase tracking-[0.4em] active:scale-95 transition-all shadow-2xl"
                        >
                            Empezar
                        </button>
                    </div>
                </form>
            </Modal>
        </div >
    )
}
