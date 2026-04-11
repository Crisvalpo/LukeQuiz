import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Trophy, Loader2, Activity } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useGameRoom } from '../hooks/useGameRoom'

export default function Screen() {
    const { gameId } = useParams()
    const { game, players, loading } = useGameRoom(gameId)
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const audioRef = useRef(null)
    const [audioUnlocked, setAudioUnlocked] = useState(false)
    const [answers, setAnswers] = useState([])

    useEffect(() => {
        if (game?.status === 'question' && currentQuestion?.audio_url && audioRef.current) {
            audioRef.current.load()
            const playPromise = audioRef.current.play()
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.error('Auto-play blocked:', e)
                    setAudioUnlocked(false)
                }).then(() => {
                    setAudioUnlocked(true)
                })
            }
        } else if (game?.status !== 'question' && audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
    }, [currentQuestion?.id, game?.status])

    const [timeLeft, setTimeLeft] = useState(0)
    const [isUpdating, setIsUpdating] = useState(false)
    const [questions, setQuestions] = useState([])
    const [isAutoPilot, setIsAutoPilot] = useState(true)

    const PLACEHOLDER_URL = 'https://i.postimg.cc/MH9RSFJ5/Sin-titulo.png';

    useEffect(() => {
        if (!game) return
        if (game.status === 'question') {
            fetchQuestion(game.quiz_id, game.current_question_index)
        } else if (game.status === 'finished') {
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.7 }, colors: ['#8ff5ff', '#ac89ff', '#ff59e3'] })
        }
        if (game.quiz_id && questions.length === 0) {
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
                    // Solo añadir si el jugador pertenece a esta partida
                    const isSessionPlayer = players.some(p => p.id === payload.new.player_id)
                    if (isSessionPlayer) {
                        setAnswers(prev => {
                            if (prev.some(a => a.id === payload.new.id)) return prev
                            return [...prev, payload.new]
                        })
                    }
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(answerSub) }
    }, [currentQuestion?.id, game?.status, players])

    const fetchQuestion = async (quizId, index) => {
        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizId).eq('order_index', index).single()
        if (qs) {
            setCurrentQuestion(qs)
            setAnswers([])

            // Carga inicial filtrada por jugadores de la sesión actual
            if (players.length > 0) {
                const { data: initialAnswers } = await supabase
                    .from('answers')
                    .select('*')
                    .eq('question_id', qs.id)
                    .in('player_id', players.map(p => p.id))

                if (initialAnswers) setAnswers(initialAnswers)
            }
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

    useEffect(() => {
        if (!game || !questions.length) return

        let timer
        // Lógica de finalización temprana: si todos respondieron, pasar a resultados
        if (game.status === 'question' && players.length > 0 && answers.length === players.length) {
            timer = setTimeout(() => handleNext(), 1000)
        }
        // Lógica de Piloto Automático para otros estados
        else if (isAutoPilot && game.status === 'results') {
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
                <Loader2 className="animate-spin text-primary mr-4" size={48} />
                <p className="font-display tracking-[0.2em] uppercase text-white">Preparando Partida...</p>
            </div>
        )
    }

    const joinUrl = `${window.location.origin}/join?code=${game?.join_code}`

    return (
        <div className="h-screen bg-surface flex flex-col font-body text-on-surface relative overflow-hidden">
            {/* Top Subtle Timer Bar */}
            {game?.status === 'question' && (
                <div className="fixed top-0 left-0 w-full h-[2px] z-[100] bg-white/5 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                        style={{ width: `${(timeLeft / (game.settings?.tempo || 10)) * 100}%` }}
                    />
                </div>
            )}

            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <header className="px-12 py-2 flex justify-between items-center relative z-20 border-b border-white/5 bg-surface-lowest/60 backdrop-blur-xl">
                <div className="flex items-center gap-12">
                    <h1 className="text-3xl font-display font-black tracking-tighter text-white italic leading-none">
                        LUKE<span className="text-primary">QUIZ</span>
                    </h1>
                    <div className="flex items-center gap-8 border-l border-white/10 pl-8">
                        <div className="flex items-center gap-3 bg-secondary/10 px-6 py-2 rounded-md border border-secondary/20">
                            <Users size={16} className="text-secondary" />
                            <p className="text-xl font-display font-black text-secondary">{players.length}</p>
                        </div>
                        {game?.status === 'waiting' && (
                            <div className="bg-primary/10 border border-primary/20 px-8 py-2 rounded-lg text-primary font-display font-black text-4xl tracking-[0.3em]">
                                {game?.join_code}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-display font-black tracking-[0.6em] text-primary animate-pulse">JUEGO EN VIVO // ACTIVO</p>
                </div>
            </header>

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
                {game?.status === 'waiting' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-12 relative overflow-hidden p-12 v-grid">

                        {/* Technical Player Grid */}
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
                            {/* Decorative background grid lines could go here */}
                        </div>

                        <div className="grid grid-cols-2 gap-20 items-center w-full max-w-7xl relative z-10">
                            <div className="text-left space-y-8">
                                <div className="space-y-2">
                                    <p className="text-xs font-display font-bold text-primary tracking-[0.8em] italic opacity-60">Interfaz de Juego</p>
                                    <p className="text-[9px] font-display font-black tracking-[0.6em]">LukeQuiz 3.0 // Portal de Juego</p>
                                    <h1 className="text-8xl font-display font-black leading-[0.85] italic text-white tracking-tighter">
                                        Ingresar al<br />
                                        <span className="text-primary">Juego</span>
                                    </h1>
                                </div>
                                <p className="text-xl text-on-surface-variant font-mono font-medium tracking-[0.2em] opacity-40">
                                    Estableciendo conexión... <br /> Escanea para entrar al juego
                                </p>
                                <div className="bg-white/[0.03] p-10 rounded-xl border border-white/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/40 scan-line animate-scan" />
                                    <QRCodeSVG value={joinUrl} size={300} bgColor="white" fgColor="#0b0118" includeMargin={true} />
                                </div>
                            </div>

                            <div className="flex flex-col gap-8">
                                <div className="bg-surface-lowest/80 p-16 rounded-xl text-center border border-white/10 backdrop-blur-3xl relative">
                                    <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] mb-8 opacity-60">Jugadores Conectados</p>
                                    <div className="text-[12rem] font-display font-black leading-none text-white tracking-tighter neon-glow-primary">
                                        {players.length}
                                    </div>
                                    <div className="mt-12 flex flex-wrap justify-center gap-3">
                                        {players.map(p => (
                                            <div key={p.id} className="bg-white/5 border border-white/10 px-4 py-2 rounded-md text-xs font-display font-black text-white italic flex items-center gap-2">
                                                <span className="text-lg">{p.emoji}</span>
                                                <span>{p.nickname}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {(game?.status === 'question' || game?.status === 'results') && currentQuestion && (
                    <div className="flex-1 flex overflow-hidden">
                        <audio key={currentQuestion?.id} ref={audioRef} src={currentQuestion?.audio_url} hidden />
                        {!audioUnlocked && game?.status === 'question' && (
                            <button
                                onClick={() => {
                                    audioRef.current.play().then(() => setAudioUnlocked(true))
                                }}
                                className="fixed bottom-24 right-12 z-[110] bg-pink-600 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest animate-bounce shadow-2xl shadow-pink-600/40 flex items-center gap-3"
                            >
                                <Activity size={16} /> ACTIVAR AUDIO
                            </button>
                        )}
                        {/* Sidebar */}
                        <aside className="w-1/4 bg-surface-lowest/80 backdrop-blur-2xl flex flex-col h-full p-10 border-r border-white/5 shadow-2xl">
                            <div className="flex items-center gap-3 mt-4">
                                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                                <p className="text-[10px] font-display font-black text-secondary tracking-[0.6em] uppercase italic">Clasificación Actual</p>
                            </div>

                            <div className="flex-1 overflow-y-auto py-8 custom-scrollbar">
                                <div className="space-y-4">
                                    {players.sort((a, b) => b.score - a.score).map((p, i) => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-500 border-l ${i === 0 ? 'bg-primary/10 border-primary' : 'bg-white/[0.03] border-white/5'}`}
                                        >
                                            <div className="w-8 h-8 rounded-md flex items-center justify-center font-display font-black text-[10px] bg-black/40 text-white/50 border border-white/5">
                                                {String(i + 1).padStart(2, '0')}
                                            </div>
                                            <span className="text-2xl">{p.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-display font-black truncate uppercase text-white tracking-tight">{p.nickname}</p>
                                                <p className="text-[9px] text-primary font-black uppercase tracking-widest opacity-80">{p.score.toLocaleString()} <span className="opacity-40 font-mono">PTS</span></p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 mb-4 text-left border-t border-white/5 pt-8">
                                <p className="text-[9px] font-display font-black tracking-[0.5em] text-white/30 uppercase">LukeQUIZ 3.0 // Partida_{gameId?.split('-')[0]}</p>
                                <p className="text-3xl font-display font-black text-primary tracking-tighter">{answers.length} <span className="text-white/20 text-lg">/</span> {players.length}</p>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-none overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-1000 shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                                    style={{ width: `${(answers.length / (players.length || 1)) * 100}%` }}
                                />
                            </div>
                        </aside>

                        {/* Main Interaction Area */}
                        <div className="w-3/4 flex flex-col p-16 h-full gap-12 v-grid relative">
                            <div className="scan-line absolute top-0 left-0 animate-scan z-0" />

                            <div className="flex items-start gap-12 relative z-10 w-full">
                                <div className="flex-1 space-y-2">
                                    <p className="text-[10px] font-display font-black text-secondary tracking-[0.8em] uppercase italic opacity-40">Control de Juego // Pregunta Actual</p>
                                    <h2 className="text-6xl font-display font-black leading-[0.95] tracking-tighter text-white italic drop-shadow-2xl">
                                        {currentQuestion.text}
                                    </h2>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-10 min-h-0 relative z-10">
                                <div className="flex-1 flex justify-center items-center min-h-0 py-2">
                                    <div className="h-full max-h-[25vh] w-fit bg-black/40 rounded-xl overflow-hidden border border-white/10 shadow-2xl relative group mx-auto">
                                        <img
                                            src={currentQuestion.image_url || PLACEHOLDER_URL}
                                            alt="Pregunta"
                                            className="w-full h-full object-contain transition-all duration-700"
                                            onError={(e) => {
                                                if (!e.target.src.includes('postimg.cc')) {
                                                    e.target.src = PLACEHOLDER_URL;
                                                }
                                            }}
                                        />
                                        <div className="absolute top-4 left-4 bg-primary/20 backdrop-blur-md px-3 py-1 border border-primary/30 rounded-md text-[8px] font-mono text-primary font-bold tracking-widest uppercase">Imagen de Referencia</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pb-10">
                                    {[
                                        { id: 'A', icon: 'A', label: currentQuestion.option_a },
                                        { id: 'B', icon: 'B', label: currentQuestion.option_b },
                                        { id: 'C', icon: 'C', label: currentQuestion.option_c },
                                        { id: 'D', icon: 'D', label: currentQuestion.option_d }
                                    ].map(opt => {
                                        const isCorrect = opt.id === currentQuestion.correct_option
                                        const showResults = game?.status === 'results'
                                        const count = answers.filter(a => a.selected_option === opt.id).length
                                        const total = answers.length || 1
                                        const percentage = (count / total) * 100
                                        return (
                                            <div
                                                key={opt.id}
                                                className={`option-card-premium option-${opt.id} px-10 rounded-lg transition-all duration-500 flex items-center h-full min-h-[90px] border border-white/5 relative overflow-hidden ${showResults ? (isCorrect ? 'scale-[1.05] border-4 border-success neon-glow-success z-20 shadow-[0_0_60px_rgba(128,255,128,0.4)]' : 'opacity-10 grayscale blur-[2px] scale-95') : 'hover:scale-[1.02]'}`}
                                            >
                                                {/* Progress Bar Background on Results */}
                                                {showResults && (
                                                    <div
                                                        className="absolute inset-0 bg-white/10 transition-all duration-1000 ease-out z-0"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                )}
                                                <div className="flex items-center justify-between w-full relative z-10">
                                                    <div className="flex items-center gap-8">
                                                        <div className="w-12 h-12 flex-shrink-0 bg-black/20 border border-white/10 rounded-md flex items-center justify-center text-2xl font-black">{opt.icon}</div>
                                                        <p className={`text-xl font-display font-black uppercase tracking-tight truncate ${opt.id === 'C' && !showResults ? 'text-surface' : 'text-white'}`}>{opt.label}</p>
                                                    </div>

                                                    {showResults && count > 0 && (
                                                        <div className="bg-black/40 px-4 py-2 rounded-md border border-white/10 flex items-center gap-2">
                                                            <Users size={12} className="text-white/50" />
                                                            <span className="text-lg font-display font-black text-white">{count}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )
                }

                {
                    game?.status === 'finished' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-hidden relative v-grid">
                            <div className="mb-20 text-center z-10">
                                <div className="flex items-center justify-center gap-4 mb-4">
                                    <div className="h-[1px] w-20 bg-primary/40" />
                                    <p className="text-xs font-display font-bold text-primary tracking-[1em] uppercase italic">Podio de Ganadores</p>
                                    <div className="h-[1px] w-20 bg-primary/40" />
                                </div>
                                <h2 className="text-[9.5rem] font-display font-black italic tracking-tighter leading-[0.8] uppercase text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                    JUEGO<br />
                                    <span className="text-primary">FINALIZADO</span>
                                </h2>
                            </div>

                            <div className="flex items-end justify-center gap-4 h-[400px] z-10 w-full max-w-5xl">
                                {/* P2 */}
                                {players[1] && (
                                    <div className="flex flex-col items-center flex-1 max-w-[200px]">
                                        <div className="mb-6 flex flex-col items-center gap-2">
                                            <span className="text-5xl animate-float">{players[1].emoji}</span>
                                            <div className="bg-secondary/40 px-3 py-1 rounded-sm border border-secondary/50 text-[8px] font-black text-white uppercase tracking-widest">SUB-CAMPEÓN</div>
                                        </div>
                                        <div className="bg-surface-lowest/80 border border-white/5 w-full h-[180px] rounded-xl flex flex-col items-center p-6 shadow-2xl relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-full h-[2px] bg-secondary opacity-40" />
                                            <span className="font-display font-black truncate w-full text-lg uppercase text-white/70">{players[1].nickname}</span>
                                            <p className="text-[4rem] font-display font-black text-white/10 absolute -bottom-4 -right-4 italic tracking-tighter">02</p>
                                        </div>
                                    </div>
                                )}
                                {/* P1 */}
                                {players[0] && (
                                    <div className="flex flex-col items-center flex-1 max-w-[280px]">
                                        <div className="mb-8 flex flex-col items-center gap-2">
                                            <span className="text-8xl animate-float drop-shadow-[0_0_30px_rgba(236,72,153,0.4)]">{players[0].emoji}</span>
                                            <div className="bg-primary px-4 py-1.5 rounded-sm text-[10px] font-black text-surface uppercase tracking-[0.4em] italic shadow-[0_0_20px_rgba(236,72,153,0.5)]">CAMPEÓN</div>
                                        </div>
                                        <div className="bg-primary/10 border border-primary/30 w-full h-[320px] rounded-xl flex flex-col items-center p-8 shadow-[0_0_100px_rgba(236,72,153,0.1)] relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-[4px] bg-primary animate-pulse" />
                                            <div className="scan-line absolute top-0 left-0 animate-scan opacity-20" />
                                            <span className="font-display font-black truncate w-full text-4xl uppercase text-primary mb-2">{players[0].nickname}</span>
                                            <span className="text-[10px] font-mono text-primary/60 tracking-[0.5em]">{players[0].score.toLocaleString()} PTS</span>
                                            <p className="text-[12rem] font-display font-black text-primary/5 absolute -bottom-10 -right-10 italic tracking-tighter select-none">01</p>
                                        </div>
                                    </div>
                                )}
                                {/* P3 */}
                                {players[2] && (
                                    <div className="flex flex-col items-center flex-1 max-w-[200px]">
                                        <div className="mb-6 flex flex-col items-center gap-2">
                                            <span className="text-5xl animate-float" style={{ animationDelay: '1s' }}>{players[2].emoji}</span>
                                            <div className="bg-white/10 px-3 py-1 rounded-sm border border-white/20 text-[8px] font-black text-white uppercase tracking-widest">TERCER PUESTO</div>
                                        </div>
                                        <div className="bg-surface-lowest/80 border border-white/5 w-full h-[140px] rounded-xl flex flex-col items-center p-6 shadow-2xl relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-full h-[2px] bg-white opacity-20" />
                                            <span className="font-display font-black truncate w-full text-lg uppercase text-white/50">{players[2].nickname}</span>
                                            <p className="text-[4rem] font-display font-black text-white/10 absolute -bottom-4 -right-4 italic tracking-tighter">03</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </main >

            <footer className="px-12 py-8 text-center text-on-surface-variant/20 text-[10px] font-display font-black tracking-[0.6em] uppercase relative z-20 border-t border-white/5 bg-black/20">
                Estado: Sincronizado | Conexión en tiempo real | LukeQuiz v2.0
            </footer>

            {/* Admin HUD */}
            <div className="fixed bottom-12 right-12 z-[100] group">
                <div className="flex items-center gap-4 bg-surface-highest/80 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                    <button
                        onClick={() => setIsAutoPilot(!isAutoPilot)}
                        className={`p-4 rounded-2xl transition-all ${isAutoPilot ? 'bg-primary/20 text-primary' : 'bg-white/5 text-on-surface-variant'}`}
                        title="Piloto Automático"
                    >
                        <Activity size={24} />
                    </button>
                    <div className="h-10 w-[1px] bg-white/10 mx-2" />
                    <button
                        onClick={handleNext}
                        disabled={isUpdating || game?.status === 'finished'}
                        className="bg-primary hover:bg-primary/80 text-surface px-10 py-4 rounded-2xl font-display font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                    >
                        {isUpdating ? 'Wait...' : (
                            game?.status === 'waiting' ? 'Iniciar' :
                                game?.status === 'question' ? 'Ver Resultados' : 'Siguiente'
                        )}
                    </button>
                </div>
            </div>
        </div >
    )
}
