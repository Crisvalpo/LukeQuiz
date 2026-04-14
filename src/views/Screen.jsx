import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Trophy, Loader2, Activity, SkipForward } from 'lucide-react'
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
            setTimeLeft(0);
            return
        }
        const calculateTime = () => {
            const start = new Date(game.question_started_at).getTime()
            const now = Date.now()
            const elapsed = Math.floor((now - start) / 1000)
            const tempo = game.settings?.tempo || 10
            const remaining = Math.max(0, tempo - elapsed)
            setTimeLeft(remaining)

            // Auto-advance if time is up
            if (remaining <= 0 && !isUpdating) {
                handleNext()
            }
        }
        calculateTime()
        const interval = setInterval(calculateTime, 1000)
        return () => clearInterval(interval)
    }, [game?.status, game?.question_started_at, currentQuestion?.id, isUpdating])

    useEffect(() => {
        if (!game || !questions.length) return

        let timer
        // Lógica de finalización temprana: si todos respondieron, pasar a resultados
        if (game.status === 'question' && players.length > 0 && answers.length === players.length) {
            timer = setTimeout(() => handleNext(), 500)
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
        if (isUpdating) return
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

    // Keyboard controls for Unified Master View
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowRight') {
                e.preventDefault();
                // Si el juego ha terminado, SPACE redirige a home
                if (game?.status === 'finished') {
                    window.location.href = '/';
                    return;
                }
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [game?.status, currentQuestion, questions, answers, players, isUpdating]);

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
                        className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-1000 ease-linear shadow-lg shadow-primary/30"
                        style={{ width: `${(timeLeft / (game.settings?.tempo || 10)) * 100}%` }}
                    />
                </div>
            )}

            {/* Background Image / Glows - Memoized for Performance */}
            <BackgroundView status={game?.status} imageUrl={currentQuestion?.image_url} />

            <header className="px-16 md:px-24 py-5 flex justify-between items-center relative z-20 border-b border-white/5 bg-surface-lowest/60 backdrop-blur-xl">
                <div className="flex items-center gap-12">
                    <h1 className="text-3xl font-display font-black tracking-tighter text-white italic leading-none">
                        LUKE<span className="text-primary">QUIZ</span>
                    </h1>
                    <div className="flex items-center gap-8 border-l border-white/10 pl-8">
                        <div className="flex items-center gap-3 bg-secondary/10 px-6 py-2 rounded-xl border border-secondary/20">
                            <Users size={16} className="text-secondary" />
                            <p className="text-xl font-display font-black text-secondary">{players.length}</p>
                        </div>
                        {game?.status === 'waiting' && (
                            <div className="bg-primary/10 border border-primary/20 px-8 py-2 rounded-2xl text-primary font-display font-black text-4xl tracking-[0.3em]">
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
                    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden v-grid">
                        <div className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10 px-8 py-4">

                            {/* COLUMNA IZQUIERDA: ACCESO (QR) */}
                            <div className="lg:col-span-4 flex flex-col items-center animate-in slide-in-from-left duration-700">
                                <div className="bg-surface-lowest/40 p-4 rounded-[2rem] border border-white/5 backdrop-blur-md shadow-2xl relative group max-w-[280px]">
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-primary animate-scan z-20" />
                                    <div className="bg-white p-3 rounded-2xl shadow-inner flex justify-center">
                                        <QRCodeSVG value={joinUrl} size={220} bgColor="white" fgColor="#0b0118" includeMargin={false} className="w-full h-auto aspect-square" />
                                    </div>
                                    <div className="pt-3 text-center">
                                        <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] uppercase mb-1">Escanea para Entrar</p>
                                        <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Conexión Segura</p>
                                    </div>
                                </div>
                            </div>

                            {/* COLUMNA CENTRAL: SEPARADOR TECH */}
                            <div className="hidden lg:flex lg:col-span-1 justify-center h-1/2">
                                <div className="w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                            </div>

                            {/* COLUMNA DERECHA: AUDIENCIA */}
                            <div className="lg:col-span-7 flex flex-col items-center lg:items-start space-y-6 animate-in slide-in-from-right duration-700">
                                <div className="text-center lg:text-left w-full">
                                    <div className="flex items-center gap-4 mb-4 opacity-50 justify-center lg:justify-start">
                                        <Activity size={14} className="text-primary animate-pulse" />
                                        <p className="text-[11px] font-display font-black text-white tracking-[0.6em] uppercase">Monitoreo de Audiencia en Tiempo Real</p>
                                    </div>
                                    <div className="flex items-end gap-6 justify-center lg:justify-start">
                                        <span className="text-[6rem] font-display font-black leading-none text-white tracking-tighter transition-all duration-1000">
                                            {players.length}
                                        </span>
                                        <div className="mb-4 space-y-1 text-left">
                                            <p className="text-2xl font-display font-black text-primary uppercase italic leading-none">Jugadores</p>
                                            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Sincronizados</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6 h-[360px] flex flex-wrap content-start gap-4 custom-scrollbar overflow-y-auto backdrop-blur-sm relative group">
                                    {players.length === 0 ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
                                            <Users size={64} className="mb-4" />
                                            <p className="text-xs font-display font-black tracking-widest uppercase text-center">Esperando Conexiones...</p>
                                        </div>
                                    ) : (
                                        <>
                                            {players.map((p) => (
                                                <div key={p.id} className="animate-in fade-in zoom-in-90 duration-500 bg-white/5 border border-white/10 px-6 py-3 rounded-full flex items-center gap-4 hover:bg-white/10 transition-colors">
                                                    <span className="text-2xl">{p.emoji}</span>
                                                    <span className="text-sm font-display font-black text-white uppercase italic tracking-tighter">{p.nickname}</span>
                                                </div>
                                            ))}
                                            {/* Botón de inicio rápido flotante sobre la lista */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm rounded-[2.5rem]">
                                                <button onClick={handleNext} className="bg-primary text-surface px-12 py-4 rounded-xl font-display font-black text-xl uppercase italic tracking-widest shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                                                    Iniciar Sesión Ahora
                                                </button>
                                            </div>
                                        </>
                                    )}
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
                        {/* Sidebar: Cinematic & Narrower */}
                        <aside className="w-1/5 bg-surface-lowest/80 backdrop-blur-3xl flex flex-col h-full p-8 border-r border-white/5 shadow-2xl relative">
                            <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

                            <div className="flex items-center gap-3 mt-4">
                                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                                <p className="text-[10px] font-display font-black text-secondary tracking-[0.4em] uppercase italic">Clasificación</p>
                            </div>

                            <div className="flex-1 overflow-y-auto py-8 custom-scrollbar">
                                <div className="space-y-4">
                                    {players.sort((a, b) => b.score - a.score).map((p, i) => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-700 border-l ${i === 0 ? 'bg-primary/10 border-primary' : 'bg-white/5 border-white/5'}`}
                                        >
                                            <div className="w-8 h-8 rounded-md flex items-center justify-center font-display font-black text-[9px] bg-black/60 text-white/50 border border-white/5">
                                                {String(i + 1).padStart(2, '0')}
                                            </div>
                                            <span className="text-xl animate-in slide-in-from-left duration-300" style={{ animationDelay: `${i * 100}ms` }}>{p.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-display font-black truncate uppercase text-white tracking-tight">{p.nickname}</p>
                                                <p className="text-[9px] text-primary font-black uppercase tracking-widest opacity-80">{p.score.toLocaleString()} <span className="opacity-40 font-mono">PTS</span></p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 mb-4 text-left border-t border-white/5 pt-8">
                                <p className="text-[9px] font-display font-black tracking-[0.5em] text-white/30 uppercase">LukeQUIZ Master // SESSION_{gameId?.split('-')[0].toUpperCase()}</p>
                                <div className="flex items-end gap-3">
                                    <p className="text-3xl font-display font-black text-white/90 tracking-tighter">{answers.length}</p>
                                    <p className="text-sm font-display font-black text-white/20 mb-1 tracking-widest leading-none">/ {players.length} RESPUESTAS</p>
                                </div>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-none overflow-hidden relative">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000 shadow-lg shadow-primary/30"
                                    style={{ width: `${(answers.length / (players.length || 1)) * 100}%` }}
                                />
                            </div>
                        </aside>

                        {/* Main Interaction Area: More Space */}
                        <div className="w-4/5 flex flex-col p-16 md:p-20 h-full gap-12 v-grid relative">
                            <div className="scan-line absolute top-0 left-0 animate-scan z-0 opacity-10" />

                            <div className="flex items-start gap-12 relative z-10 w-full animate-in slide-in-from-top duration-700">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-4 opacity-50">
                                        <Activity size={12} className="text-primary animate-pulse" />
                                        <p className="text-[10px] font-display font-black text-white tracking-[0.8em] uppercase italic">Neural Audio Feed ACTIVE // Question Mode</p>
                                    </div>
                                    <h2 className={`font-display font-black leading-[1.1] tracking-tighter text-white max-w-5xl drop-shadow-2xl transition-all duration-500 ${currentQuestion.text.length > 120 ? 'text-2xl md:text-3xl' :
                                        currentQuestion.text.length > 80 ? 'text-3xl md:text-4xl' :
                                            currentQuestion.text.length > 50 ? 'text-4xl md:text-5xl' :
                                                'text-5xl md:text-6xl'
                                        }`}>
                                        {currentQuestion.text}
                                    </h2>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-10 min-h-0 relative z-10">
                                <div className="flex-1 flex justify-center items-center min-h-0 py-2">
                                    <div className="h-full max-h-[30vh] w-fit bg-black/40 rounded-3xl overflow-hidden border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative group mx-auto animate-in zoom-in duration-1000 delay-300">
                                        <img
                                            src={currentQuestion.image_url || PLACEHOLDER_URL}
                                            alt="Pregunta"
                                            className="w-full h-full object-contain transition-all duration-1000 hover:scale-110"
                                            onError={(e) => {
                                                if (!e.target.src.includes('postimg.cc')) {
                                                    e.target.src = PLACEHOLDER_URL;
                                                }
                                            }}
                                        />
                                        <div className="absolute top-4 left-4 bg-primary/20 backdrop-blur-md px-3 py-1 border border-primary/30 rounded-md text-[8px] font-mono text-primary font-bold tracking-widest uppercase">DATAFEED_IMG_01</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8 pb-10">
                                    {[
                                        { id: 'A', icon: 'A', label: currentQuestion.option_a, color: 'border-blue-500/30' },
                                        { id: 'B', icon: 'B', label: currentQuestion.option_b, color: 'border-amber-500/30' },
                                        { id: 'C', icon: 'C', label: currentQuestion.option_c, color: 'border-pink-500/30' },
                                        { id: 'D', icon: 'D', label: currentQuestion.option_d, color: 'border-emerald-500/30' }
                                    ].map(opt => {
                                        const isCorrect = opt.id === currentQuestion.correct_option
                                        const showResults = game?.status === 'results'
                                        const count = answers.filter(a => a.selected_option === opt.id).length
                                        const total = answers.length || 1
                                        const percentage = (count / total) * 100
                                        return (
                                            <div
                                                key={opt.id}
                                                className={`option-card-premium option-${opt.id} px-10 rounded-2xl transition-all duration-700 flex items-center h-full min-h-[100px] border relative overflow-hidden ${opt.color} ${showResults ? (isCorrect ? 'scale-[1.05] border-success-bright border-4 z-20 shadow-[0_0_80px_rgba(34,197,94,0.4)] animate-pulse-gentle' : 'opacity-20 grayscale blur-[4px] scale-95 border-white/5') : 'hover:scale-[1.02] hover:bg-white/[0.03] animate-in slide-in-from-bottom duration-500'}`}
                                                style={{ transitionDelay: `${opt.id === 'A' ? 0 : opt.id === 'B' ? 100 : opt.id === 'C' ? 200 : 300}ms` }}
                                            >
                                                {/* Progress Bar Background on Results */}
                                                {showResults && (
                                                    <div
                                                        className="absolute inset-0 bg-white/5 transition-all duration-[1.5s] ease-out z-0 border-r border-white/10"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                )}
                                                <div className="flex items-center justify-between w-full relative z-10">
                                                    <div className="flex items-center gap-8">
                                                        <div className={`w-12 h-12 flex-shrink-0 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center text-2xl font-black ${showResults && isCorrect ? 'text-success-bright text-3xl' : ''}`}>
                                                            {showResults && isCorrect ? '✓' : opt.icon}
                                                        </div>
                                                        <p className={`text-2xl font-display font-black uppercase tracking-tight truncate ${opt.id === 'C' && !showResults ? 'text-surface' : 'text-white'}`}>{opt.label}</p>
                                                    </div>

                                                    {showResults && count > 0 && (
                                                        <div className="bg-black/60 px-5 py-2 rounded-xl border border-white/10 flex items-center gap-3">
                                                            <Users size={14} className="text-white/40" />
                                                            <span className="text-2xl font-display font-black text-white/90 leading-none">{count}</span>
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
                )}

                {game?.status === 'finished' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-hidden relative v-grid">
                        <div className="mb-20 text-center z-10">
                            <div className="flex items-center justify-center gap-4 mb-4">
                                <div className="h-[1px] w-20 bg-primary/40" />
                                <p className="text-xs font-display font-bold text-primary tracking-[1em] uppercase italic">Podio de Ganadores</p>
                                <div className="h-[1px] w-20 bg-primary/40" />
                            </div>
                            <h2 className="text-7xl font-display font-black tracking-tight leading-none text-white uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                Juego<br />
                                <span className="text-primary">Finalizado</span>
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
                                    <div className="bg-primary/10 border border-primary/30 w-full h-[320px] rounded-2xl flex flex-col items-center p-8 shadow-2xl relative overflow-hidden">
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
                                    <div className="bg-surface-lowest/80 border border-white/5 w-full h-[140px] rounded-2xl flex flex-col items-center p-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-white opacity-20" />
                                        <span className="font-display font-black truncate w-full text-lg uppercase text-white/50">{players[2].nickname}</span>
                                        <p className="text-[4rem] font-display font-black text-white/10 absolute -bottom-4 -right-4 italic tracking-tighter">03</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Winner's Magic Pass Loop */}
                        {players[0] && (
                            <div className="mt-12 z-20 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-1000">
                                <div className="bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-amber-500/20 p-[1px] rounded-[2rem] shadow-[0_0_50px_rgba(236,72,153,0.2)]">
                                    <div className="bg-surface-lowest/90 backdrop-blur-2xl px-12 py-6 rounded-[2rem] flex items-center gap-12 border border-white/5">
                                        <div className="relative">
                                            <div className="absolute -inset-4 bg-amber-500/20 blur-xl animate-pulse rounded-full" />
                                            <Trophy size={48} className="text-amber-400 relative z-10" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-display font-black text-amber-500 tracking-[0.4em] uppercase mb-1">Premio al Master de la Trivia</p>
                                            <h3 className="text-2xl font-display font-black text-white italic tracking-tighter leading-none mb-1">Tu Pase Mágico está Listo</h3>
                                            <p className="text-[11px] text-white/40 font-bold tracking-widest uppercase">Canjéalo en tu próxima partida para usar IA gratis</p>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="bg-white/5 border-2 border-dashed border-amber-500/50 px-8 py-3 rounded-xl">
                                                <span className="text-3xl font-display font-black text-white tracking-[0.2em] italic">WINNER_{Math.random().toString(36).substring(2, 6).toUpperCase()}</span>
                                            </div>
                                            <p className="text-[8px] font-mono text-white/20 uppercase tracking-[0.2em]">Válido por 24 Horas</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <footer className="px-12 py-4 text-center text-on-surface-variant/20 text-[10px] font-display font-black tracking-[0.6em] uppercase relative z-20 border-t border-white/5 bg-black/20">
                Estado: Sincronizado | Conexión en tiempo real | LukeQuiz v3.0 Master Control
            </footer>

            {/* Unified Master HUD */}
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] group">
                <div className="flex items-center gap-6 bg-surface-lowest/90 backdrop-blur-3xl p-4 md:p-5 rounded-[2.5rem] border border-white/10 opacity-10 group-hover:opacity-100 transition-all transform translate-y-6 group-hover:translate-y-0 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
                    <div className="flex flex-col pl-4">
                        <p className="text-[7px] font-black text-white/30 tracking-[0.4em] uppercase leading-none mb-1">Control Maestro</p>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none italic">
                            {game?.status === 'waiting' ? 'Ready' : game?.status === 'question' ? 'Live' : 'Stats'}
                        </p>
                    </div>

                    <div className="h-8 w-[1px] bg-white/10" />

                    <button
                        onClick={() => setIsAutoPilot(!isAutoPilot)}
                        className={`p-3 rounded-2xl transition-all border ${isAutoPilot ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-on-surface-variant border-white/10'}`}
                        title="Piloto Automático"
                    >
                        <Activity size={20} className={isAutoPilot ? 'animate-pulse' : ''} />
                    </button>

                    <button
                        onClick={game?.status === 'finished' ? () => window.location.href = '/' : handleNext}
                        disabled={isUpdating}
                        className="bg-primary hover:bg-primary/80 text-surface px-12 py-3 rounded-[1.2rem] font-display font-black text-xs uppercase tracking-[0.3em] transition-all disabled:opacity-50 shadow-xl shadow-primary/20 flex items-center gap-4 italic"
                    >
                        {isUpdating ? 'Mastering...' : (
                            <>
                                <span>
                                    {game?.status === 'waiting' ? 'Iniciar' :
                                        game?.status === 'question' ? 'Ver Resultados' :
                                            game?.status === 'results' ? 'Siguiente' : 'Volver al Inicio'}
                                </span>
                                {game?.status === 'finished' ? <Activity size={16} /> : <SkipForward size={16} fill="currentColor" />}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Optimized Background Component to prevent stuttering on timer ticks
const BackgroundView = React.memo(({ status, imageUrl }) => {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {status === 'question' && imageUrl ? (
                <div key={imageUrl} className="absolute inset-0 z-0 transition-all duration-1000 animate-in fade-in zoom-in-110">
                    <img
                        src={imageUrl}
                        className="w-full h-full object-cover opacity-30 blur-[2px]"
                        alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
                </div>
            ) : (
                <div className="opacity-20 transition-all duration-1000">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary blur-[150px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
            )}
        </div>
    );
});
