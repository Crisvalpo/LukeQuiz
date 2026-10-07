import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, SUPABASE_SCHEMA } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Trophy, Loader2, Activity, SkipForward } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useGameRoom } from '../hooks/useGameRoom'
import LogoLukeQuiz from '../components/LogoLukeQuiz'
import { audioDirector } from '../lib/audioDirector'
import { toast } from 'sonner'

const BUBBLE_STYLES = [
    {
        bg: 'bg-gradient-to-br from-pink-500/35 via-fuchsia-500/25 to-purple-600/40',
        border: 'border-pink-400/60',
        glow: 'shadow-[0_10px_35px_rgba(236,72,153,0.45)]',
        pill: 'bg-pink-500/30 border-pink-400/50 text-pink-100'
    },
    {
        bg: 'bg-gradient-to-br from-cyan-500/35 via-teal-500/25 to-blue-600/40',
        border: 'border-cyan-400/60',
        glow: 'shadow-[0_10px_35px_rgba(6,182,212,0.45)]',
        pill: 'bg-cyan-500/30 border-cyan-400/50 text-cyan-100'
    },
    {
        bg: 'bg-gradient-to-br from-amber-500/35 via-orange-500/25 to-yellow-600/40',
        border: 'border-amber-400/60',
        glow: 'shadow-[0_10px_35px_rgba(245,158,11,0.45)]',
        pill: 'bg-amber-500/30 border-amber-400/50 text-amber-100'
    },
    {
        bg: 'bg-gradient-to-br from-emerald-500/35 via-green-500/25 to-teal-600/40',
        border: 'border-emerald-400/60',
        glow: 'shadow-[0_10px_35px_rgba(16,185,129,0.45)]',
        pill: 'bg-emerald-500/30 border-emerald-400/50 text-emerald-100'
    },
    {
        bg: 'bg-gradient-to-br from-violet-500/35 via-indigo-500/25 to-purple-700/40',
        border: 'border-violet-400/60',
        glow: 'shadow-[0_10px_35px_rgba(139,92,246,0.45)]',
        pill: 'bg-violet-500/30 border-violet-400/50 text-violet-100'
    },
    {
        bg: 'bg-gradient-to-br from-rose-500/35 via-red-500/25 to-pink-600/40',
        border: 'border-rose-400/60',
        glow: 'shadow-[0_10px_35px_rgba(244,63,94,0.45)]',
        pill: 'bg-rose-500/30 border-rose-400/50 text-rose-100'
    },
    {
        bg: 'bg-gradient-to-br from-sky-500/35 via-blue-500/25 to-cyan-600/40',
        border: 'border-sky-400/60',
        glow: 'shadow-[0_10px_35px_rgba(56,189,248,0.45)]',
        pill: 'bg-sky-500/30 border-sky-400/50 text-sky-100'
    },
    {
        bg: 'bg-gradient-to-br from-lime-500/35 via-emerald-500/25 to-green-600/40',
        border: 'border-lime-400/60',
        glow: 'shadow-[0_10px_35px_rgba(132,204,22,0.45)]',
        pill: 'bg-lime-500/30 border-lime-400/50 text-lime-100'
    }
];

