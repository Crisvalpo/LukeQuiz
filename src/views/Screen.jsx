import React, { useState, useEffect } from 'react'
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
    const [answers, setAnswers] = useState([])
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
                <Loader2 className="animate-spin text-primary mr-4" size={48} />
                <p className="font-display tracking-[0.2em] uppercase text-white">Preparando Transmisión...</p>
            </div>
        )
    }

    const joinUrl = `${window.location.origin}/join?code=${game?.join_code}`

    return (
        <div className="h-screen bg-surface flex flex-col font-body text-on-surface relative overflow-hidden">
            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* HUD Header */}
            <header className="px-12 py-6 flex justify-between items-center relative z-20 bg-surface/40 backdrop-blur-md">
                <div className="flex items-center gap-12">
                    <h1 className="text-3xl font-display font-black tracking-tighter italic uppercase text-white">
                        Luke<span className="text-primary">QUIZ</span>
                    </h1>
                    <div className="flex items-center gap-8 border-l border-white/10 pl-8">
                        <div className="flex items-center gap-3">
                            <Users size={20} className="text-primary" />
                            <p className="text-2xl font-display font-black">{players.length}</p>
                        </div>
                        {game?.status === 'waiting' && (
                            <div className="bg-primary/10 border border-primary/20 px-8 py-2 rounded-2xl text-primary font-display font-black text-3xl tracking-[0.2em]">
                                {game?.join_code}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-right opacity-30">
                    <p className="text-[10px] font-display font-black uppercase tracking-[0.6em]">Interactividad en Vivo</p>
                </div>
            </header>

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
                {game?.status === 'waiting' && (
                    <div className="glass border-white/5 rounded-3xl px-24 py-16 flex flex-col items-center justify-center gap-12 relative overflow-hidden group">
                        {/* Bubbles strictly in main */}
                        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
                            {players.map((p, i) => {
                                const randomX = (i * 137.5) % 85;
                                const randomY = (i * 123.4) % 75;
                                const duration = 20 + (i % 15);
                                const delay = -(i * 3);
                                return (
                                    <div
                                        key={p.id}
                                        className="absolute transition-all duration-1000 animate-float-bubble glass px-10 py-6 rounded-3xl flex items-center gap-5 border border-white/20 shadow-2xl bg-surface-high/60 backdrop-blur-xl"
                                        style={{
                                            left: `${randomX}%`,
                                            top: `${randomY}%`,
                                            animationDuration: `${duration}s`,
                                            animationDelay: `${delay}s`,
                                            transform: `scale(${0.9 + (i % 3) * 0.1})`,
                                            zIndex: 5
                                        }}
                                    >
                                        <span className="text-5xl drop-shadow-md">{p.emoji}</span>
                                        <span className="text-2xl font-display font-black italic uppercase text-white">{p.nickname}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-2 gap-20 items-center w-full max-w-7xl relative z-10">
                            <div className="text-left">
                                <h1 className="text-7xl font-display font-black mb-10 leading-[1.1] uppercase italic text-white">
                                    ¡Únete a la <br />
                                    <span className="text-primary">Partida!</span>
                                </h1>
                                <p className="text-xl text-on-surface-variant font-display font-medium mb-16 uppercase tracking-[0.2em] opacity-70">
                                    Escanea para participar <br /> y demuestra tu conocimiento.
                                </p>
                                <div className="glass p-12 rounded-3xl inline-block neon-glow-primary border-2 border-primary/30 bg-black/60 shadow-2xl hover:scale-105 transition-all duration-700">
                                    <QRCodeSVG value={joinUrl} size={300} bgColor="transparent" fgColor="#8ff5ff" includeMargin={true} />
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="glass p-16 rounded-3xl text-center border-2 border-white/5 backdrop-blur-3xl min-w-[400px]">
                                    <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] uppercase mb-6 opacity-60 italic">Jugadores Conectados</p>
                                    <div className="text-[10rem] font-display font-black leading-none text-white tracking-tighter drop-shadow-[0_0_50px_rgba(143,245,255,0.3)]">
                                        {players.length}
                                    </div>
                                    <div className="flex justify-center gap-3 mt-12">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i * 300}ms` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {(game?.status === 'question' || game?.status === 'results') && currentQuestion && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar */}
                        <aside className="w-1/4 bg-surface-dark/40 backdrop-blur-xl flex flex-col h-full p-12">
                            <div className="flex items-center gap-3 mt-8">
                                <Trophy size={18} className="text-secondary" />
                                <p className="text-[11px] font-display font-black text-secondary tracking-[0.5em] uppercase italic">Posiciones</p>
                            </div>

                            <div className="flex-1 overflow-y-auto py-12 custom-scrollbar">
                                <div className="space-y-6">
                                    {players.sort((a, b) => b.score - a.score).map((p, i) => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-4 p-5 rounded-3xl transition-all duration-500 border-l-4 ${i === 0 ? 'bg-primary/10 border-primary' : 'bg-white/5 border-transparent'}`}
                                        >
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-xs bg-black/40 text-white">
                                                {i + 1}
                                            </div>
                                            <span className="text-3xl">{p.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-display font-black truncate uppercase text-white mb-0.5">{p.nickname}</p>
                                                <p className="text-xs text-primary font-black uppercase tracking-widest">{p.score.toLocaleString()} <span className="opacity-40">PTS</span></p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 mb-4 text-left">
                                <p className="text-[10px] font-display font-black text-white/40 uppercase tracking-widest italic">Respuestas</p>
                                <p className="text-4xl font-display font-black text-primary leading-none">{answers.length} / {players.length}</p>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-1000 shadow-[0_0_15px_rgba(143,245,255,0.5)]"
                                    style={{ width: `${(answers.length / (players.length || 1)) * 100}%` }}
                                />
                            </div>
                        </aside>

                        {/* Main Interaction Area */}
                        <div className="w-3/4 flex flex-col p-12 h-full gap-12">
                            <div className="flex items-start gap-12">
                                <div className="relative flex-shrink-0">
                                    <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center relative glass transition-all duration-500 ${timeLeft < 5 ? 'border-danger animate-pulse shadow-[0_0_40px_rgba(255,83,83,0.4)]' : 'border-primary/20'}`}>
                                        <p className={`text-5xl font-display font-black ${timeLeft < 5 ? 'text-danger' : 'text-white'}`}>{timeLeft}</p>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-5xl font-display font-black leading-[1.2] tracking-tighter text-white uppercase italic">
                                        {currentQuestion.text}
                                    </h2>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-10 min-h-0">
                                <div className="flex-1 flex justify-center items-center min-h-0 py-2">
                                    <div className="h-full max-h-[42vh] w-fit glass rounded-[3rem] overflow-hidden border-2 border-white/10 shadow-2xl relative bg-black/40 group mx-auto">
                                        <img
                                            src={currentQuestion.image_url || PLACEHOLDER_URL}
                                            alt="Pregunta"
                                            className="w-full h-full object-contain transition-all duration-700 group-hover:scale-105"
                                            onError={(e) => {
                                                if (!e.target.src.includes('postimg.cc')) {
                                                    e.target.src = PLACEHOLDER_URL;
                                                }
                                            }}
                                        />
                                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 pb-10">
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
                                                className={`option-card-premium option-${opt.id} px-10 rounded-[2rem] transition-all duration-500 flex items-center h-full min-h-[110px] ${showResults ? (isCorrect ? 'scale-[1.02] border-4 border-success neon-glow-success shadow-[0_0_40px_rgba(128,255,128,0.3)]' : 'opacity-10 grayscale blur-[1px]') : ''}`}
                                            >
                                                <div className="flex items-center gap-8 w-full">
                                                    <div className="w-14 h-14 flex-shrink-0 glass rounded-2xl flex items-center justify-center text-3xl font-black">{opt.icon}</div>
                                                    <p className={`text-2xl font-display font-black uppercase tracking-tight truncate ${opt.id === 'C' && !showResults ? 'text-surface' : 'text-white'}`}>{opt.label}</p>
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
                        <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-hidden relative">
                            <div className="mb-16 text-center z-10">
                                <Trophy size={100} className="text-primary mx-auto mb-8 drop-shadow-[0_0_50px_rgba(143,245,255,0.5)] animate-bounce" />
                                <h2 className="text-[8rem] font-display font-black italic tracking-tighter leading-[0.85] uppercase text-white">
                                    JUEGO <br />
                                    <span className="text-primary">FINALIZADO</span>
                                </h2>
                            </div>

                            <div className="flex items-end justify-center gap-12 h-[350px] z-10 w-full">
                                {/* P2 */}
                                {players[1] && (
                                    <div className="flex flex-col items-center">
                                        <span className="text-5xl mb-6 animate-float" style={{ animationDelay: '0.5s' }}>{players[1].emoji}</span>
                                        <div className="bg-surface-high/60 backdrop-blur-xl w-48 h-[180px] rounded-t-[3rem] border-t-2 border-white/10 flex flex-col items-center p-8 shadow-2xl">
                                            <span className="font-display font-black truncate w-full text-xl uppercase text-white/90">{players[1].nickname}</span>
                                            <p className="text-[10px] text-on-surface-variant font-black mt-4 uppercase tracking-[0.4em] italic opacity-60">Segundo</p>
                                        </div>
                                    </div>
                                )}
                                {/* P1 */}
                                {players[0] && (
                                    <div className="flex flex-col items-center">
                                        <span className="text-8xl mb-10 animate-float">{players[0].emoji}</span>
                                        <div className="bg-gradient-to-b from-primary/30 to-surface-high/60 backdrop-blur-2xl w-60 h-[300px] rounded-t-[3.5rem] border-t-4 border-primary/50 flex flex-col items-center p-10 shadow-[0_0_100px_rgba(143,245,255,0.2)]">
                                            <span className="font-display font-black truncate w-full text-3xl uppercase text-primary">{players[0].nickname}</span>
                                            <p className="text-xs text-on-surface font-black mt-6 uppercase tracking-[0.5em] bg-primary/20 px-6 py-2 rounded-full border border-primary/30">Ganador</p>
                                        </div>
                                    </div>
                                )}
                                {/* P3 */}
                                {players[2] && (
                                    <div className="flex flex-col items-center">
                                        <span className="text-5xl mb-6 animate-float" style={{ animationDelay: '1s' }}>{players[2].emoji}</span>
                                        <div className="bg-surface-high/60 backdrop-blur-xl w-48 h-[140px] rounded-t-[3rem] border-t-2 border-white/10 flex flex-col items-center p-8 shadow-2xl">
                                            <span className="font-display font-black truncate w-full text-xl uppercase text-white/90">{players[2].nickname}</span>
                                            <p className="text-[10px] text-on-surface-variant font-black mt-4 uppercase tracking-[0.4em] italic opacity-60">Tercero</p>
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
                        title="Auto-Piloto"
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
