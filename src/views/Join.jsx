import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EMOJIS } from '../utils/helpers'
import { User, Key, CheckCircle2, Users, Loader2, Sparkles, Send } from 'lucide-react'
import { toast } from 'sonner'

export default function Join() {
    const [searchParams] = useSearchParams()
    const [code, setCode] = useState(searchParams.get('code') || '')
    const [nickname, setNickname] = useState('')
    const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0])
    const [loading, setLoading] = useState(false)
    const [joined, setJoined] = useState(false)
    const [player, setPlayer] = useState(null)
    const [game, setGame] = useState(null)
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const [hasAnswered, setHasAnswered] = useState(false)
    const [playerAnswer, setPlayerAnswer] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        const stored = localStorage.getItem('kahoot_player')
        if (stored) {
            const p = JSON.parse(stored)
            validateSession(p)
        }
    }, [])

    const validateSession = async (p) => {
        setLoading(true)
        const { data: playerExists } = await supabase.from('players').select('*, games(*)').eq('id', p.id).single()

        if (playerExists && (playerExists.games?.status !== 'finished' || playerExists.games?.status === 'finished')) {
            setPlayer(playerExists)
            setGame(playerExists.games)
            setJoined(true)
            if (playerExists.games?.status === 'question') {
                fetchQuestion(playerExists.games.quiz_id, playerExists.games.current_question_index)
            }
        } else {
            localStorage.removeItem('kahoot_player')
        }
        setLoading(false)
    }

    useEffect(() => {
        if (joined && player) {
            const channel = supabase.channel(`game_${player.game_id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${player.game_id}` },
                    async (payload) => {
                        setGame(payload.new)
                        if (payload.new.status === 'question') {
                            setPlayerAnswer(null)
                            fetchQuestion(payload.new.quiz_id, payload.new.current_question_index)
                        }
                        if (payload.new.status === 'results' || payload.new.status === 'finished') {
                            const { data: p } = await supabase.from('players').select('*').eq('id', player.id).single()
                            if (p) setPlayer(p)
                        }
                    }
                )
                .subscribe()

            return () => channel.unsubscribe()
        }
    }, [joined, player])

    const fetchQuestion = async (quizId, index) => {
        const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizId).eq('order_index', index).single()
        if (data) {
            setCurrentQuestion(data)
            const { data: answered } = await supabase.from('answers').select('id, selected_option').eq('player_id', player.id).eq('question_id', data.id).maybeSingle()
            if (answered) {
                setHasAnswered(true)
                setPlayerAnswer(answered.selected_option)
            } else {
                setHasAnswered(false)
            }
        }
    }

    const handleJoin = async (e) => {
        e.preventDefault()
        if (!nickname.trim()) return
        setLoading(true)

        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .select('id, status, quiz_id, current_question_index')
            .eq('join_code', code.toUpperCase())
            .single()

        if (gameError || !gameData) {
            toast.error('Código Inválido: No se encontró el juego')
            setLoading(false)
            return
        }

        if (gameData.status === 'finished') {
            toast.error('El juego ya ha terminado')
            setLoading(false)
            return
        }

        const { data: newPlayer, error: playerError } = await supabase
            .from('players')
            .insert({ game_id: gameData.id, nickname, emoji: selectedEmoji, score: 0 })
            .select()
            .single()

        if (playerError) {
            toast.error('Error al unirse al juego')
            setLoading(false)
            return
        }

        setPlayer(newPlayer)
        setGame(gameData)
        setJoined(true)
        setLoading(false)
        localStorage.setItem('kahoot_player', JSON.stringify(newPlayer))
        toast.success('¡Te has unido al juego!')
    }

    const submitAnswer = async (option) => {
        if (hasAnswered || game?.status !== 'question' || !currentQuestion) return

        setHasAnswered(true)
        setPlayerAnswer(option)
        const { error } = await supabase
            .from('answers')
            .insert({ player_id: player.id, question_id: currentQuestion.id, selected_option: option })

        if (error) {
            toast.error('Error al enviar la respuesta')
            setHasAnswered(false)
            setPlayerAnswer(null)
        } else {
            toast.success('Respuesta enviada')
        }
    }

    if (loading && !joined) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
                <Loader2 className="animate-spin text-primary mb-6" size={48} />
                <p className="font-display text-sm tracking-[0.4em] text-on-surface-variant uppercase">Entrando al juego...</p>
            </div>
        )
    }

    if (joined) {
        return (
            <div className="min-h-screen bg-surface flex flex-col p-6 font-body text-on-surface relative overflow-hidden">
                {/* Ambient Glows */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
                    <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-primary blur-[100px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-secondary blur-[100px]" />
                </div>

                <div className="relative z-10 flex-1 flex flex-col">
                    {(!game || game.status === 'waiting') && (
                        <div className="flex-1 flex flex-col items-center justify-center pb-20">
                            <div className="glass p-12 rounded-[3.5rem] text-center neon-glow-secondary max-w-sm w-full">
                                <div className="text-[7rem] mb-6 animate-float drop-shadow-2xl">{player?.emoji}</div>
                                <h2 className="text-4xl font-display font-black tracking-tight mb-2 uppercase italic text-white">{player?.nickname}</h2>
                                <div className="h-[2px] w-12 bg-secondary/50 mx-auto mb-6" />
                                <p className="text-on-surface-variant/80 font-display font-medium leading-relaxed uppercase tracking-wider text-xs">
                                    Esperando a que el anfitrión inicie...
                                </p>
                            </div>
                        </div>
                    )}

                    {game?.status === 'question' && (
                        <div className="flex-1 flex flex-col pt-6">
                            <div className="text-center mb-8">
                                <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] uppercase mb-1">Juego en progreso</p>
                                <h2 className="text-4xl font-display font-black tracking-tighter italic uppercase text-white">Elige rápido</h2>
                                {hasAnswered && (
                                    <div className="mt-4 inline-flex items-center gap-2 bg-success/20 text-success px-6 py-2 rounded-full font-display font-bold text-xs uppercase tracking-widest border border-success/30">
                                        <Sparkles size={14} /> Respuesta enviada
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 grid grid-cols-1 gap-4 pb-12">
                                {[
                                    { id: 'A', icon: '▲' },
                                    { id: 'B', icon: '◆' },
                                    { id: 'C', icon: '●' },
                                    { id: 'D', icon: '■' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => submitAnswer(opt.id)}
                                        disabled={hasAnswered}
                                        className={`option-card-premium option-${opt.id} rounded-3xl flex items-center justify-center relative transform active:scale-95 transition-all h-full min-h-[100px]
                                            ${hasAnswered ? 'opacity-20 grayscale' : 'shadow-lg hover:brightness-110'}`}
                                    >
                                        <div className="text-[4rem] font-black opacity-30 absolute left-6 pointer-events-none text-white">{opt.icon}</div>
                                        <span className="text-6xl font-display font-black relative z-10 text-white drop-shadow-md">{opt.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(game?.status === 'results' || game?.status === 'finished') && (
                        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 transition-all duration-700 animate-in fade-in zoom-in-95 ${!hasAnswered ? 'bg-surface' : (currentQuestion?.correct_option === playerAnswer ? 'bg-success' : 'bg-danger')
                            }`}>
                            <div className="text-center space-y-8 animate-float w-full max-w-sm">
                                <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center mx-auto shadow-2xl border-4 border-white/30">
                                    {!hasAnswered ? (
                                        <Loader2 className="animate-spin text-white" size={60} />
                                    ) : (
                                        currentQuestion?.correct_option === playerAnswer
                                            ? <Sparkles size={60} className="text-white" />
                                            : <div className="text-white text-7xl font-black">×</div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-5xl font-display font-black tracking-tight text-white uppercase italic drop-shadow-lg leading-none">
                                        {!hasAnswered
                                            ? 'TIEMPO AGOTADO'
                                            : (currentQuestion?.correct_option === playerAnswer ? '¡CORRECTO!' : 'INCORRECTO')}
                                    </h2>
                                    <p className="text-white/80 font-display font-bold uppercase tracking-wider text-sm mt-4">
                                        {currentQuestion?.correct_option === playerAnswer
                                            ? '¡Excelente trabajo!'
                                            : 'Sigue intentándolo'}
                                    </p>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 w-full shadow-2xl">
                                    <p className="text-[10px] font-display font-black text-white/50 tracking-widest uppercase mb-1">Tu Puntaje</p>
                                    <p className="text-5xl font-display font-black text-white">{player?.score?.toLocaleString()}</p>
                                </div>

                                {game.status === 'finished' && (
                                    <button
                                        onClick={() => { localStorage.removeItem('kahoot_player'); window.location.reload(); }}
                                        className="w-full bg-white text-surface py-5 rounded-2xl font-display font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-transform"
                                    >
                                        NUEVA PARTIDA
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="h-16 flex items-center justify-center relative z-10 border-t border-white/5">
                    <p className="text-[8px] font-display font-black text-white/20 tracking-[0.5em] uppercase">
                        Jugador: {player?.nickname} | {game?.join_code}
                    </p>
                </footer>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col p-6 font-body text-on-surface relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[40%] bg-secondary/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
            </div>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-sm space-y-10">
                    <div className="w-full space-y-12">
                        <div className="text-center mb-16">
                            <h1 className="text-6xl font-display font-black tracking-tighter mb-4 text-white italic">
                                Luke<span className="text-primary">QUIZ</span>
                            </h1>
                            <p className="text-primary font-display font-bold tracking-[0.3em] text-[10px] uppercase opacity-80">
                                Interactividad en Vivo
                            </p>
                        </div>

                        <form onSubmit={handleJoin} className="flex flex-col">
                            <div className="space-y-10">
                                <div className="space-y-4">
                                    <label className="text-[11px] font-display font-black text-primary tracking-[0.4em] uppercase ml-1 flex items-center gap-2">
                                        <Key size={14} /> PIN del Juego
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/5 border-2 border-white/10 rounded-3xl p-6 text-white font-display font-black text-5xl text-center focus:border-primary/50 focus:bg-white/10 focus:outline-none transition-all uppercase tracking-[0.4em] placeholder:opacity-10 shadow-2xl"
                                        placeholder="000000"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        required
                                        maxLength={6}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[11px] font-display font-black text-secondary tracking-[0.4em] uppercase ml-1 flex items-center gap-2">
                                        <User size={14} /> Tu Apodo
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-6 text-white font-display font-bold text-2xl focus:border-secondary/50 focus:bg-white/10 focus:outline-none transition-all shadow-xl text-center"
                                        placeholder="Escribe aquí..."
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        required
                                        maxLength={12}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[11px] font-display font-black text-white/40 tracking-[0.4em] uppercase ml-1">Tu Avatar</label>
                                    <div className="grid grid-cols-5 gap-4">
                                        {EMOJIS.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setSelectedEmoji(emoji)}
                                                className={`text-4xl p-4 rounded-3xl border-2 transition-all transform active:scale-90 flex items-center justify-center ${selectedEmoji === emoji
                                                    ? 'bg-secondary/30 border-secondary scale-110 shadow-[0_0_30px_rgba(255,143,211,0.4)]'
                                                    : 'bg-white/5 border-white/5 hover:border-white/20'
                                                    }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Spacer to push button down */}
                            <div className="h-24 md:h-32" />

                            <button
                                type="submit"
                                className="w-full bg-primary py-7 rounded-[3rem] text-surface font-display font-black text-2xl tracking-[0.2em] transition-all hover:scale-[1.03] active:scale-95 shadow-[0_25px_50px_rgba(143,245,255,0.3)] flex items-center justify-center gap-4 group"
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <>
                                        <span>EMPEZAR</span>
                                        <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </main>

            <footer className="h-16 flex items-center justify-center relative z-10">
                <p className="text-[9px] font-display font-black text-white/10 tracking-[0.6em] uppercase italic">LukeQuiz v2.0 | Powered by Supabase</p>
            </footer>
        </div>
    )
}