export default function Screen() {
    const { gameId } = useParams()
    const { game, setGame, players, loading } = useGameRoom(gameId)

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
        // Desbloquea el motor de SFX del presentador (requiere gesto del usuario)
        const wasReady = audioDirector.ready
        audioDirector.ensure()
        if (!wasReady && audioDirector.ready && game?.status === 'waiting') {
            audioDirector.say('bienvenida')
        }
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
                    const utterance = new SpeechSynthesisUtterance(`La correcta es: ${correctText}`)
                    utterance.lang = 'es-ES'
                    utterance.rate = 1.15
                    // Ducking: los SFX bajan mientras habla la voz
                    utterance.onstart = () => audioDirector.setVoiceDucking(true)
                    utterance.onend = () => audioDirector.setVoiceDucking(false)

                    if (game?.is_autopilot ?? true) {
                        // Espera a que terminen bocina + sting para no solaparse.
                        // Reproducimos sin intervenir en la secuencia lógica,
                        // para evitar estancamientos por GC del navegador.
                        const speakTimer = setTimeout(() => window.speechSynthesis.speak(utterance), 1300)
                        return () => clearTimeout(speakTimer)
                    }
                }
            }
        }
    }, [game?.status, currentQuestion?.id, audioUnlocked, game?.is_autopilot])

    const [timeLeft, setTimeLeft] = useState(0)
    const [isUpdating, setIsUpdating] = useState(false)
    const [clockOffset, setClockOffset] = useState(0)

    useEffect(() => {
        const syncClock = async () => {
            try {
                const start = Date.now()
                const { data, error } = await supabase.rpc('get_server_time')
                if (!error && data) {
                    const serverTime = new Date(data).getTime()
                    const latency = (Date.now() - start) / 2
                    setClockOffset(serverTime + latency - Date.now())
                }
            } catch (e) {
                console.error('Error syncing clock:', e)
            }
        }
        syncClock()
    }, [])
    const [questions, setQuestions] = useState([])
    const isAutoPilot = game?.is_autopilot ?? true
    const screenSessionId = useRef(crypto.randomUUID())
    const [isMaster, setIsMaster] = useState(false)
    const playersRef = useRef(players)
    const handleNextRef = useRef(null)

    useEffect(() => {
        playersRef.current = players
    }, [players])

    // Claim Master Status
    useEffect(() => {
        if (!game || !gameId) return

        const claimMaster = async () => {
            // Si no hay master, intentamos ser nosotros
            if (!game.master_screen_id) {
                const { error } = await supabase
                    .from('games')
                    .update({ master_screen_id: screenSessionId.current })
                    .eq('id', gameId)
                    .is('master_screen_id', null)
                if (!error) {
                    setIsMaster(true)
                    setGame(prev => prev ? ({ ...prev, master_screen_id: screenSessionId.current }) : prev)
                }
            }
        }

        claimMaster()
        if (game.master_screen_id) {
            setIsMaster(game.master_screen_id === screenSessionId.current)
        }
    }, [game?.master_screen_id, gameId])

    const reclaimMaster = async () => {
        setIsUpdating(true)
        setIsMaster(true)
        setGame(prev => prev ? ({ ...prev, master_screen_id: screenSessionId.current }) : prev)
        try {
            const { error } = await supabase
                .from('games')
                .update({ master_screen_id: screenSessionId.current })
                .eq('id', gameId)
            if (error) throw error
            toast.success('¡Control maestro activado en esta pantalla!')
        } catch (err) {
            console.error('Error al reclamar control:', err)
            toast.error('No se pudo tomar el control maestro')
        } finally {
            setIsUpdating(false)
        }
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
            // Aviso de última pregunta (voz pregrabada, opcional)
            if (questions.length > 0 && game.current_question_index === questions.length - 1) {
                audioDirector.say('ultima_pregunta')
            }
        } else if (game.status === 'results') {
            // Bocina de cierre + sting de resultados (estilo concurso)
            audioDirector.timeUp()
            setTimeout(() => audioDirector.resultsSting(), 700)
        } else if (game.status === 'finished') {
            audioDirector.podium()
            // La voz entra cuando la fanfarria ya remató
            setTimeout(() => audioDirector.say('campeon'), 1300)
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
                { event: 'INSERT', schema: SUPABASE_SCHEMA, table: 'answers', filter: `question_id=eq.${currentQuestion.id}` },
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

    // --- Timer: reloj de pregunta (quita isUpdating de deps para no reiniciarse en mid-transition) ---
    useEffect(() => {
        if (game?.status !== 'question' || !currentQuestion || !game.question_started_at) {
            setTimeLeft(0)
            return
        }

        const calculateTime = () => {
            const start = new Date(game.question_started_at).getTime()
            const now = Date.now() + clockOffset
            const elapsed = Math.floor((now - start) / 1000)
            const tempo = parseInt(game.settings?.tempo) || 20
            const remaining = Math.max(0, tempo - elapsed)
            setTimeLeft(remaining)
            // Tic-tac de reloj estilo concurso (se intensifica en los últimos 5s)
            audioDirector.tick(remaining)
            // Usa ref para llamar siempre la versión más reciente sin stale closure
            if (remaining <= 0 && isMaster) handleNextRef.current?.()
        }

        calculateTime()
        const timer = setInterval(calculateTime, 1000)
        return () => clearInterval(timer)
    }, [game?.status, game?.question_started_at, currentQuestion?.id, clockOffset, isMaster])

    // --- Timer: avance cuando todos responden (usa ref para evitar stale closure) ---
    useEffect(() => {
        if (!game || !questions.length || game.status !== 'question') return
        // GUARD CRÍTICO: al pasar a una pregunta nueva, `answers` todavía contiene
        // las respuestas de la pregunta ANTERIOR hasta que fetchQuestion termina.
        // Sin este guard, el efecto veía "todos respondieron" con datos viejos y
        // saltaba directo a resultados sin dar tiempo a elegir alternativa.
        if (!currentQuestion || currentQuestion.order_index !== game.current_question_index) return

        // Solo cuentan los jugadores presentes ANTES de iniciar la pregunta:
        // los que se unen tarde no responden esta ronda y no bloquean el avance
        const startedAt = game.question_started_at ? new Date(game.question_started_at).getTime() : null
        const expected = players.filter(p => !startedAt || !p.created_at || new Date(p.created_at).getTime() <= startedAt).length

        // Si ya respondieron todos no hace falta el interval
        if (expected > 0 && answers.length >= expected && isMaster) {
            handleNextRef.current?.()
            return
        }
        const intervalId = setInterval(() => {
            if (expected > 0 && answers.length >= expected && isMaster) {
                handleNextRef.current?.()
            }
        }, 1000)
        return () => clearInterval(intervalId)
    }, [game?.status, game?.current_question_index, game?.question_started_at, currentQuestion?.id, answers.length, players.length, isMaster])

    // --- Timer: autopilot en pantalla de resultados (usa ref) ---
    useEffect(() => {
        if (!isAutoPilot || game?.status !== 'results' || !isMaster) return
        const timeoutId = setTimeout(() => handleNextRef.current?.(), 5500)
        return () => clearTimeout(timeoutId)
    }, [isAutoPilot, game?.status, game?.current_question_index, isMaster])

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

            // Usamos RPC para actualizar de forma atómica e idempotente garantizando el tiempo del servidor Postgres
            const { error } = await supabase
                .rpc('update_game_status', {
                    p_game_id: gameId,
                    p_status: status,
                    p_index_offset: indexOffset,
                    p_current_status: currentStatus,
                    p_current_index: currentIndex
                })

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
    // Mantiene el ref siempre con la versión más reciente (para timers con stale closure)
    handleNextRef.current = handleNext

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

            <header className="flex-shrink-0 flex items-center justify-between py-1.5 sm:py-2 md:py-[2.5vh] px-3 sm:px-4 md:px-[4vw] relative z-10 border-b border-white/5 bg-surface/50 backdrop-blur-md">
                <div className="flex items-center">
                    {/* Oculto en pantallas pequeñas o teléfonos landscape para no solapar elementos */}
                    <LogoLukeQuiz className="hidden sm:block h-6 sm:h-8 md:h-[5.5vh] max-h-[48px] w-auto" />
                </div>

                <div className="flex items-center gap-2 sm:gap-4 md:gap-[3vw]">
                    <div className="flex flex-col items-end">
                        <div className="hidden sm:flex items-center gap-1 opacity-50 mb-0.5">
                            <Activity size={10} className="text-primary" />
                            <span className="text-[10px] md:text-[1.1vh] font-black tracking-widest uppercase italic">Sincronización en Vivo</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 bg-black/50 px-2 sm:px-3 md:px-[2vh] py-0.5 md:py-[0.8vh] rounded-lg md:rounded-[1.2vh] border border-white/10">
                            <span className="text-[9px] sm:text-xs md:text-[1.3vh] font-black text-white/40 tracking-wider uppercase">PIN</span>
                            <span className="text-base sm:text-xl md:text-[3.2vh] font-display font-black text-white tracking-widest leading-none drop-shadow-[0_0_1vh_rgba(255,255,255,0.3)]">{game?.join_code || '------'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white/5 p-1 md:p-[0.8vh] px-2 md:px-[2vh] rounded-lg md:rounded-[1.2vh] border border-white/10 group animate-pulse-gentle">
                        <Users size={16} className="text-secondary" />
                        <span className="text-sm sm:text-base md:text-[2.6vh] font-display font-black text-white">{players.length}</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
                {game?.status === 'waiting' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Lado Izquierdo: QR y Acceso Responsivo */}
                        <div className="w-[38vw] max-w-[260px] sm:max-w-[300px] md:w-[32vw] flex flex-col items-center justify-center p-2 sm:p-3 md:p-[3vh] bg-surface-lowest/40 backdrop-blur-md border-r border-white/5 flex-shrink-0">
                            <div className="mb-2 sm:mb-3 md:mb-[2vh] text-center flex flex-col items-center">
                                <p className="text-[9px] sm:text-xs md:text-[1.3vh] font-black text-white/50 tracking-wider uppercase mb-1 sm:mb-2">¡Escanea para Unirte!</p>
                                <div className="p-2 sm:p-2.5 md:p-3 bg-white rounded-xl sm:rounded-2xl md:rounded-[2.5vh] shadow-[0_0_3vh_rgba(255,255,255,0.15)] flex items-center justify-center max-w-[130px] sm:max-w-[160px] md:max-w-[210px] max-h-[38vh] aspect-square">
                                    <QRCodeSVG
                                        value={joinUrl}
                                        className="w-full h-full object-contain"
                                        style={{ width: '100%', height: '100%' }}
                                        level="M"
                                    />
                                </div>
                            </div>
                            <div className="space-y-0.5 text-center">
                                <p className="text-[9px] sm:text-xs md:text-[1.4vh] font-display font-bold text-white/50 uppercase">O ingresa en:</p>
                                <p className="text-xs sm:text-sm md:text-[2.2vh] font-display font-black text-primary italic lowercase tracking-tight">quiz.lukeapp.cl/join</p>
                            </div>
                        </div>

                        {/* Lado Derecho: Jugadores como Burbujas Flotantes a Color */}
                        <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-3 md:p-[3vh] relative overflow-hidden min-w-0">
                            <div className="mb-1.5 sm:mb-2 md:mb-[2vh] text-center">
                                <h2 className="text-sm sm:text-lg md:text-[3.8vh] font-display font-black text-white tracking-wider uppercase items-center flex gap-2">
                                    Esperando <span className="text-primary flex items-center gap-1.5">Jugadores <Activity size={18} className="animate-spin-slow inline" /></span>
                                    {players.length > 0 && (
                                        <span className="text-xs sm:text-sm md:text-[1.8vh] font-mono font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 tabular-nums">
                                            {players.length}
                                        </span>
                                    )}
                                </h2>
                            </div>

                            <div className="flex-1 w-full overflow-y-auto px-[2vw] custom-scrollbar flex items-center justify-center">
                                {players.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-[2vh] text-center p-[4vh] opacity-60 animate-pulse">
                                        <div className="w-[12vh] h-[12vh] rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center">
                                            <span className="text-[5vh]">🎮</span>
                                        </div>
                                        <p className="text-[2vh] font-display font-black text-white/70 uppercase tracking-widest">
                                            ¡Escanea el código QR para entrar a la partida!
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center justify-center gap-[3.5vh] md:gap-[4.5vh] p-[2vh] max-w-5xl">
                                        {players.map((p, index) => {
                                            const theme = BUBBLE_STYLES[index % BUBBLE_STYLES.length];
                                            const animClass = index % 3 === 0 ? 'animate-bubble-1' : index % 3 === 1 ? 'animate-bubble-2' : 'animate-bubble-3';
                                            const duration = 4.5 + (index % 5) * 0.7; // 4.5s a 7.3s para movimiento suave y fluido
                                            const delay = (index * 0.35) % 2.5;

                                            return (
                                                <div
                                                    key={p.id}
                                                    className="animate-bubble-pop"
                                                    style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
                                                >
                                                    <div
                                                        className={`${animClass} group relative flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-115`}
                                                        style={{
                                                            '--bubble-duration': `${duration}s`,
                                                            '--bubble-delay': `${delay}s`
                                                        }}
                                                    >
                                                        {/* Burbuja Esférica 3D a Todo Color */}
                                                        <div className={`relative w-[13vh] h-[13vh] md:w-[15vh] md:h-[15vh] rounded-full ${theme.bg} ${theme.border} ${theme.glow} border-2 backdrop-blur-md flex flex-col items-center justify-center p-[1vh] transition-all duration-300 overflow-hidden`}>
                                                            {/* Brillos especulares de cristal de la burbuja */}
                                                            <div className="absolute top-[1.2vh] left-[2vh] w-[4.5vh] h-[2vh] bg-white/45 rounded-full blur-[1px] rotate-[-25deg] pointer-events-none" />
                                                            <div className="absolute bottom-[1vh] right-[2.2vh] w-[2.2vh] h-[1vh] bg-white/25 rounded-full blur-[1px] pointer-events-none" />

                                                            {/* Avatar / Emoji 100% A TODO COLOR (cero grayscale) */}
                                                            <span className="text-[6.5vh] md:text-[7.5vh] leading-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] select-none transform group-hover:scale-125 transition-transform duration-300">
                                                                {p.emoji || '👤'}
                                                            </span>
                                                        </div>

                                                        {/* Píldora de Nickname flotante */}
                                                        <div className={`-mt-[1.8vh] relative z-10 px-[1.8vw] py-[0.5vh] rounded-full ${theme.pill} border backdrop-blur-xl shadow-lg max-w-[20vw] truncate`}>
                                                            <p className="text-[1.8vh] font-display font-black tracking-tight uppercase text-center truncate drop-shadow text-white">
                                                                {p.nickname}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {(game?.status === 'question' || game?.status === 'results') && currentQuestion && (
                    <div className="flex-1 flex overflow-hidden">
                        <audio
                            key={currentQuestion?.id}
                            ref={audioRef}
                            src={currentQuestion?.audio_url}
                            onPlay={() => audioDirector.setVoiceDucking(true)}
                            onEnded={() => audioDirector.setVoiceDucking(false)}
                            onPause={() => audioDirector.setVoiceDucking(false)}
                            hidden
                        />
                        <aside className="w-[25vw] bg-surface-lowest/80 backdrop-blur-3xl flex flex-col h-full p-[3vh] border-r border-white/5 shadow-2xl relative">
                            <div className="flex items-center gap-[1vh] mb-[2vh]">
                                <div className="w-[1vh] h-[1vh] rounded-full bg-secondary animate-pulse" />
                                <p className="text-[1.2vh] font-display font-black text-secondary tracking-[0.4em] uppercase italic">Clasificación</p>
                            </div>
                            <div className="flex-1 overflow-y-auto py-[2vh] custom-scrollbar">
                                <div className="space-y-[1.5vh]">
                                    {sortedPlayers.map((p, i) => (
                                        <div key={p.id} className={`flex items-center gap-[1.5vh] p-[1.5vh] rounded-[1.5vh] border-l-[0.5vh] transition-all duration-[1500ms] transform hover:scale-105 relative overflow-hidden ${i === 0 ? 'bg-primary/10 border-primary shadow-[0_0_2vh_rgba(236,72,153,0.3)] scale-[1.02]' : 'bg-white/5 border-white/5 opacity-90'}`}>
                                            {i === 0 && <div className="absolute top-0 right-0 w-[10vh] h-[10vh] bg-primary/20 blur-[3vh] animate-pulse" />}
                                            <div className="relative z-10 w-[3vh] h-[3vh] rounded-[0.5vh] flex items-center justify-center font-display font-black text-[1.2vh] bg-black/60 text-white/50 border border-white/5">
                                                {String(i + 1).padStart(2, '0')}
                                            </div>
                                            <span className="relative z-10 text-[3vh] drop-shadow-md">{p.emoji}</span>
                                            <div className="relative z-10 flex-1 min-w-0">
                                                <p className="text-[1.8vh] font-display font-black truncate uppercase text-white tracking-tight">{p.nickname}</p>
                                                <p className="text-[2.2vh] text-primary font-black uppercase tracking-widest drop-shadow-[0_0_1vh_rgba(236,72,153,0.5)] transition-all duration-1000 tabular-nums">
                                                    {p.score.toLocaleString()} PTS
                                                </p>
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
                        onClick={async () => {
                            await supabase.from('games').update({ is_autopilot: !isAutoPilot }).eq('id', gameId)
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
