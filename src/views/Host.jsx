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
    const [isAutoPilot, setIsAutoPilot] = useState(true)
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
        if (!game || !questions.length) return

        let timer

        if (game.status === 'question') {
            const checkTime = () => {
                const start = new Date(game.question_started_at).getTime()
                const now = Date.now()
                const elapsed = (now - start) / 1000
                const tempo = game.settings?.tempo || 10

                // Obligatorio: Si todos respondieron O se acabó el tiempo
                if ((answerCount > 0 && answerCount === players.length) || elapsed >= tempo) {
                    handleNext()
                    return true
                }
                return false
            }

            if (!checkTime()) {
                timer = setInterval(checkTime, 1000)
            }
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
        <div className="min-h-screen bg-surface flex flex-col items-center py-20 px-12 relative overflow-hidden font-body text-on-surface">
            {/* Ambient Technical Background */}
            <div className="fixed inset-0 v-grid opacity-20 pointer-events-none" />

            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-primary rounded-full blur-[120px]" />
                <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-secondary rounded-full blur-[120px]" />
            </div>

            {/* System Status Bar */}
            <div className="fixed top-0 left-0 w-full h-1 bg-white/5 z-[100]">
                <div className="h-full bg-primary animate-pulse w-1/3" />
            </div>

            <div className="w-full max-w-6xl space-y-16 relative z-10 pb-20">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12 mb-8 px-4 border-b border-white/5 pb-12">
                    <div className="text-left space-y-2">
                        <div className="flex items-center gap-3 text-primary terminal-text">
                            <Activity size={14} className="animate-pulse" />
                            <span className="text-[10px] font-black opacity-60">Sistema de Control // Transmisión Activa</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-display font-black leading-tight italic tracking-tighter text-white drop-shadow-2xl">
                            {game?.quizzes?.title || 'Sistema_Listo'}
                        </h2>
                        <div className="flex gap-4 text-[9px] font-mono text-on-surface-variant opacity-30">
                            <span>ID_SESION: {gameId.slice(0, 8)}</span>
                            <span>|</span>
                            <span>ENCRIPTACION: AES-256</span>
                            <span>|</span>
                            <span>ESTADO: CALIBRADO</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-2 bg-surface-lowest/40 p-6 rounded-sm border border-white/5 backdrop-blur-sm">
                        <p className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.5em] opacity-40">Clave de Acceso</p>
                        <div className="text-primary font-display font-black text-5xl tracking-[0.2em] neon-glow-primary">
                            {game?.join_code}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 px-4">
                    <div className="btn-command p-12 rounded-sm flex flex-col items-center justify-center gap-6 group">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                            <p className="text-[10px] font-display font-black text-secondary tracking-[0.4em] opacity-70">Audiencia Activa</p>
                        </div>
                        <p className="text-9xl font-display font-black text-white leading-none tracking-tighter border-b-2 border-white/5 pb-4">
                            {players.length}
                        </p>
                        <div className="flex gap-4 opacity-20 text-[9px] font-mono">
                            <span>UP_TIME: 00:14:22</span>
                            <span>LATENCY: 12ms</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsAutoPilot(!isAutoPilot)}
                        className={`btn-command p-12 rounded-sm flex flex-col items-center justify-center gap-6 transition-all duration-500 group relative border-2 ${isAutoPilot ? 'border-primary bg-primary/5 shadow-[0_0_30px_rgba(236,72,153,0.15)] scale-105' : 'border-white/5 opacity-50 grayscale'}`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${isAutoPilot ? 'bg-primary animate-ping' : 'bg-white/20'}`} />
                            <p className={`text-[10px] font-display font-black tracking-[0.4em] ${isAutoPilot ? 'text-primary' : 'text-on-surface-variant'}`}>
                                {isAutoPilot ? 'AUTOPILOTO_ACTIVO' : 'MODO_MANUAL'}
                            </p>
                        </div>
                        <p className={`text-6xl font-display font-black tracking-tighter ${isAutoPilot ? 'text-white' : 'text-on-surface-variant opacity-20'}`}>
                            {isAutoPilot ? 'ON' : 'OFF'}
                        </p>
                        <span className={`text-[9px] font-mono opacity-40 tracking-[0.3em] ${isAutoPilot ? 'text-primary' : ''}`}>
                            {isAutoPilot ? 'CONTROL_IA_EN_VIVO' : 'ESPERANDO_COMANDO'}
                        </span>
                    </button>
                </div>

                <div className="bg-surface-lowest/50 p-12 md:p-16 rounded-sm border border-white/5 relative overflow-hidden shadow-2xl backdrop-blur-xl">
                    <div className="scan-line absolute top-0 left-0 animate-scan" />

                    <div className="relative z-10">
                        {game?.status === 'waiting' && (
                            <div className="space-y-16 animate-fade">
                                <div className="space-y-8">
                                    <div className="flex items-center justify-start gap-4 mb-2 opacity-40">
                                        <p className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.8em]">Calibración // Tempo</p>
                                        <div className="h-[1px] flex-1 bg-white/10" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-6">
                                        {[
                                            { val: 5, label: 'Turbo', desc: '05s' },
                                            { val: 10, label: 'Normal', desc: '10s' },
                                            { val: 20, label: 'Relax', desc: '20s' }
                                        ].map(t => (
                                            <button
                                                key={t.val}
                                                onClick={() => setSelectedTempo(t.val)}
                                                className={`p-10 rounded-sm border flex flex-col items-center gap-2 transition-all transform active:scale-95 ${selectedTempo === t.val ? 'border-primary bg-primary/10 text-primary neon-glow-primary' : 'border-white/5 opacity-40 hover:opacity-100 hover:bg-white/5'}`}
                                            >
                                                <span className="text-[10px] font-display font-black tracking-[0.4em]">{t.label}</span>
                                                <span className="text-3xl font-display font-black">{t.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-primary py-10 rounded-sm text-3xl font-display font-black text-surface tracking-[0.3em] shadow-2xl transition-all hover:brightness-110 active:scale-[0.98] neon-glow-primary flex items-center justify-center gap-8 group italic"
                                >
                                    <Play size={40} fill="currentColor" />
                                    <span>Iniciar Operación</span>
                                </button>
                            </div>
                        )}

                        {game?.status === 'question' && (
                            <div className="space-y-12 animate-fade text-center">
                                <div className="text-primary/40 animate-pulse mb-8 flex justify-center">
                                    <BarChart2 size={100} />
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-secondary py-12 rounded-sm text-3xl font-display font-black text-surface tracking-[0.3em] shadow-2xl transition-all hover:brightness-110 active:scale-[0.98] neon-glow-secondary flex items-center justify-center gap-6"
                                >
                                    <span>Finalizar Pregunta</span>
                                </button>
                                <p className="text-[10px] font-display font-bold text-on-surface-variant uppercase tracking-[0.5em] opacity-40 pt-4">Sincronización de red activa // Latencia optimizada</p>
                            </div>
                        )}

                        {game?.status === 'results' && (
                            <div className="space-y-12 animate-fade text-center">
                                <div className="text-primary/40 mb-8 flex justify-center">
                                    <Trophy size={100} />
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-surface-highest border border-primary/40 py-12 rounded-sm text-3xl font-display font-black text-primary tracking-[0.3em] shadow-2xl transition-all hover:bg-primary/5 active:scale-[0.98] flex items-center justify-center gap-8"
                                >
                                    <SkipForward size={48} fill="currentColor" />
                                    <span>{game.current_question_index < questions.length - 1 ? 'Cargar Siguiente Pregunta' : 'Ver Podio Final'}</span>
                                </button>
                            </div>
                        )}

                        {game?.status === 'finished' && (
                            <div className="text-center py-16 flex flex-col items-center animate-fade">
                                <div className="relative mb-12">
                                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                    <Trophy size={120} className="text-primary relative z-10 animate-bounce" />
                                </div>
                                <h3 className="text-5xl font-display font-black tracking-[0.4em] mb-4 italic">Misión Completada</h3>
                                <p className="text-on-surface-variant font-mono text-[10px] mb-12 opacity-40 tracking-[0.2em]">La sesión de control ha concluido satisfactoriamente // Datos guardados</p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-white/5 hover:bg-white/10 px-16 py-6 rounded-sm text-on-surface font-display font-black text-xs uppercase tracking-[0.4em] transition-all border border-white/10"
                                >
                                    Desconectar Sistema
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
