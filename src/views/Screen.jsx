import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Trophy, Loader2, PlayCircle, Activity } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useGameRoom } from '../hooks/useGameRoom'

export default function Screen() {
    const { gameId } = useParams()
    const { game, players, loading } = useGameRoom(gameId)
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const [answers, setAnswers] = useState([])
    const [timeLeft, setTimeLeft] = useState(0)
    const [isUpdating, setIsUpdating] = useState(false)
    const [questions, setQuestions] = useState([])
    const [isAutoPilot, setIsAutoPilot] = useState(false)

    useEffect(() => {
        if (!game) return
        if (game.status === 'question') {
            fetchQuestion(game.quiz_id, game.current_question_index)
        } else if (game.status === 'finished') {
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.7 }, colors: ['#8ff5ff', '#ac89ff', '#ff59e3'] })
        }
        if (game.quiz_id && !questions.length) {
            fetchQuestions(game.quiz_id)
        }
    }, [game?.status, game?.current_question_index, game?.quiz_id])

    const fetchQuestions = async (qId) => {
        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', qId).order('order_index', { ascending: true })
        if (qs) setQuestions(qs)
    }

    useEffect(() => {
        if (!currentQuestion?.id || game?.status !== 'question') return
        const answerSub = supabase
            .channel(`answers_${currentQuestion.id}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'answers', filter: `question_id=eq.${currentQuestion.id}` },
                payload => {
                    setAnswers(prev => {
                        if (prev.some(a => a.id === payload.new.id)) return prev
                        return [...prev, payload.new]
                    })
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(answerSub) }
    }, [currentQuestion?.id, game?.status])

    const fetchQuestion = async (quizId, index) => {
        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizId).eq('order_index', index).single()
        if (qs) {
            setCurrentQuestion(qs)
            setAnswers([])
            const { data: initialAnswers } = await supabase.from('answers').select('*').eq('question_id', qs.id)
            if (initialAnswers) setAnswers(initialAnswers)
        }
    }

    useEffect(() => {
        if (game?.status !== 'question' || !currentQuestion || !game.question_started_at) {
            setTimeLeft(0); return
        }
        const calculateTime = () => {
            const start = new Date(game.question_started_at).getTime()
            const now = Date.now()
            const elapsed = Math.floor((now - start) / 1000)
            const tempo = game.settings?.tempo || 10
            const remaining = Math.max(0, tempo - elapsed)
            setTimeLeft(remaining)
        }
        calculateTime()
        const interval = setInterval(calculateTime, 1000)
        return () => clearInterval(interval)
    }, [game?.status, game?.question_started_at, currentQuestion])

    // Auto-Pilot Logic for Screen
    useEffect(() => {
        if (!isAutoPilot || !game || !questions.length) return

        let timer
        if (game.status === 'question' && answers.length > 0 && answers.length === players.length) {
            timer = setTimeout(() => handleNext(), 1500)
        } else if (game.status === 'results') {
            timer = setTimeout(() => handleNext(), 8000)
        }
        return () => clearTimeout(timer)
    }, [isAutoPilot, game?.status, answers.length, players.length])

    const updateStatus = async (status, indexOffset = 0) => {
        setIsUpdating(true)
        if (status === 'results') {
            await supabase.rpc('process_scores', {
                p_game_id: gameId,
                p_question_id: currentQuestion.id
            })
        }

        const updates = {
            status,
            current_question_index: (game.current_question_index + indexOffset),
            question_started_at: status === 'question' ? new Date().toISOString() : game.question_started_at
        }

        await supabase.from('games').update(updates).eq('id', gameId)
        setIsUpdating(false)
    }

    const handleNext = () => {
        if (game.status === 'waiting') {
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

    if (loading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin text-primary mb-4 mx-auto" size={64} />
                    <p className="font-display tracking-widest text-on-surface-variant uppercase text-sm">Cargando Juego...</p>
                </div>
            </div>
        )
    }

    const joinUrl = `${window.location.origin}/join?code=${game?.join_code}`

    return (
        <div className="min-h-screen bg-surface flex flex-col font-body text-on-surface selection:bg-primary/30">
            {/* Background Decorative Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[150px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[150px] animate-pulse-slow" />
            </div>

            {/* Header HUD */}
            <header className="px-10 py-4 flex justify-between items-center relative z-20 border-b border-white/5 bg-surface/30 backdrop-blur-sm">
                <div className="flex items-center gap-10">
                    <div>
                        <h1 className="text-4xl font-display font-black tracking-tighter leading-none mb-1">
                            LUKE<span className="text-primary">QUIZ</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <Users size={16} className="text-secondary" />
                            <p className="text-xl font-display font-bold leading-none">{players.length}</p>
                        </div>
                        {game?.join_code && (
                            <div className="bg-primary/20 border border-primary/20 px-6 py-2 rounded-xl text-primary font-display font-black text-2xl tracking-widest">
                                {game.join_code}
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-right hidden md:block opacity-40">
                    <p className="text-[8px] font-display font-bold uppercase tracking-[0.4em]">Interactividad en Vivo</p>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 overflow-hidden">
                {game?.status === 'waiting' && (
                    <div className="w-full max-w-6xl relative h-full flex items-center">
                        {/* Background Floating Bubbles Container */}
                        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                            {players.map((p, i) => {
                                // Deterministic random-like values based on index
                                const randomX = (i * 137.5) % 80; // Spread across 80% width
                                const randomY = (i * 123.4) % 70; // Spread across 70% height
                                const duration = 15 + (i % 10);
                                const delay = -(i * 2.5);

                                // Simple logic to push bubbles away from QR zone (bottom left area)
                                // If X < 30 and Y > 40 (QR area), push X further right
                                const finalX = (randomX < 35 && randomY > 40) ? randomX + 45 : randomX;

                                return (
                                    <div
                                        key={p.id}
                                        className="absolute transition-all duration-1000 animate-float-bubble glass px-6 py-4 rounded-3xl flex items-center gap-4 border-2 border-white/20 shadow-2xl"
                                        style={{
                                            left: `${finalX}%`,
                                            top: `${randomY}%`,
                                            animationDuration: `${duration}s`,
                                            animationDelay: `${delay}s`,
                                            opacity: 0.8,
                                            transform: `scale(${0.9 + (i % 5) * 0.1})`,
                                            zIndex: 5
                                        }}
                                    >
                                        <span className="text-4xl">{p.emoji}</span>
                                        <span className="text-2xl font-display font-black tracking-tight text-white">{p.nickname}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full relative z-10">
                            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                                <h2 className="text-8xl font-display font-black mb-8 leading-[0.9] uppercase italic">
                                    ¡Únete a la <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-tertiary">Partida!</span>
                                </h2>
                                <p className="text-2xl text-on-surface-variant font-display font-bold leading-tight mb-12 max-w-md opacity-80 uppercase tracking-widest">
                                    Escanea para participar <br /> y conviértete en el campeón.
                                </p>
                                <div className="glass p-6 rounded-[3rem] inline-block neon-glow-primary border-4 border-primary/20 bg-black/40 shadow-[0_0_50px_rgba(143,245,255,0.2)]">
                                    <QRCodeSVG value={joinUrl} size={280} bgColor="transparent" fgColor="#8ff5ff" includeMargin={true} />
                                </div>
                            </div>

                            <div className="flex items-center justify-center p-12">
                                <div className="glass p-12 rounded-[4rem] text-center border-white/5 relative overflow-hidden backdrop-blur-2xl">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
                                    <div className="relative z-10">
                                        <p className="text-sm font-display font-black text-secondary tracking-[0.4em] uppercase mb-4">Jugadores Listos</p>
                                        <div className="text-[10rem] font-display font-black leading-none text-white tracking-tighter drop-shadow-2xl">
                                            {players.length}
                                        </div>
                                        <div className="flex justify-center gap-2 mt-8">
                                            {[...Array(3)].map((_, i) => (
                                                <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {(game?.status === 'question' || game?.status === 'results') && currentQuestion && (
                    <div className="w-full max-w-[90vw] h-full flex flex-col justify-between py-4">
                        {/* Area Superior: Contador y Pregunta */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-12 mb-6">
                                <div className="relative">
                                    <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center relative glass transition-all duration-500 ${timeLeft < 5 ? 'border-danger scale-110 shadow-[0_0_20px_rgba(255,83,83,0.4)]' : 'border-primary/40'}`}>
                                        <div className="text-center">
                                            <p className={`text-5xl font-display font-black leading-none ${timeLeft < 5 ? 'text-danger' : 'text-on-surface'}`}>{timeLeft}</p>
                                        </div>
                                    </div>
                                </div>
                                <h2 className="text-4xl lg:text-6xl font-display font-bold text-center leading-tight max-w-5xl tracking-tight">
                                    {currentQuestion.text}
                                </h2>
                            </div>

                            {currentQuestion.image_url && (
                                <div className="w-full max-w-2xl h-[280px] mb-8 glass rounded-[2rem] overflow-hidden border border-white/10 relative shadow-2xl">
                                    <img
                                        src={currentQuestion.image_url}
                                        alt="Pregunta"
                                        className="w-full h-full object-cover opacity-95"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-surface/40 to-transparent" />
                                </div>
                            )}
                        </div>

                        {/* Area Central: Opciones */}
                        <div className="grid grid-cols-2 gap-4 w-full">
                            {[
                                { id: 'A', icon: '▲', label: currentQuestion.option_a },
                                { id: 'B', icon: '◆', label: currentQuestion.option_b },
                                { id: 'C', icon: '●', label: currentQuestion.option_c },
                                { id: 'D', icon: '■', label: currentQuestion.option_d }
                            ].map(opt => {
                                const isCorrect = opt.id === currentQuestion.correct_option
                                const showResults = game?.status === 'results'
                                return (
                                    <div
                                        key={opt.id}
                                        className={`option-card-premium option-${opt.id} px-8 py-6 rounded-2xl transition-all duration-500 flex items-center ${showResults ? (isCorrect ? 'scale-[1.03] border-4 border-success neon-glow-success shadow-[0_0_30px_rgba(46,213,115,0.4)]' : 'opacity-10 grayscale scale-95 blur-[1px]') : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-6 w-full">
                                            <div className="w-14 h-14 glass rounded-xl flex items-center justify-center text-2xl font-black">{opt.icon}</div>
                                            <p className={`text-2xl lg:text-3xl font-display font-bold truncate ${opt.id === 'C' && !showResults ? 'text-surface' : ''}`}>{opt.label}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Area Inferior: Estadisticas y Posiciones */}
                        <div className="mt-8 flex flex-col items-center">
                            <div className="flex items-center gap-8 mb-6">
                                <div className="glass px-8 py-2 rounded-full border border-white/5 flex items-center gap-4">
                                    <p className="text-[10px] font-display font-black uppercase tracking-widest text-on-surface-variant">Respuestas</p>
                                    <p className="text-2xl font-display font-black text-primary">{answers.length}</p>
                                </div>
                                {game.status === 'results' && (
                                    <div className="flex items-center gap-2 animate-bounce">
                                        <Sparkles className="text-secondary" size={20} />
                                        <p className="text-sm font-display font-black text-secondary tracking-widest uppercase italic">Ranking Provisorio</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 w-full justify-center">
                                {players.sort((a, b) => b.score - a.score).slice(0, 5).map((p, i) => (
                                    <div
                                        key={p.id}
                                        className={`glass-light p-4 rounded-3xl border-l-[6px] flex items-center gap-4 transition-all duration-700 animate-in slide-in-from-bottom-8`}
                                        style={{
                                            borderColor: i === 0 ? '#ffae00' : i === 1 ? '#e0e0e0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.1)',
                                            animationDelay: `${i * 150}ms`
                                        }}
                                    >
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-xs" style={{ background: i === 0 ? 'rgba(255,174,0,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                            {i + 1}
                                        </div>
                                        <span className="text-3xl">{p.emoji}</span>
                                        <div className="min-w-[100px]">
                                            <p className="text-sm font-display font-black leading-none truncate uppercase tracking-tight">{p.nickname}</p>
                                            <p className="text-base text-primary font-black mt-1 leading-none">{p.score.toLocaleString()} <span className="text-[8px] opacity-40">PTS</span></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {game?.status === 'finished' && (
                    <div className="w-full max-w-6xl text-center">
                        <div className="mb-20">
                            <Trophy size={120} className="text-primary mx-auto mb-6 drop-shadow-[0_0_30px_rgba(143,245,255,0.6)] animate-bounce" />
                            <h2 className="text-[9rem] font-display font-black italic tracking-tighter leading-[0.8] uppercase">
                                Juego <br />
                                <span className="text-primary">Finalizado</span>
                            </h2>
                        </div>
                        <div className="flex items-end justify-center gap-8 h-[400px]">
                            {/* P2 */}
                            {players[1] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-5xl mb-6 animate-float" style={{ animationDelay: '0.5s' }}>{players[1].emoji}</span>
                                    <div className="bg-surface-high w-48 h-[220px] rounded-t-3xl border-t border-white/10 flex flex-col items-center p-8 relative">
                                        <div className="absolute top-[-2px] left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                        <span className="font-display font-bold truncate w-full text-xl uppercase">{players[1].nickname}</span>
                                        <p className="text-xs text-on-surface-variant font-bold mt-2 uppercase tracking-widest italic">Segundo Lugar</p>
                                    </div>
                                </div>
                            )}
                            {/* P1 */}
                            {players[0] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-7xl mb-8 animate-float">{players[0].emoji}</span>
                                    <div className="bg-gradient-to-b from-primary/20 to-surface-high w-56 h-[320px] rounded-t-3xl border-t-2 border-primary/40 flex flex-col items-center p-10 relative neon-glow-primary">
                                        <span className="font-display font-black truncate w-full text-3xl uppercase text-primary">{players[0].nickname}</span>
                                        <p className="text-sm text-on-surface font-black mt-4 uppercase tracking-[0.2em] bg-primary/20 px-4 py-1 rounded-full">Ganador</p>
                                    </div>
                                </div>
                            )}
                            {/* P3 */}
                            {players[2] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-5xl mb-6 animate-float" style={{ animationDelay: '1s' }}>{players[2].emoji}</span>
                                    <div className="bg-surface-high w-48 h-[160px] rounded-t-3xl border-t border-white/5 flex flex-col items-center p-8">
                                        <span className="font-display font-bold truncate w-full text-xl uppercase">{players[2].nickname}</span>
                                        <p className="text-xs text-on-surface-variant font-bold mt-2 uppercase tracking-widest italic">Tercer Lugar</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <footer className="p-8 text-center text-on-surface-variant/30 text-[10px] font-display tracking-[0.5em] uppercase pointer-events-none relative z-10">
                Estado: Sincronizado | Conexión en tiempo real
            </footer>

            {/* Floating Admin Controls (Subtle) */}
            <div className="fixed bottom-8 right-8 z-[100] group">
                <div className="flex items-center gap-3 bg-surface-highest/80 backdrop-blur-md p-2 rounded-2xl border border-white/5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                    <button
                        onClick={() => setIsAutoPilot(!isAutoPilot)}
                        className={`p-2 rounded-xl transition-all ${isAutoPilot ? 'bg-primary/20 text-primary' : 'bg-white/5 text-on-surface-variant'}`}
                        title="Auto-Piloto"
                    >
                        <Activity size={18} />
                    </button>
                    <div className="px-4 py-2 border-r border-white/10 hidden md:block">
                        <p className="text-[8px] font-display font-black text-on-surface-variant uppercase tracking-widest">Panel de Control</p>
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={isUpdating || game?.status === 'finished'}
                        className="bg-primary/20 hover:bg-primary/40 text-primary px-6 py-2 rounded-xl font-display font-black text-xs uppercase tracking-tighter transition-all disabled:opacity-50"
                    >
                        {isUpdating ? 'Actualizando...' : (
                            game?.status === 'waiting' ? 'Iniciar Juego' :
                                game?.status === 'question' ? 'Ver Resultados' : 'Siguiente'
                        )}
                    </button>
                </div>
            </div>
        </div >
    )
}
