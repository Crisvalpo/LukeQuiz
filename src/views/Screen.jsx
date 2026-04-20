import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Trophy, Loader2, Activity, SkipForward } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useGameRoom } from '../hooks/useGameRoom'
import LogoLukeQuiz from '../components/LogoLukeQuiz'

export default function Screen() {
    const { gameId } = useParams()
    const { game, players, loading } = useGameRoom(gameId)

    useEffect(() => {
        const lockOrientation = async () => {
            try {
                if (screen.orientation && screen.orientation.lock) {
                    await screen.orientation.lock('landscape')
                }
            } catch (err) {
                console.log('Orientation lock not possible without fullscreen or not supported:', err)
            }
        }
        lockOrientation()
    }, [])
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const audioRef = useRef(null)
    const [audioUnlocked, setAudioUnlocked] = useState(false)
    const [answers, setAnswers] = useState([])

    const unlockAudio = () => {
        if (audioUnlocked) return
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
        silentAudio.play().then(() => {
            setAudioUnlocked(true)
            console.log('Audio Context Unlocked')
        }).catch(e => console.error('Audio Unlock Failed:', e))
    }

    useEffect(() => {
        if (game?.status === 'question' &&
            currentQuestion?.audio_url &&
            currentQuestion.order_index === game.current_question_index &&
            audioRef.current) {
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
    }, [currentQuestion?.id, game?.status, game?.current_question_index])

    useEffect(() => {
        if (game?.status === 'results' && currentQuestion && audioUnlocked) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel()
                const correctOptStr = currentQuestion.correct_option?.toLowerCase()
                const correctText = currentQuestion[`option_${correctOptStr}`]
                if (correctText) {
                    const utterance = new SpeechSynthesisUtterance(`Correcto. ${correctText}`)
                    utterance.lang = 'es-ES'
                    utterance.rate = 1.05
                    window.speechSynthesis.speak(utterance)
                }
            }
        }
    }, [game?.status, currentQuestion?.id, audioUnlocked])

    const [timeLeft, setTimeLeft] = useState(0)
    const [isUpdating, setIsUpdating] = useState(false)
    const [questions, setQuestions] = useState([])
    const isAutoPilot = game?.is_autopilot ?? true
    const screenSessionId = useRef(crypto.randomUUID())
    const [isMaster, setIsMaster] = useState(false)
    const playersRef = useRef(players)

    useEffect(() => {
        playersRef.current = players
    }, [players])

    // Claim Master Status
    useEffect(() => {
        if (!game || !gameId) return

        const claimMaster = async () => {
            // Si no hay master, intentamos ser nosotros
            if (!game.master_screen_id) {
                await supabase
                    .from('games')
                    .update({ master_screen_id: screenSessionId.current })
                    .eq('id', gameId)
                    .is('master_screen_id', null)
            }
        }

        claimMaster()
        setIsMaster(game.master_screen_id === screenSessionId.current)
    }, [game?.master_screen_id, gameId])

    const reclaimMaster = async () => {
        await supabase
            .from('games')
            .update({ master_screen_id: screenSessionId.current })
            .eq('id', gameId)
    }

    // 1. Gestión de Datos y Efectos de Estado (Consolidado)
    useEffect(() => {
        if (!game) return

        // Carga inicial de preguntas si no existen
        if (game.quiz_id && questions.length === 0) {
            fetchQuestions(game.quiz_id)
        }

        // Acciones por cambio de estado
        if (game.status === 'question') {
            fetchQuestion(game.quiz_id, game.current_question_index)
        } else if (game.status === 'finished') {
            confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.7 },
                colors: ['#8ff5ff', '#ac89ff', '#ff59e3']
            })
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
                    // Usamos la Ref para evitar que la suscripción se reinicie cada vez que cambian los jugadores (scores)
                    const isSessionPlayer = playersRef.current.some(p => p.id === payload.new.player_id)
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
    }, [currentQuestion?.id, game?.status])

    const fetchQuestion = async (quizId, index) => {
        setCurrentQuestion(null) // Reset para evitar audio fantasma de pregunta anterior
        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizId).eq('order_index', index).single()
        if (qs) {
            setCurrentQuestion(qs)
            setAnswers([])
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
            const tempo = parseInt(game.settings?.tempo) || 20
            const remaining = Math.max(0, tempo - elapsed)
            setTimeLeft(remaining)

            // CUALQUIER dispositivo puede intentar avanzar si es auto-pilot
            if (remaining <= 0 && !isUpdating && isAutoPilot) {
                handleNext()
            }
        }

        calculateTime()
        const timer = setInterval(calculateTime, 1000)
        return () => clearInterval(timer)
    }, [game?.status, game?.question_started_at, currentQuestion?.id, isUpdating, isAutoPilot])

    useEffect(() => {
        if (!game || !questions.length) return
        let timer

        if (game.status === 'question') {
            const checkAnswers = () => {
                // Si todos respondieron, intentamos avanzar (sin importar el rol de Master)
                if (answers.length > 0 && answers.length >= players.length) {
                    handleNext()
                }
            }
            timer = setInterval(checkAnswers, 1000)
        } else if (isAutoPilot && game.status === 'results') {
            timer = setTimeout(() => handleNext(), 4000)
        }

        return () => {
            if (timer) {
                clearInterval(timer)
                clearTimeout(timer)
            }
        }
    }, [isAutoPilot, game?.status, answers.length, players.length])

    const updateStatus = async (status, indexOffset = 0) => {
        if (isUpdating) return
        setIsUpdating(true)

        // Estado local actual para validación idempotente
        const currentStatus = game.status
        const currentIndex = game.current_question_index

        try {
            if (status === 'results') {
                const currentQ = questions[currentIndex]
                if (currentQ) {
                    await supabase.rpc('process_scores', {
                        p_game_id: gameId,
                        p_question_id: currentQ.id
                    })
                }
            }

            const updates = {
                status,
                current_question_index: (currentIndex + indexOffset),
                question_started_at: status === 'question' ? new Date().toISOString() : game.question_started_at
            }

            // ACTUALIZACIÓN IDEMPOTENTE: solo si el estado no ha sido cambiado por otro dispositivo
            const { error } = await supabase
                .from('games')
                .update(updates)
                .eq('id', gameId)
                .eq('status', currentStatus)
                .eq('current_question_index', currentIndex)

            if (error) console.error('Error updating status:', error)
        } finally {
            setIsUpdating(false)
        }
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

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowRight') {
                e.preventDefault();
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
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

    return (
        <div onClick={unlockAudio} className="h-screen bg-surface flex flex-col font-body text-on-surface relative overflow-hidden cursor-pointer">
            {/* Top Timer Bar */}
            {game?.status === 'question' && (
                <div className="fixed top-0 left-0 w-full h-[2px] z-[100] bg-white/5 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-1000 ease-linear shadow-lg shadow-primary/30"
                        style={{ width: `${(timeLeft / (game.settings?.tempo || 10)) * 100}%` }}
                    />
                </div>
            )}

            <BackgroundView status={game?.status} imageUrl={currentQuestion?.image_url} />

            <header className="flex-shrink-0 flex items-center justify-between p-[3vh] px-[5vw] relative z-10 border-b border-white/5 bg-surface/50 backdrop-blur-md">
                <div className="flex items-center">
                    <LogoLukeQuiz className="h-[6vh] w-auto" />
                </div>

                <div className="flex items-center gap-[4vw]">
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-[1vh] opacity-50 mb-[0.5vh]">
                            <Activity size={12} className="text-primary" />
                            <span className="text-[1.2vh] font-black tracking-[0.3em] uppercase italic">Sincronización en Vivo</span>
                        </div>
                        <div className="flex items-center gap-[1.5vh] bg-black/40 px-[2.5vh] py-[1vh] rounded-[1.5vh] border border-white/10">
                            <span className="text-[1.5vh] font-black text-white/40 tracking-widest uppercase">PIN DE ACCESO</span>
                            <span className="text-[3.5vh] font-display font-black text-white tracking-widest leading-none drop-shadow-[0_0_1vh_rgba(255,255,255,0.3)]">{game?.join_code || '------'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-[1.5vh] bg-white/5 p-[1vh] px-[2.5vh] rounded-[1.5vh] border border-white/10 group animate-pulse-gentle">
                        <Users size={20} className="text-secondary" />
                        <span className="text-[3vh] font-display font-black text-white">{players.length}</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
                {game?.status === 'waiting' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Lado Izquierdo: QR y Acceso */}
                        <div className="w-[35vw] flex flex-col items-center justify-center p-[5vh] bg-surface-lowest/40 backdrop-blur-md border-r border-white/5">
                            <div className="mb-[4vh] text-center">
                                <p className="text-[1.5vh] font-black text-white/40 tracking-[0.4em] uppercase mb-[2vh]">¡Escanea para Unirte!</p>
                                <div className="p-[3vh] bg-white rounded-[3vh] shadow-[0_0_5vh_rgba(255,255,255,0.1)] hover:scale-105 transition-transform duration-500">
                                    <QRCodeSVG value={joinUrl} size={window.innerHeight * 0.25} level="H" />
                                </div>
                            </div>
                            <div className="space-y-[1vh] text-center">
                                <p className="text-[2vh] font-display font-black text-white uppercase tracking-tight">O ingresa en:</p>
                                <p className="text-[3vh] font-display font-black text-primary italic lowercase tracking-tighter">quiz.lukeapp.me/join</p>
                            </div>
                        </div>

                        {/* Lado Derecho: Jugadores */}
                        <div className="flex-1 flex flex-col items-center justify-center p-[4vh] relative">
                            <div className="mb-[4vh] text-center">
                                <h2 className="text-[5vh] font-display font-black text-white tracking-widest uppercase items-center flex gap-[2vw]">
                                    Esperando <span className="text-primary flex items-center gap-[1vw]">Jugadores <Activity size={32} className="animate-spin-slow" /></span>
                                </h2>
                            </div>

                            <div className="flex-1 w-full overflow-y-auto px-[3vw] custom-scrollbar">
                                <div className="grid grid-cols-3 xl:grid-cols-5 gap-[2vh] animate-in fade-in zoom-in duration-1000">
                                    {players.map((p, index) => (
                                        <div key={p.id} className="group relative animate-in zoom-in duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                                            <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-[2vh] blur opacity-0 group-hover:opacity-100 transition duration-500" />
                                            <div className="relative bg-surface-lowest/80 backdrop-blur-xl border border-white/5 rounded-[2vh] p-[2vh] flex flex-col items-center gap-[1vh] transition-all duration-300 group-hover:scale-110 group-hover:border-primary/30 shadow-xl overflow-hidden">
                                                <span className="text-[5vh] leading-none drop-shadow-lg filter grayscale group-hover:grayscale-0 transition-all duration-500">{p.emoji || '👤'}</span>
                                                <p className="text-[1.8vh] font-display font-black text-white uppercase tracking-tight truncate w-full text-center">{p.nickname}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {(game?.status === 'question' || game?.status === 'results') && currentQuestion && (
                    <div className="flex-1 flex overflow-hidden">
                        <audio key={currentQuestion?.id} ref={audioRef} src={currentQuestion?.audio_url} hidden />
                        <aside className="w-[25vw] bg-surface-lowest/80 backdrop-blur-3xl flex flex-col h-full p-[3vh] border-r border-white/5 shadow-2xl relative">
                            <div className="flex items-center gap-[1vh] mb-[2vh]">
                                <div className="w-[1vh] h-[1vh] rounded-full bg-secondary animate-pulse" />
                                <p className="text-[1.2vh] font-display font-black text-secondary tracking-[0.4em] uppercase italic">Clasificación</p>
                            </div>
                            <div className="flex-1 overflow-y-auto py-[2vh] custom-scrollbar">
                                <div className="space-y-[1.5vh]">
                                    {sortedPlayers.map((p, i) => (
                                        <div key={p.id} className={`flex items-center gap-[1.5vh] p-[1.5vh] rounded-[1vh] border-l ${i === 0 ? 'bg-primary/10 border-primary' : 'bg-white/5 border-white/5'}`}>
                                            <div className="w-[3vh] h-[3vh] rounded-[0.5vh] flex items-center justify-center font-display font-black text-[1vh] bg-black/60 text-white/50 border border-white/5">
                                                {String(i + 1).padStart(2, '0')}
                                            </div>
                                            <span className="text-[2.5vh]">{p.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[1.5vh] font-display font-black truncate uppercase text-white tracking-tight">{p.nickname}</p>
                                                <p className="text-[1.2vh] text-primary font-black uppercase tracking-widest opacity-80">{p.score.toLocaleString()} PTS</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-auto pt-[2vh] border-t border-white/5">
                                <div className="flex items-end gap-[1vh] mb-[1vh]">
                                    <p className="text-[4vh] font-display font-black text-white/90 tracking-tighter leading-none">{answers.length}</p>
                                    <p className="text-[1.5vh] font-display font-black text-white/20 tracking-widest leading-none mb-[0.5vh]">/ {players.length} RESPUESTAS</p>
                                </div>
                                <div className="h-[0.5vh] w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000" style={{ width: `${(answers.length / (players.length || 1)) * 100}%` }} />
                                </div>
                            </div>
                        </aside>

                        <div className="flex-1 flex flex-col p-[5vh] h-full gap-[4vh] relative overflow-hidden items-center justify-center">
                            <h2 className={`font-display font-black leading-[1.1] tracking-tighter text-white max-w-5xl text-center mb-[2vh] ${currentQuestion.text.length > 100 ? 'text-[4vh]' : 'text-[6vh]'}`}>
                                {currentQuestion.text}
                            </h2>

                            <div className="grid grid-cols-2 gap-[3vh] w-full max-w-[75vw]">
                                {[
                                    { id: 'A', label: currentQuestion.option_a, color: 'border-blue-500/30' },
                                    { id: 'B', label: currentQuestion.option_b, color: 'border-amber-500/30' },
                                    { id: 'C', label: currentQuestion.option_c, color: 'border-pink-500/30' },
                                    { id: 'D', label: currentQuestion.option_d, color: 'border-emerald-500/30' }
                                ].map(opt => {
                                    const isCorrect = opt.id === currentQuestion.correct_option
                                    const showResults = game?.status === 'results'
                                    const count = answers.filter(a => a.selected_option === opt.id).length
                                    const percentage = (count / (answers.length || 1)) * 100
                                    return (
                                        <div key={opt.id} className={`rounded-[2vh] p-[3vh] border relative overflow-hidden transition-all duration-500 ${opt.color} ${showResults ? (isCorrect ? 'border-success-bright border-[0.5vh] shadow-[0_0_4vh_rgba(34,197,94,0.4)] scale-105 z-10' : 'opacity-20 grayscale brightness-50') : 'bg-surface-lowest/40'}`}>
                                            {showResults && <div className="absolute inset-0 bg-white/5" style={{ width: `${percentage}%` }} />}
                                            <div className="flex items-center justify-between w-full relative z-10">
                                                <div className="flex items-center gap-[3vh]">
                                                    <div className="w-[6vh] h-[6vh] rounded-[1vh] bg-black/40 border border-white/10 flex items-center justify-center text-[3vh] font-black">
                                                        {showResults && isCorrect ? '✓' : opt.id}
                                                    </div>
                                                    <p className={`font-display font-black text-white truncate max-w-[25vw] ${opt.label?.length > 50 ? 'text-[2vh]' : 'text-[3vh]'}`}>{opt.label}</p>
                                                </div>
                                                {showResults && count > 0 && <span className="text-[3vh] font-display font-black text-white/90">{count}</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {game?.status === 'finished' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-[5vh] relative overflow-hidden">
                        <div className="mb-[6vh] text-center z-10">
                            <h2 className="text-[8vh] font-display font-black tracking-tight leading-none text-white uppercase italic">
                                Juego <span className="text-primary">Finalizado</span>
                            </h2>
                        </div>
                        <div className="flex items-end justify-center gap-[4vw] h-[45vh] z-10 w-full max-w-[80vw]">
                            {sortedPlayers[1] && (
                                <div className="flex flex-col items-center flex-1 max-w-[20vw]">
                                    <div className="mb-[2vh] flex flex-col items-center gap-[1vh]">
                                        <span className="text-[6vh] animate-float">{sortedPlayers[1].emoji}</span>
                                        <div className="bg-secondary/40 px-[2vh] py-[0.5vh] rounded-md border border-secondary/50 text-[1.2vh] font-black text-white uppercase tracking-widest">SUB-CAMPEÓN</div>
                                    </div>
                                    <div className="bg-surface-lowest/80 border border-white/5 w-full h-[25vh] rounded-[2vh] flex flex-col items-center p-[4vh] shadow-2xl relative overflow-hidden">
                                        <span className="font-display font-black truncate w-full text-[2.5vh] uppercase text-white/70 text-center">{sortedPlayers[1].nickname}</span>
                                        <p className="text-[10vh] font-display font-black text-white/5 absolute -bottom-[2vh] -right-[2vh] italic">02</p>
                                    </div>
                                </div>
                            )}
                            {sortedPlayers[0] && (
                                <div className="flex flex-col items-center flex-1 max-w-[25vw]">
                                    <div className="mb-[4vh] flex flex-col items-center gap-[1.5vh]">
                                        <span className="text-[10vh] animate-float drop-shadow-[0_0_4vh_rgba(236,72,153,0.4)]">{sortedPlayers[0].emoji}</span>
                                        <div className="bg-primary px-[3vh] py-[1vh] rounded-md text-[1.5vh] font-black text-surface uppercase tracking-[0.4em] italic shadow-[0_0_3vh_rgba(236,72,153,0.5)]">CAMPEÓN</div>
                                    </div>
                                    <div className="bg-primary/10 border border-primary/30 w-full h-[35vh] rounded-[3vh] flex flex-col items-center p-[6vh] shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-primary animate-pulse" />
                                        <span className="font-display font-black truncate w-full text-[5vh] uppercase text-primary mb-[1vh] text-center">{sortedPlayers[0].nickname}</span>
                                        <span className="text-[1.5vh] font-mono text-primary/60 tracking-[0.5em]">{sortedPlayers[0].score.toLocaleString()} PTS</span>
                                        <p className="text-[15vh] font-display font-black text-primary/5 absolute -bottom-[4vh] -right-[4vh] italic">01</p>
                                    </div>
                                </div>
                            )}
                            {sortedPlayers[2] && (
                                <div className="flex flex-col items-center flex-1 max-w-[20vw]">
                                    <div className="mb-[2vh] flex flex-col items-center gap-[1vh]">
                                        <span className="text-[6vh] animate-float" style={{ animationDelay: '1s' }}>{sortedPlayers[2].emoji}</span>
                                        <div className="bg-white/10 px-[2vh] py-[0.5vh] rounded-md border border-white/20 text-[1.2vh] font-black text-white uppercase tracking-widest">TERCER PUESTO</div>
                                    </div>
                                    <div className="bg-surface-lowest/80 border border-white/5 w-full h-[20vh] rounded-[2vh] flex flex-col items-center p-[4vh] shadow-2xl relative overflow-hidden">
                                        <span className="font-display font-black truncate w-full text-[2.5vh] uppercase text-white/50 text-center">{sortedPlayers[2].nickname}</span>
                                        <p className="text-[10vh] font-display font-black text-white/5 absolute -bottom-[2vh] -right-[2vh] italic">03</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <footer className="px-[5vw] py-[2vh] text-center text-white/20 text-[1.2vh] font-display font-black tracking-[0.6em] uppercase relative z-20 border-t border-white/5 bg-black/20">
                Estado: Sincronizado | Conexión en tiempo real | LukeQuiz v3.1 Master Control
            </footer>

            {/* Floating Master HUD - Ahora en la parte superior */}
            <div className="fixed top-[5vh] left-1/2 -translate-x-1/2 z-[100] group">
                <div className="flex items-center gap-[3vw] bg-surface-lowest/90 backdrop-blur-3xl p-[2vh] rounded-[5vh] border border-white/10 opacity-10 group-hover:opacity-100 transition-all shadow-[0_3vh_10vh_rgba(0,0,0,0.8)]">
                    <div className="flex flex-col pl-[2vh]">
                        <p className="text-[1vh] font-black text-white/30 tracking-[0.4em] uppercase leading-none mb-[0.5vh]">Control Maestro</p>
                        <p className={`text-[1.5vh] font-black uppercase tracking-widest leading-none italic ${isMaster ? 'text-primary' : 'text-white/40'}`}>
                            {isMaster ? 'Master Controller' : 'Spectator / Mirror'}
                        </p>
                    </div>
                    <div className="h-[4vh] w-[1px] bg-white/10" />
                    <button
                        onClick={() => {
                            supabase.from('games').update({ is_autopilot: !isAutoPilot }).eq('id', gameId)
                        }}
                        className={`p-[1.5vh] rounded-[1.5vh] border ${isAutoPilot ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-white/40 border-white/10'}`}
                    >
                        <Activity size={20} className={isAutoPilot ? 'animate-pulse' : ''} />
                    </button>
                    {!isMaster ? (
                        <button
                            onClick={reclaimMaster}
                            className="bg-secondary/20 hover:bg-secondary/40 text-secondary border border-secondary/30 px-[4vw] py-[2vh] rounded-[2vh] font-display font-black text-[1.2vh] uppercase tracking-[0.2em] transition-all flex items-center gap-[1vw]"
                        >
                            <Activity size={14} /> Tomar Control
                        </button>
                    ) : (
                        <button onClick={game?.status === 'finished' ? () => window.location.href = '/' : handleNext} disabled={isUpdating} className="bg-primary hover:bg-primary/80 text-surface px-[6vw] py-[2vh] rounded-[2vh] font-display font-black text-[1.5vh] uppercase tracking-[0.3em] transition-all shadow-xl shadow-primary/20 flex items-center gap-[2vw] italic">
                            {isUpdating ? 'Mastering...' : (
                                <>
                                    <span>{game?.status === 'waiting' ? 'Iniciar' : game?.status === 'question' ? 'Ver Resultados' : game?.status === 'results' ? 'Siguiente' : 'Volver al Inicio'}</span>
                                    {game?.status === 'finished' ? <Activity size={16} /> : <SkipForward size={16} fill="currentColor" />}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Orientation Lock Overlay */}
            <div className="tv-landscape-lock">
                <div className="rotate-icon">
                    <div className="absolute inset-2 border-2 border-white/20 rounded-sm" />
                </div>
                <h2 className="text-2xl font-black mb-4 uppercase tracking-widest text-primary">Gira tu Pantalla</h2>
                <p className="text-white/60 font-medium uppercase tracking-widest text-sm">Esta vista solo funciona en modo horizontal</p>
            </div>
        </div>
    )
}

const BackgroundView = React.memo(({ status, imageUrl }) => {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {status === 'question' && imageUrl ? (
                <div key={imageUrl} className="absolute inset-0 z-0 transition-all duration-1000 animate-in fade-in zoom-in-110">
                    <img
                        src={imageUrl}
                        className="w-full h-full object-cover opacity-30 blur-[2px]"
                        alt=""
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://placehold.co/600x400/111/fff?text=Imagen+Invalida';
                        }}
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
