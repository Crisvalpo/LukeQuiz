import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Play, SkipForward, BarChart2, CheckCircle, Users, Trophy, Loader2, Activity } from 'lucide-react'
import { calculateScore } from '../utils/helpers'
import { toast } from 'sonner'
import { useGameRoom } from '../hooks/useGameRoom'

export default function Host() {
    const { gameId } = useParams()
    const { game, setGame, players, loading } = useGameRoom(gameId)
    const [questions, setQuestions] = useState([])
    const [answerCount, setAnswerCount] = useState(0)
    const [isAutoPilot, setIsAutoPilot] = useState(false)
    const [selectedTempo, setSelectedTempo] = useState(10) // 5, 10, 20
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

    // Auto-Pilot Logic
    useEffect(() => {
        if (!isAutoPilot || !game || !questions.length) return

        let timer

        if (game.status === 'question') {
            const checkTime = () => {
                const start = new Date(game.question_started_at).getTime()
                const now = Date.now()
                const elapsed = (now - start) / 1000
                const tempo = game.settings?.tempo || 10

                // Si todos respondieron O se acabó el tiempo
                if ((answerCount > 0 && answerCount === players.length) || elapsed >= tempo) {
                    handleNext()
                    return true
                }
                return false
            }

            if (!checkTime()) {
                timer = setInterval(checkTime, 1000)
            }
        } else if (game.status === 'results') {
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

        const { count } = await supabase
            .from('answers')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', currentQ.id)

        setAnswerCount(count || 0)
    }

    const updateStatus = async (status, indexOffset = 0) => {
        const promise = new Promise(async (resolve, reject) => {
            if (status === 'results') {
                await processScores()
            }

            const updates = {
                status,
                current_question_index: (game.current_question_index + indexOffset),
                question_started_at: status === 'question' ? new Date().toISOString() : game.question_started_at
            }

            const { data, error } = await supabase
                .from('games')
                .update(updates)
                .eq('id', gameId)
                .select()
                .single()

            if (error) reject(error)
            else {
                setGame(data)
                resolve(data)
            }
        })

        toast.promise(promise, {
            loading: 'Actualizando estado...',
            success: 'Actualizado',
            error: 'Fallo al actualizar el juego'
        })
    }

    const processScores = async () => {
        const currentQ = questions[game.current_question_index]
        if (!currentQ) return

        const { error: rpcError } = await supabase.rpc('process_scores', {
            p_game_id: gameId,
            p_question_id: currentQ.id
        })

        if (!rpcError) return

        const { data: qAnswers } = await supabase
            .from('answers')
            .select('*, players(*)')
            .eq('question_id', currentQ.id)

        if (!qAnswers) return

        for (const ans of qAnswers) {
            const isCorrect = ans.selected_option === currentQ.correct_option
            if (isCorrect) {
                const startTime = new Date(game.question_started_at).getTime()
                const answerTime = new Date(ans.created_at).getTime()
                const elapsed = (answerTime - startTime) / 1000
                const currentTempo = game.settings?.tempo || 10
                const timeLeft = Math.max(0, currentTempo - elapsed)

                const points = calculateScore(timeLeft, currentTempo, true)
                const currentScore = ans.players?.score || 0

                await supabase
                    .from('players')
                    .update({ score: currentScore + points })
                    .eq('id', ans.player_id)
            }
        }
    }

    const handleNext = async () => {
        if (game.status === 'waiting') {
            // Guardar tempo en settings si la columna existe (o simplemente usarlo)
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
        <div className="min-h-screen bg-surface flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
    )

    return (
        <div className="min-h-screen bg-surface p-8 md:p-16 font-body text-on-surface selection:bg-primary/30 flex items-center justify-center">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[120px] animate-pulse-slow" />
            </div>

            <div className="w-full max-w-5xl space-y-12 relative z-10">
                <header className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 text-primary mb-3">
                            <Activity size={18} className="animate-pulse" />
                            <span className="text-xs font-display font-black tracking-[0.5em] uppercase opacity-60">Centro de Operaciones</span>
                        </div>
                        <h2 className="text-5xl md:text-6xl font-display font-black leading-none uppercase italic tracking-tighter">
                            {game?.quizzes?.title || 'Partida Activa'}
                        </h2>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.4em] uppercase">Código de Acceso</p>
                        <div className="bg-surface-highest px-12 py-6 rounded-[2rem] text-primary font-display font-black text-5xl border border-primary/30 neon-glow-primary tracking-[0.2em] shadow-2xl">
                            {game?.join_code}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="glass p-12 rounded-[3.5rem] flex flex-col items-center justify-center gap-4 border-white/5 transition-all hover:bg-white/5 group">
                        <div className="p-6 rounded-full bg-secondary/10 text-secondary mb-2 group-hover:scale-110 transition-transform">
                            <Users size={40} />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-display font-black text-on-surface-variant tracking-[0.3em] uppercase mb-1">Jugadores</p>
                            <p className="text-7xl font-display font-black text-white">{players.length}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsAutoPilot(!isAutoPilot)}
                        className={`glass p-12 rounded-[3.5rem] flex flex-col items-center justify-center gap-4 border-2 transition-all group ${isAutoPilot ? 'border-primary neon-glow-primary bg-primary/5' : 'border-white/5 hover:bg-white/5'}`}
                    >
                        <div className={`p-6 rounded-full mb-2 group-hover:scale-110 transition-transform ${isAutoPilot ? 'bg-primary/20 text-primary animate-pulse' : 'bg-white/5 text-on-surface-variant opacity-40'}`}>
                            <Activity size={40} />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-display font-black tracking-[0.3em] uppercase mb-1">Piloto Automático</p>
                            <p className={`text-4xl font-display font-black uppercase ${isAutoPilot ? 'text-primary' : 'text-on-surface-variant opacity-30'}`}>
                                {isAutoPilot ? 'ACTIVO' : 'INACTIVO'}
                            </p>
                        </div>
                    </button>
                </div>

                <div className="glass p-12 md:p-16 rounded-[4rem] border-white/5 relative overflow-hidden shadow-2xl">
                    <div className="relative z-10">
                        {game?.status === 'waiting' && (
                            <div className="space-y-12 animate-fade">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-center gap-4 mb-2">
                                        <div className="h-[1px] w-12 bg-white/10" />
                                        <p className="text-xs font-display font-black text-on-surface-variant tracking-[0.4em] uppercase">Velocidad del Juego</p>
                                        <div className="h-[1px] w-12 bg-white/10" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-6">
                                        {[
                                            { val: 5, label: 'Turbo', desc: '5s' },
                                            { val: 10, label: 'Normal', desc: '10s' },
                                            { val: 20, label: 'Relax', desc: '20s' }
                                        ].map(t => (
                                            <button
                                                key={t.val}
                                                onClick={() => setSelectedTempo(t.val)}
                                                className={`p-8 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all transform active:scale-95 ${selectedTempo === t.val ? 'border-primary bg-primary/10 text-primary neon-glow-primary' : 'border-white/5 opacity-40 hover:opacity-100 hover:bg-white/5'}`}
                                            >
                                                <span className="text-sm font-display font-black tracking-widest uppercase">{t.label}</span>
                                                <span className="text-xl font-display font-black opacity-60">{t.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-primary py-10 rounded-[2.5rem] text-4xl font-display font-black text-surface tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 neon-glow-primary flex items-center justify-center gap-6 group"
                                >
                                    <Play size={48} fill="currentColor" className="group-hover:translate-x-1 transition-transform" />
                                    <span>INICIAR</span>
                                </button>
                            </div>
                        )}

                        {game?.status === 'question' && (
                            <div className="space-y-8 animate-fade text-center">
                                <div className="text-primary/40 animate-pulse mb-8 flex justify-center">
                                    <BarChart2 size={80} />
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-secondary py-10 rounded-[2.5rem] text-3xl font-display font-black text-surface tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 neon-glow-secondary flex items-center justify-center gap-6"
                                >
                                    FINALIZAR PREGUNTA
                                </button>
                                <p className="text-xs font-display font-bold text-on-surface-variant uppercase tracking-[0.4em] opacity-40 pt-4">Sincronizado con todos los jugadores</p>
                            </div>
                        )}

                        {game?.status === 'results' && (
                            <div className="space-y-8 animate-fade text-center">
                                <div className="text-primary/40 mb-8 flex justify-center">
                                    <Trophy size={80} />
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-surface-highest border-2 border-primary/40 py-10 rounded-[2.5rem] text-3xl font-display font-black text-primary tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-6"
                                >
                                    <SkipForward size={48} fill="currentColor" />
                                    {game.current_question_index < questions.length - 1 ? 'SIGUIENTE' : 'VER PODIO'}
                                </button>
                            </div>
                        )}

                        {game?.status === 'finished' && (
                            <div className="text-center py-12 flex flex-col items-center animate-fade">
                                <div className="relative mb-12">
                                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                    <Trophy size={100} className="text-primary relative z-10 animate-bounce" />
                                </div>
                                <h3 className="text-4xl font-display font-black uppercase tracking-[0.3em] mb-4">Misión Cumplida</h3>
                                <p className="text-on-surface-variant font-medium mb-12 opacity-60">La sesión de juego ha concluido satisfactoriamente.</p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-white/5 hover:bg-white/10 px-12 py-5 rounded-[2rem] text-on-surface font-display font-black text-sm uppercase tracking-widest transition-all border border-white/10"
                                >
                                    Finalizar y Salir
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="pt-8 flex flex-col items-center gap-4 opacity-30">
                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <p className="text-[10px] font-display font-black tracking-[0.5em] uppercase text-center">
                        LukeQuiz V2.0 Control System | Secure Session
                    </p>
                </footer>
            </div>
        </div>
    )
}
