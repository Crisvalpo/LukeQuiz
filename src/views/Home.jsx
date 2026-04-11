import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlusCircle, Play, Settings, Terminal, Layout, Trash2, BookOpen } from 'lucide-react'
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

    const deleteQuiz = async (id, title) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la trivia "${title}"? Esta acción borrará todas las preguntas, partidas y resultados asociados.`)) return

        const promise = new Promise(async (resolve, reject) => {
            try {
                // 1. Obtener IDs relacionados y enlaces de audio para limpieza
                const { data: qs } = await supabase.from('questions').select('id, audio_url').eq('quiz_id', id)
                const qIds = qs?.map(q => q.id) || []

                const audioFilesToDelete = qs
                    ?.map(q => q.audio_url)
                    .filter(url => url && url.includes('/quiz-audio/'))
                    .map(url => url.split('/quiz-audio/').pop()) || []

                const { data: gms } = await supabase.from('games').select('id').eq('quiz_id', id)
                const gIds = gms?.map(g => g.id) || []

                // 2. Borrar archivos físicos del Storage
                if (audioFilesToDelete.length > 0) {
                    await supabase.storage.from('quiz-audio').remove(audioFilesToDelete)
                }

                // 3. Borrar respuestas (dependen de preguntas)
                if (qIds.length > 0) {
                    const { error: err1 } = await supabase.from('answers').delete().in('question_id', qIds)
                    if (err1) throw err1
                }

                // 4. Borrar jugadores (dependen de juegos)
                if (gIds.length > 0) {
                    const { error: err2 } = await supabase.from('players').delete().in('game_id', gIds)
                    if (err2) throw err2
                }

                // 5. Borrar juegos y preguntas
                const { error: err3 } = await supabase.from('games').delete().eq('quiz_id', id)
                if (err3) throw err3

                const { error: err4 } = await supabase.from('questions').delete().eq('quiz_id', id)
                if (err4) throw err4

                // 6. Finalmente borrar la trivia
                const { error: err5 } = await supabase.from('quizzes').delete().eq('id', id)
                if (err5) throw err5
                resolve()
            } catch (err) {
                reject(err)
            }
        })

        toast.promise(promise, {
            loading: 'Eliminando rastro de datos...',
            success: () => {
                // Actualización optimista: quitar de la lista local de inmediato
                setQuizzes(prev => prev.filter(q => q.id !== id))
                return 'Trivia y datos asociados eliminados'
            },
            error: (err) => `Error: ${err.message}`
        })
    }

    return (
        <div className="min-h-screen bg-surface selection:bg-primary/30 font-body">
            {/* Background Glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-primary rounded-full blur-[120px]" />
            </div>

            {/* Background Decoration Inspired by Image */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[5%] w-12 h-12 border-4 border-primary/20 rotate-45 animate-float" />
                <div className="absolute top-[40%] right-[10%] w-8 h-8 border-4 border-secondary/20 rounded-full animate-float [animation-delay:2s]" />
                <div className="absolute bottom-[20%] left-[15%] w-10 h-10 border-4 border-accent/20 rotate-12 animate-float [animation-delay:4s]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1)_0%,transparent_50%)]" />
            </div>

            <div className="w-full flex justify-center py-32 px-6 md:px-12 lg:px-16 relative z-10">
                <div className="w-full max-w-6xl">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 mb-24">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-1 w-12 bg-gradient-to-r from-primary to-secondary rounded-full" />
                                <span className="text-[10px] font-black tracking-[0.5em] text-primary/40">Base de Conocimiento</span>
                            </div>
                            <div>
                                <h1 className="text-5xl font-black tracking-tighter text-white italic leading-none">
                                    Luke<span className="bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent not-italic">Quiz</span>
                                </h1>
                                <p className="text-on-surface-variant text-sm font-medium opacity-30 mt-4 tracking-wide">Centro de gestión de trivias galácticas</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="btn-vibrant px-10 py-4 rounded flex items-center gap-4 active:scale-95 group shadow-2xl shadow-primary/20 shrink-0"
                        >
                            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform" />
                            <span className="font-black text-xs tracking-[0.2em]">Diseñar Nueva</span>
                        </button>
                    </header>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-56 bg-surface rounded animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {quizzes.map(q => (
                                <div key={q.id} className="nebula-card p-10 flex flex-col justify-between min-h-[220px] group transition-all duration-500 hover:-translate-y-2">
                                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none" />

                                    <div className="flex items-start justify-between gap-8 relative z-20">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-4 opacity-40">
                                                <Terminal size={10} className="text-primary" />
                                                <span className="text-[9px] font-black tracking-[0.3em]">ID MÓDULO: {q.id.split('-')[0]}</span>
                                            </div>
                                            <h3 className="text-3xl font-black mb-3 tracking-tight text-white group-hover:text-primary transition-colors leading-tight truncate">
                                                {q.title}
                                            </h3>
                                            <p className="text-on-surface-variant text-xs line-clamp-2 opacity-50 leading-relaxed font-medium">
                                                {q.description || 'Sin descripción adicional. Sistema operando bajo parámetros estándar.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <button
                                                onClick={() => navigate(`/edit/${q.id}`)}
                                                title="Configurar Parámetros"
                                                className="w-12 h-12 bg-white/5 rounded-sm text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center border border-white/5 active:scale-95 group/btn"
                                            >
                                                <Settings size={20} className="group-hover/btn:rotate-90 transition-transform duration-500" />
                                            </button>
                                            <button
                                                onClick={() => deleteQuiz(q.id, q.title)}
                                                title="Eliminar Registro"
                                                className="w-12 h-12 bg-red-500/5 rounded-sm text-red-500/30 hover:text-red-500 hover:bg-red-500/10 transition-all border border-red-500/5 flex items-center justify-center active:scale-95"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-10 pt-8 border-t border-white/5">
                                        <button
                                            onClick={() => startNewGame(q.id)}
                                            className="w-full btn-vibrant py-4 rounded-sm flex items-center justify-center gap-4 active:scale-95 text-[10px] font-black tracking-[0.4em] shadow-lg"
                                        >
                                            <Play size={16} fill="currentColor" /> Iniciar Experiencia
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {quizzes.length === 0 && (
                                <div className="col-span-full py-32 flex flex-col items-center justify-center glass rounded border-dashed border-2 border-white/5 opacity-40">
                                    <PlusCircle size={48} className="mb-4 text-primary animate-pulse" />
                                    <p className="text-lg font-black uppercase tracking-[0.4em] text-white">Base de datos vacía</p>
                                    <p className="mt-3 text-on-surface-variant font-medium text-xs">Inicia la creación de tu primer universo de trivia.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="DISEÑAR NUEVA TRIVIA"
            >
                <form onSubmit={handleCreateQuiz} className="space-y-24">
                    <div className="space-y-16">
                        <div className="space-y-6">
                            <label className="text-xs font-black text-primary uppercase tracking-[0.5em] block mb-2 opacity-70">
                                Nombre del Desafío <span className="text-white">*</span>
                            </label>
                            <input
                                className="w-full bg-surface-lowest border-b-2 border-white/5 px-0 py-6 text-white text-3xl font-black italic focus:border-primary focus:outline-none transition-all placeholder:text-white/5"
                                placeholder="Nombre de tu trivia..."
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
                                placeholder="Escribe algo inspirador sobre este nuevo universo..."
                                value={newQuizDesc}
                                onChange={(e) => setNewQuizDesc(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-8 pt-8 border-t border-white/5">
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
                            Crear Universo
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
