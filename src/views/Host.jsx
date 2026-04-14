import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Play, SkipForward, BarChart2, CheckCircle, Users, Trophy, Loader2, Activity, Settings, Zap, Headphones, Home } from 'lucide-react'
import { calculateScore } from '../utils/helpers'
import { toast } from 'sonner'
import { useGameRoom } from '../hooks/useGameRoom'

export default function Host() {
    const { gameId } = useParams()
    const { game, setGame, players, loading } = useGameRoom(gameId)
    const [questions, setQuestions] = useState([])
    const [answerCount, setAnswerCount] = useState(0)
    const [isAutoPilot, setIsAutoPilot] = useState(true)
    const [selectedTempo, setSelectedTempo] = useState(10)
    const navigate = useNavigate()

    useEffect(() => {
        if (game) {
            fetchQuestions(game.quiz_id)
            fetchCounts()
        }

        const channel = supabase.channel(`host_counts_${gameId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, () => {
                fetchCounts()
            })
            .subscribe()

        return () => channel.unsubscribe()
    }, [gameId, game?.quiz_id])

    useEffect(() => {
        if (!game || !questions.length) return
        let timer

        // El Host SOLO avanza por respuestas completas para mayor agilidad.
        // El tiempo de la pregunta lo controla el Screen (Maestro) para evitar dobles saltos.
        if (game.status === 'question') {
            const checkAnswers = () => {
                if (answerCount > 0 && answerCount === players.length) {
                    handleNext()
                }
            }
            timer = setInterval(checkAnswers, 1000)
        } else if (isAutoPilot && game.status === 'results') {
            // El Host puede mantener el auto-pilot para los resultados
            timer = setTimeout(() => handleNext(), 8000)
        }

        return () => {
            if (timer) {
                clearInterval(timer)
                clearTimeout(timer)
            }
        }
    }, [isAutoPilot, game?.status, answerCount, players.length])

    const fetchQuestions = async (qId) => {
        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', qId).order('order_index', { ascending: true })
        if (qs) setQuestions(qs)
    }

    const fetchCounts = async () => {
        if (!game || !questions.length) return
        const currentQ = questions[game.current_question_index]
        if (!currentQ) return
        const { count } = await supabase.from('answers').select('*', { count: 'exact', head: true }).eq('question_id', currentQ.id)
        setAnswerCount(count || 0)
    }

    const updateStatus = async (status, indexOffset = 0) => {
        const promise = new Promise(async (resolve, reject) => {
            if (status === 'results') await processScores()
            const updates = {
                status,
                current_question_index: (game.current_question_index + indexOffset),
                question_started_at: status === 'question' ? new Date().toISOString() : game.question_started_at
            }
            const { data, error } = await supabase.from('games').update(updates).eq('id', gameId).select().single()
            if (error) reject(error)
            else {
                setGame(data)
                resolve(data)
            }
        })
        toast.dismiss() // Clean up previous toasts
        toast.promise(promise, {
            loading: 'Cargando...',
            success: 'Listo',
            error: 'Error de red',
            duration: 1500
        })
    }

    const processScores = async () => {
        const currentQ = questions[game.current_question_index]
        if (!currentQ) return
        await supabase.rpc('process_scores', { p_game_id: gameId, p_question_id: currentQ.id })
    }

    const handleNext = async () => {
        if (game.status === 'waiting') {
            if (players.length < 2) {
                toast.error('SE NECESITAN AL MENOS 2 JUGADORES')
                return
            }
            await supabase.from('games').update({ settings: { tempo: selectedTempo } }).eq('id', gameId)
            updateStatus('question', 0)
        } else if (game.status === 'question') {
            updateStatus('results', 0)
        } else if (game.status === 'results') {
            if (game.current_question_index < questions.length - 1) {
                updateStatus('question', 1)
            } else {
                updateStatus('finished', 0)
            }
        }
    }

    if (loading) return (
        <div className="h-screen bg-[#0f172a] flex items-center justify-center">
            <Loader2 className="animate-spin text-pink-500" size={48} />
        </div>
    )

    return (
        <div className="h-screen w-screen bg-surface flex flex-col font-body text-white relative overflow-hidden">
            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none opacity-10">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent" />
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-secondary/5 rounded-full blur-[120px]" />
            </div>

            {/* Sticky Header */}
            <header className="relative z-20 bg-black/40 backdrop-blur-xl border-b border-white/5 p-[2vh] px-[5vw] flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-[1.5vh]">
                    <div className="w-[5vh] h-[5vh] rounded-[1vh] bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                        <Activity size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <p className="text-[1vh] font-black tracking-[0.3em] text-primary uppercase leading-tight">Live Controller</p>
                        <h1 className="text-[1.8vh] font-display font-black tracking-tight truncate max-w-[40vw] leading-none">
                            {game?.quizzes?.title || 'Partida'}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-[1vh]">
                    <div className="bg-white/5 px-[2vh] py-[1vh] rounded-[1vh] border border-white/10 text-center">
                        <p className="text-[0.8vh] font-black text-white/40 uppercase tracking-widest mb-[0.2vh]">PIN TV</p>
                        <p className="text-[2.5vh] font-display font-black text-primary leading-none">{game?.join_code}</p>
                    </div>
                </div>
            </header>

            {/* Quick Stats Bar */}
            <div className="relative z-10 flex border-b border-white/5 divide-x divide-white/5 text-center bg-black/20">
                <div className="flex-1 p-[1.5vh]">
                    <p className="text-[1vh] font-black text-white/30 uppercase tracking-[0.2em] mb-[0.5vh]">AUDIENCIA</p>
                    <div className="flex items-center justify-center gap-[1vh]">
                        <Users size={14} className="text-secondary" />
                        <span className="text-[2.5vh] font-display font-black leading-none">{players.length}</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsAutoPilot(!isAutoPilot)}
                    className={`flex-1 p-[1.5vh] transition-colors ${isAutoPilot ? 'bg-primary/5' : 'bg-transparent'}`}
                >
                    <div className="flex items-center gap-[1.5vh] bg-black/40 px-[2.5vh] py-[1vh] rounded-[1.5vh] border border-white/10">
                        <span className={`text-[1.2vh] font-black tracking-widest uppercase ${isAutoPilot ? 'text-primary' : 'text-white/40'}`}>
                            {isAutoPilot ? 'MODO AUTOMÁTICO ACTIVO' : 'MODO MANUAL'}
                        </span>
                        <div className={`size-[1vh] rounded-full ${isAutoPilot ? 'bg-primary animate-pulse shadow-[0_0_1vh_rgba(236,72,153,0.5)]' : 'bg-white/20'}`} />
                    </div>
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 p-[3vh] flex flex-col justify-center overflow-y-auto">
                {game?.status === 'waiting' && (
                    <div className="space-y-[4vh] animate-in fade-in slide-in-from-bottom-4">
                        <div className="text-center space-y-[1vh]">
                            <h2 className="text-[4vh] font-display font-black uppercase italic tracking-tighter leading-none">Preparando...</h2>
                            <p className="text-[1.2vh] text-white/40 uppercase tracking-[0.2em]">Configura el ritmo de la partida</p>
                        </div>

                        <div className="grid grid-cols-3 gap-[2vh]">
                            {[
                                { val: 5, label: 'Turbo', icon: Zap },
                                { val: 10, label: 'Normal', icon: Activity },
                                { val: 20, label: 'Relax', icon: Headphones }
                            ].map(t => (
                                <button
                                    key={t.val}
                                    onClick={() => setSelectedTempo(t.val)}
                                    className={`p-[2vh] rounded-[2vh] border-[0.3vh] flex flex-col items-center gap-[1vh] transition-all ${selectedTempo === t.val ? 'border-primary bg-primary/10 text-primary' : 'border-white/5 text-white/20'}`}
                                >
                                    <t.icon size={24} />
                                    <span className="text-[1vh] font-black tracking-widest uppercase">{t.label}</span>
                                    <span className="text-[2.5vh] font-display font-black">{t.val}s</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {game?.status === 'question' && (
                    <div className="text-center space-y-[4vh] animate-in zoom-in duration-300">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full scale-150 animate-pulse" />
                            <BarChart2 size={120} className="text-primary relative z-10 mx-auto" />
                        </div>
                        <div className="space-y-[2vh]">
                            <div className="bg-white/5 border border-white/10 p-[4vh] rounded-[3vh] backdrop-blur-md">
                                <p className="text-[1.2vh] font-black text-white/40 uppercase tracking-[0.4em] mb-[1vh]">RESPUESTAS</p>
                                <div className="text-[8vh] font-display font-black text-white tabular-nums leading-none">
                                    {answerCount}<span className="text-white/10">/</span><span className="text-white/20">{players.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {game?.status === 'results' && (
                    <div className="text-center space-y-[4vh] animate-in fade-in duration-500">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-secondary/10 blur-[50px] rounded-full scale-150" />
                            <Trophy size={100} className="text-secondary relative z-10 mx-auto" />
                        </div>
                        <div className="bg-white/5 border border-white/10 p-[5vh] rounded-[3vh]">
                            <h3 className="text-[3.5vh] font-display font-black uppercase italic mb-[1vh] text-secondary leading-none">Resultados Listos</h3>
                            <p className="text-[1.2vh] text-white/40 uppercase tracking-[0.2em] font-bold">Presiona para cargar la siguiente</p>
                        </div>
                    </div>
                )}

                {game?.status === 'finished' && (
                    <div className="text-center space-y-[6vh] py-[5vh]">
                        <div className="space-y-[2vh]">
                            <Trophy size={80} className="text-primary mx-auto animate-bounce" />
                            <h2 className="text-[5vh] font-display font-black uppercase italic tracking-tighter leading-none">🏆 ¡FIN!</h2>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-white/5 hover:bg-white/10 py-[3vh] rounded-[2vh] text-on-surface font-display font-black text-[1.5vh] uppercase tracking-[0.4em] transition-all border border-white/5"
                        >
                            Volver al Menú
                        </button>
                    </div>
                )}
            </main>

            {/* Bottom Action Area (Thumb Friendly) */}
            <div className="relative z-30 p-[4vh] pt-0 bg-gradient-to-t from-black to-transparent">
                {game?.status !== 'finished' && (
                    <button
                        onClick={handleNext}
                        className={`w-full h-[12vh] rounded-[3vh] font-display font-black text-[3vh] tracking-[0.2em] shadow-2xl transition-all active:scale-[0.95] flex items-center justify-center gap-[2vh] italic group active:brightness-90
                            ${game?.status === 'waiting' ? (players.length < 2 ? 'bg-white/10 text-white/20 border border-white/10' : 'bg-primary text-black neon-glow-primary') :
                                game?.status === 'question' ? 'bg-accent text-black shadow-accent/20' :
                                    'bg-secondary text-black shadow-secondary/20'}`}
                    >
                        {game?.status === 'waiting' && (
                            <>
                                <Play size={32} fill="currentColor" />
                                <span>INICIAR</span>
                            </>
                        )}
                        {game?.status === 'question' && (
                            <>
                                <SkipForward size={32} fill="currentColor" />
                                <span>FINALIZAR</span>
                            </>
                        )}
                        {game?.status === 'results' && (
                            <>
                                <Play size={32} fill="currentColor" />
                                <span>SIGUIENTE</span>
                            </>
                        )}
                    </button>
                )}

                {/* Navigation Hint */}
                <div className="flex justify-center mt-[3vh]">
                    <div className="w-[10vw] h-[0.6vh] bg-white/10 rounded-full" />
                </div>
            </div>
        </div>
    )
}
