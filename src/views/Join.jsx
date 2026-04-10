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

        if (playerExists && playerExists.games.status !== 'finished') {
            setPlayer(playerExists)
            setGame(playerExists.games)
            setJoined(true)
            if (playerExists.games.status === 'question') {
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
                            setHasAnswered(false)
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
            const { data: answered } = await supabase.from('answers').select('id').eq('player_id', player.id).eq('question_id', data.id).single()
            if (answered) setHasAnswered(true)
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
                {/* Mobile Atmosphere */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                    <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[30%] bg-primary rounded-full blur-[80px]" />
                </div>

                <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
                    {(!game || game.status === 'waiting') && (
                        <div className="w-full max-sm px-4">
                            <div className="glass p-12 rounded-[3rem] text-center neon-glow-secondary">
                                <div className="text-[7rem] mb-8 animate-float drop-shadow-2xl">{player?.emoji}</div>
                                <h2 className="text-4xl font-display font-black tracking-tight mb-2 uppercase italic">{player?.nickname}</h2>
                                <div className="h-[2px] w-12 bg-secondary mx-auto mb-6" />
                                <p className="text-on-surface-variant font-medium leading-relaxed">
                                    Esperando a que el anfitrión inicie... <br />
                                    Prepárate para jugar.
                                </p>
                                <div className="mt-12 flex justify-center">
                                    <div className="animate-pulse-slow">
                                        <Users size={32} className="text-secondary opacity-50" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {game?.status === 'question' && (
                        <div className="w-full h-full flex flex-col">
                            <div className="text-center mb-10 mt-4">
                                <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] uppercase mb-1">Juego en progreso</p>
                                <h2 className="text-4xl font-display font-black tracking-tighter italic uppercase">Selecciona una respuesta</h2>
                                {hasAnswered && (
                                    <div className="mt-4 inline-flex items-center gap-2 bg-primary/20 text-primary px-6 py-2 rounded-full font-display font-bold text-xs uppercase tracking-widest animate-fade">
                                        <Sparkles size={14} /> Respuesta enviada
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 grid grid-cols-1 gap-4 pb-8">
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
                                        className={`option-card-premium option-${opt.id} rounded-3xl flex items-center justify-center relative transform active:scale-[0.98] transition-all
                                            ${hasAnswered ? 'opacity-20 grayscale' : 'neon-glow-' + (opt.id === 'A' || opt.id === 'B' ? 'primary' : 'secondary')}`}
                                    >
                                        <div className="text-[5rem] font-black opacity-40 absolute left-8 pointer-events-none">{opt.icon}</div>
                                        <span className={`text-7xl font-display font-black relative z-10 ${opt.id === 'C' ? 'text-surface' : 'text-on-surface'}`}>{opt.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(game?.status === 'results' || game?.status === 'finished') && (
                        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 transition-all duration-700 animate-in fade-in zoom-in-95 ${!hasAnswered ? 'bg-surface' : (currentQuestion?.correct_option === playerAnswer ? 'bg-success' : 'bg-danger')
                            }`}>
                            <div className="text-center space-y-8 animate-float">
                                <div className="w-40 h-40 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center mx-auto shadow-2xl border-4 border-white/30">
                                    {!hasAnswered ? (
                                        <Loader2 className="animate-spin text-white" size={80} />
                                    ) : (
                                        currentQuestion?.correct_option === playerAnswer
                                            ? <Sparkles size={80} className="text-white animate-bounce" />
                                            : <div className="text-white text-8xl font-black">×</div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-6xl font-display font-black tracking-tight text-white uppercase italic drop-shadow-lg">
                                        {!hasAnswered
                                            ? 'TIEMPO AGOTADO'
                                            : (currentQuestion?.correct_option === playerAnswer ? '¡CORRECTO!' : 'INCORRECTO')}
                                    </h2>
                                    <p className="text-white font-display font-bold uppercase tracking-[0.2em] text-lg bg-black/20 py-2 px-4 rounded-xl inline-block mt-2">
                                        {currentQuestion?.correct_option === playerAnswer
                                            ? '¡Excelente trabajo!'
                                            : `Respuesta Correcta: ${currentQuestion[`option_${currentQuestion.correct_option.toLowerCase()}`]}`}
                                    </p>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 inline-block min-w-[200px] shadow-2xl">
                                    <p className="text-[10px] font-display font-black text-white/60 tracking-widest uppercase mb-1">Tu Puntaje Actual</p>
                                    <p className="text-5xl font-display font-black text-white">{player?.score?.toLocaleString()}</p>
                                </div>

                                {game.status === 'finished' && (
                                    <button
                                        onClick={() => { localStorage.removeItem('kahoot_player'); window.location.reload(); }}
                                        className="mt-8 bg-white text-surface px-12 py-5 rounded-2xl font-display font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-transform"
                                    >
                                        NUEVA PARTIDA
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="h-16 flex items-center justify-center">
                    <p className="text-[10px] font-display font-black text-on-surface-variant/20 tracking-[0.5em] uppercase">Jugador Conectado | ID-{player?.id?.slice(0, 4)}</p>
                </footer>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col p-6 font-body text-on-surface selection:bg-primary/30 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[40%] bg-secondary rounded-full blur-[100px] opacity-10" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[40%] bg-primary rounded-full blur-[100px] opacity-10" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 pointer-events-none" />
            </div>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-sm space-y-12">
                    <header className="text-center">
                        <div className="inline-flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-display font-black tracking-[0.4em] text-on-surface-variant uppercase">Unirse al Juego</span>
                        </div>
                        <h1 className="text-[5rem] font-display font-black italic tracking-tighter leading-none mb-1">
                            LUKE<span className="text-primary">QUIZ</span>
                        </h1>
                    </header>

                    <form onSubmit={handleJoin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.3em] uppercase ml-1 flex items-center gap-2">
                                <Key size={12} className="text-primary" /> Código del Juego
                            </label>
                            <input
                                type="text"
                                className="w-full bg-surface-container border-2 border-white/5 rounded-3xl p-6 text-on-surface font-display font-black text-4xl text-center focus:border-primary focus:outline-none transition-all uppercase tracking-[0.3em] neon-glow-primary placeholder:opacity-20"
                                placeholder="000000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.3em] uppercase ml-1 flex items-center gap-2">
                                <User size={12} className="text-secondary" /> Apodo
                            </label>
                            <input
                                type="text"
                                className="w-full bg-surface-container border-2 border-white/5 rounded-2xl p-5 text-on-surface font-display font-bold text-xl focus:border-secondary transition-all"
                                placeholder="..."
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                required
                                maxLength={12}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.3em] uppercase ml-1">Elige tu Avatar</label>
                            <div className="grid grid-cols-5 gap-3">
                                {EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setSelectedEmoji(emoji)}
                                        className={`text-3xl p-3 rounded-2xl border-2 transition-all transform active:scale-95 flex items-center justify-center ${selectedEmoji === emoji
                                            ? 'bg-secondary/20 border-secondary neon-glow-secondary scale-110'
                                            : 'bg-surface-container border-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-primary py-6 rounded-3xl text-surface font-display font-black text-2xl tracking-widest mt-8 transition-transform hover:scale-[1.02] active:scale-95 neon-glow-primary flex items-center justify-center gap-3 overflow-hidden group"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <>
                                    <span>ENTRAR AL JUEGO</span>
                                    <Send size={24} className="group-hover:translate-x-2 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </main>

            <footer className="h-16 flex items-center justify-center relative z-10">
                <p className="text-[10px] font-display font-black text-on-surface-variant/30 tracking-[0.5em] uppercase italic">Conectado en tiempo real</p>
            </footer>
        </div>
    )
}
