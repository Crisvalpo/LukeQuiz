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
        if (game.status === 'question') {
            const checkTime = () => {
                const start = new Date(game.question_started_at).getTime()
                const now = Date.now()
                const elapsed = (now - start) / 1000
                const tempo = game.settings?.tempo || 10
                if ((answerCount > 0 && answerCount === players.length) || elapsed >= tempo) {
                    handleNext()
                    return true
                }
                return false
            }
            if (!checkTime()) timer = setInterval(checkTime, 1000)
        } else if (isAutoPilot && game.status === 'results') {
            timer = setTimeout(() => handleNext(), 8000)
        }
        return () => {
            if (timer) {
                clearInterval(timer)
                clearTimeout(timer)
            }
        }
    }, [isAutoPilot, game?.status, answerCount, players.length, game?.question_started_at])

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
        <div className="h-screen w-screen bg-[#080c14] flex flex-col font-body text-white relative overflow-hidden">
            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none opacity-10">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-pink-500/10 to-transparent" />
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-cyan-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Sticky Header */}
            <header className="relative z-20 bg-black/40 backdrop-blur-xl border-b border-white/5 p-5 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-500 border border-pink-500/20">
                        <Activity size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <p className="text-[8px] font-black tracking-[0.3em] text-pink-500 uppercase">Live Controller</p>
                        <h1 className="text-sm font-display font-black tracking-tight truncate max-w-[120px]">
                            {game?.quizzes?.title || 'Partida'}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10 text-center">
                        <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-0.5">PIN TV</p>
                        <p className="text-xl font-display font-black text-pink-500 leading-none">{game?.join_code}</p>
                    </div>
                </div>
            </header>

            {/* Quick Stats Bar */}
            <div className="relative z-10 flex border-b border-white/5 divide-x divide-white/5 text-center bg-black/20">
                <div className="flex-1 p-3">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">AUDIENCIA</p>
                    <div className="flex items-center justify-center gap-2">
                        <Users size={12} className="text-cyan-500" />
                        <span className="text-xl font-display font-black leading-none">{players.length}</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsAutoPilot(!isAutoPilot)}
                    className={`flex-1 p-3 transition-colors ${isAutoPilot ? 'bg-pink-500/5' : 'bg-transparent'}`}
                >
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">AUTO-PILOT</p>
                    <span className={`text-xl font-display font-black leading-none ${isAutoPilot ? 'text-pink-500' : 'text-white/20'}`}>
                        {isAutoPilot ? 'ON' : 'OFF'}
                    </span>
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 p-6 flex flex-col justify-center overflow-y-auto">
                {game?.status === 'waiting' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-display font-black uppercase italic tracking-tighter">Preparando...</h2>
                            <p className="text-xs text-white/40 uppercase tracking-[0.2em]">Configura el ritmo de la partida</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { val: 5, label: 'Turbo', icon: Zap },
                                { val: 10, label: 'Normal', icon: Activity },
                                { val: 20, label: 'Relax', icon: Headphones }
                            ].map(t => (
                                <button
                                    key={t.val}
                                    onClick={() => setSelectedTempo(t.val)}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${selectedTempo === t.val ? 'border-pink-500 bg-pink-500/10 text-pink-500' : 'border-white/5 text-white/20'}`}
                                >
                                    <t.icon size={20} />
                                    <span className="text-[8px] font-black tracking-widest uppercase">{t.label}</span>
                                    <span className="text-lg font-display font-black">{t.val}s</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {game?.status === 'question' && (
                    <div className="text-center space-y-8 animate-in zoom-in duration-300">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-pink-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                            <BarChart2 size={120} className="text-pink-500 relative z-10 mx-auto" />
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-2">RESPUESTAS</p>
                                <div className="text-7xl font-display font-black text-white tabular-nums">
                                    {answerCount}<span className="text-white/10">/</span><span className="text-white/20">{players.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {game?.status === 'results' && (
                    <div className="text-center space-y-8 animate-in fade-in duration-500">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full scale-150" />
                            <Trophy size={100} className="text-cyan-500 relative z-10 mx-auto" />
                        </div>
                        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                            <h3 className="text-2xl font-display font-black uppercase italic mb-2 text-cyan-500">Resultados Listos</h3>
                            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Presiona para cargar la siguiente</p>
                        </div>
                    </div>
                )}

                {game?.status === 'finished' && (
                    <div className="text-center space-y-12 py-10">
                        <div className="space-y-4">
                            <Trophy size={80} className="text-pink-500 mx-auto animate-bounce" />
                            <h2 className="text-4xl font-display font-black uppercase italic tracking-tighter">🏆 ¡FIN!</h2>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-white/5 hover:bg-white/10 py-6 rounded-2xl text-on-surface font-display font-black text-[10px] uppercase tracking-[0.4em] transition-all border border-white/10"
                        >
                            Volver al Menú
                        </button>
                    </div>
                )}
            </main>

            {/* Bottom Action Area (Thumb Friendly) */}
            <div className="relative z-30 p-6 pt-0 bg-gradient-to-t from-black to-transparent">
                {game?.status !== 'finished' && (
                    <button
                        onClick={handleNext}
                        className={`w-full h-24 rounded-3xl font-display font-black text-xl tracking-[0.2em] shadow-2xl transition-all active:scale-[0.95] flex items-center justify-center gap-4 italic group active:brightness-90
                            ${game?.status === 'waiting' ? (players.length < 2 ? 'bg-white/10 text-white/20 border border-white/10' : 'bg-pink-500 text-black neon-glow-primary') :
                                game?.status === 'question' ? 'bg-amber-500 text-black shadow-amber-500/20' :
                                    'bg-cyan-500 text-black shadow-cyan-500/20'}`}
                    >
                        {game?.status === 'waiting' && (
                            <>
                                <Play size={24} fill="currentColor" />
                                <span>INICIAR</span>
                            </>
                        )}
                        {game?.status === 'question' && (
                            <>
                                <SkipForward size={24} fill="currentColor" />
                                <span>FINALIZAR</span>
                            </>
                        )}
                        {game?.status === 'results' && (
                            <>
                                <Play size={24} fill="currentColor" />
                                <span>SIGUIENTE</span>
                            </>
                        )}
                    </button>
                )}

                {/* Navigation Hint */}
                <div className="flex justify-center mt-6">
                    <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                </div>
            </div>
        </div>
    )
}
