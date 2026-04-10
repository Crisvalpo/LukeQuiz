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
        <div className="min-h-screen bg-surface p-6 font-body text-on-surface">
            <div className="max-w-xl mx-auto space-y-8 pt-12">
                <header className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Activity size={14} className="animate-pulse" />
                            <span className="text-[10px] font-display font-black tracking-[0.4em] uppercase">Panel de Control</span>
                        </div>
                        <h2 className="text-4xl font-display font-black leading-none uppercase italic tracking-tighter">
                            {game?.quizzes?.title || 'Juego Activo'}
                        </h2>
                    </div>
                    <div className="bg-surface-high px-8 py-4 rounded-3xl text-primary font-display font-black text-2xl border border-primary/20 neon-glow-primary tracking-widest">
                        {game?.join_code}
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-4">
                    <div className="glass p-8 rounded-[2.5rem] flex flex-col items-center gap-2 border-white/5">
                        <Users className="text-secondary opacity-50 mb-2" size={32} />
                        <p className="text-[10px] font-display font-black text-on-surface-variant tracking-widest uppercase text-center">Jugadores</p>
                        <p className="text-5xl font-display font-black">{players.length}</p>
                    </div>
                    <div
                        onClick={() => setIsAutoPilot(!isAutoPilot)}
                        className={`glass p-8 rounded-[2.5rem] flex flex-col items-center gap-2 border-2 cursor-pointer transition-all ${isAutoPilot ? 'border-primary neon-glow-primary bg-primary/10' : 'border-white/5'}`}
                    >
                        <Activity className={`${isAutoPilot ? 'text-primary' : 'text-on-surface-variant opacity-50'} mb-2`} size={32} />
                        <p className="text-[10px] font-display font-black tracking-widest uppercase text-center">{isAutoPilot ? 'Piloto: ON' : 'Piloto: OFF'}</p>
                        <p className="text-[8px] font-display font-bold uppercase opacity-60">Auto-Avance</p>
                    </div>
                </div>

                <div className="glass p-10 rounded-[3rem] border-white/5 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col gap-6">
                        {game?.status === 'waiting' && (
                            <div className="space-y-8 animate-fade">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.4em] text-center uppercase">Seleccionar Ritmo de Juego</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { val: 5, label: 'RÁPIDO', desc: '5s' },
                                            { val: 10, label: 'NORMAL', desc: '10s' },
                                            { val: 20, label: 'LENTO', desc: '20s' }
                                        ].map(t => (
                                            <button
                                                key={t.val}
                                                onClick={() => setSelectedTempo(t.val)}
                                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${selectedTempo === t.val ? 'border-primary bg-primary/10 text-primary' : 'border-white/5 opacity-50'}`}
                                            >
                                                <span className="text-[10px] font-display font-black tracking-widest leading-none">{t.label}</span>
                                                <span className="text-[8px] font-display font-bold opacity-60">{t.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-primary py-8 rounded-[2rem] text-3xl font-display font-black text-surface tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 neon-glow-primary flex items-center justify-center gap-4"
                                >
                                    <Play size={32} fill="currentColor" /> INICIAR JUEGO
                                </button>
                            </div>
                        )}

                        {game?.status === 'question' && (
                            <button
                                onClick={handleNext}
                                className="w-full bg-secondary py-8 rounded-[2rem] text-3xl font-display font-black text-surface tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 neon-glow-secondary flex items-center justify-center gap-4 animate-pulse-slow"
                            >
                                <BarChart2 size={32} /> MOSTRAR RESULTADOS
                            </button>
                        )}

                        {game?.status === 'results' && (
                            <button
                                onClick={handleNext}
                                className="w-full bg-surface-highest border-2 border-primary/40 py-8 rounded-[2rem] text-2xl font-display font-black text-primary tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
                            >
                                <SkipForward size={32} fill="currentColor" />
                                {game.current_question_index < questions.length - 1 ? 'SIGUIENTE' : 'FINALIZAR JUEGO'}
                            </button>
                        )}

                        {game?.status === 'finished' && (
                            <div className="text-center py-12 flex flex-col items-center">
                                <Trophy size={80} className="text-primary mb-6 drop-shadow-[0_0_20px_rgba(143,245,255,0.4)] animate-bounce" />
                                <p className="text-on-surface-variant font-display font-bold uppercase tracking-[0.3em] mb-8">Juego Terminado</p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-surface-highest px-12 py-4 rounded-2xl text-on-surface font-display font-black hover:text-primary transition-colors border border-white/5"
                                >
                                    Volver al Inicio
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-8 glass rounded-[2rem] border-dashed border-2 border-white/10 opacity-40">
                    <p className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.3em] text-center mb-2 uppercase">Instrucciones</p>
                    <p className="text-xs text-center leading-relaxed">
                        Asegúrese de que el **Proyector o Pantalla** esté activo.
                        El juego se sincroniza automáticamente en tiempo real.
                    </p>
                </div>
            </div>
        </div>
    )
}
