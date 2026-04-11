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
            <div className="min-h-screen bg-background flex flex-col p-6 font-body text-on-surface relative overflow-hidden v-grid">
                {/* Atmosphere */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5">
                    <div className="absolute top-[10%] left-[-5%] w-[40%] h-[40%] bg-primary rounded-full blur-[100px]" />
                    <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-secondary rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 flex-1 flex flex-col max-w-lg mx-auto w-full pt-12">
                    {(!game || game.status === 'waiting') && (
                        <div className="flex-1 flex flex-col items-center justify-center pb-20">
                            <div className="glass p-12 rounded-sm border border-white/10 text-center relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-secondary scan-line opacity-50" />
                                <div className="text-[7rem] mb-8 animate-float drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]">{player?.emoji}</div>

                                <p className="text-[10px] font-display font-black text-secondary tracking-[0.4em] uppercase mb-2 opacity-50">USUARIO_AUTORIZADO</p>
                                <h2 className="text-5xl font-display font-black tracking-tighter mb-8 uppercase text-white truncate">{player?.nickname}</h2>

                                <div className="bg-surface-lowest/50 border border-white/5 p-6 rounded-sm mb-6">
                                    <p className="text-on-surface-variant font-display font-bold uppercase tracking-[0.2em] text-[10px] animate-pulse">
                                        Estado: En espera de protocolo de inicio...
                                    </p>
                                </div>
                                <div className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
                                    ID_CONEXION: {player?.id.split('-')[0]}
                                </div>
                            </div>
                        </div>
                    )}

                    {game?.status === 'question' && (
                        <div className="flex-1 flex flex-col pt-6">
                            <div className="mb-12">
                                <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] uppercase mb-1">Estado: TRANSMISION_ACTIVA</p>
                                <h2 className="text-5xl font-display font-black tracking-tighter uppercase text-white">Consola de Respuesta</h2>
                                {hasAnswered && (
                                    <div className="mt-4 inline-flex items-center gap-2 bg-success/10 text-success px-6 py-2 rounded-sm font-display font-black text-[10px] uppercase tracking-widest border border-success/20 animate-fade">
                                        <CheckCircle2 size={12} /> Paquete de datos enviado
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 grid grid-cols-1 gap-6 pb-12">
                                {[
                                    { id: 'A', icon: 'A', color: 'option-A' },
                                    { id: 'B', icon: 'B', color: 'option-B' },
                                    { id: 'C', icon: 'C', color: 'option-C' },
                                    { id: 'D', icon: 'D', color: 'option-D' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => submitAnswer(opt.id)}
                                        disabled={hasAnswered}
                                        className={`relative h-full min-h-[120px] rounded-sm flex items-center justify-between px-10 transition-all duration-300 border-2 overflow-hidden
                                            ${opt.color} ${hasAnswered
                                                ? (playerAnswer === opt.id ? 'opacity-100 scale-100 border-white' : 'opacity-20 grayscale scale-95 border-transparent')
                                                : 'hover:scale-[1.02] active:scale-95 border-white/10'}`}
                                    >
                                        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity" />
                                        <span className="text-7xl font-display font-black text-white relative z-10">{opt.id}</span>
                                        <span className="text-4xl font-black text-white/30 relative z-10">{opt.icon}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(game?.status === 'results' || game?.status === 'finished') && (
                        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 animate-fade ${!hasAnswered ? 'bg-surface' : (currentQuestion?.correct_option === playerAnswer ? 'bg-success' : 'bg-red-600')}`}>
                            <div className="v-grid absolute inset-0 opacity-20" />
                            <div className="text-center space-y-10 w-full max-w-sm relative z-10">
                                <div className="w-40 h-40 rounded-sm bg-black/20 backdrop-blur-xl flex items-center justify-center mx-auto border-2 border-white/20 shadow-2xl">
                                    {!hasAnswered ? (
                                        <Loader2 className="animate-spin text-white" size={64} />
                                    ) : (
                                        currentQuestion?.correct_option === playerAnswer
                                            ? <Sparkles size={80} className="text-white" />
                                            : <div className="text-white text-[10rem] font-display font-black leading-none">×</div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-display font-black text-white/50 tracking-[0.5em] uppercase">VALIDACION_RESULTADOS</p>
                                    <h2 className="text-6xl font-display font-black tracking-tighter text-white uppercase leading-none">
                                        {!hasAnswered
                                            ? 'SIN DATOS'
                                            : (currentQuestion?.correct_option === playerAnswer ? 'CORRECTO' : 'ERROR')}
                                    </h2>
                                    <div className="h-1 w-20 bg-white/30 mx-auto" />
                                </div>

                                <div className="bg-black/30 backdrop-blur-md p-10 rounded-sm border border-white/10 w-full shadow-2xl">
                                    <p className="text-[10px] font-display font-black text-white/40 tracking-[0.4em] uppercase mb-2">Puntuación Total</p>
                                    <p className="text-6xl font-display font-black text-white tabular-nums tracking-tighter">{player?.score?.toLocaleString()}</p>
                                </div>

                                {game.status === 'finished' && (
                                    <button
                                        onClick={() => { localStorage.removeItem('kahoot_player'); window.location.reload(); }}
                                        className="w-full bg-white text-background py-6 rounded-sm font-display font-black text-sm uppercase tracking-[0.3em] hover:bg-on-surface transition-colors active:scale-95"
                                    >
                                        REINICIAR SISTEMA
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="h-20 flex items-center justify-center relative z-10 border-t border-white/5 bg-surface-lowest/50">
                    <div className="flex items-center gap-8 opacity-40">
                        <p className="text-[9px] font-display font-black text-white tracking-[0.4em] uppercase">
                            USER: {player?.nickname}
                        </p>
                        <div className="w-[1px] h-3 bg-white/20" />
                        <p className="text-[9px] font-display font-black text-white tracking-[0.4em] uppercase">
                            LINK: {game?.join_code}
                        </p>
                    </div>
                </footer>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex flex-col p-6 font-body text-on-surface relative overflow-hidden v-grid">
            {/* Ambient Atmosphere */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-primary rounded-full blur-[120px]" />
                <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-secondary rounded-full blur-[120px]" />
            </div>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-12">
                <div className="w-full max-w-sm space-y-16">
                    <div className="text-center space-y-4">
                        <div className="inline-block glass px-4 py-1 rounded-sm border border-primary/20 mb-4">
                            <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] uppercase">LukeQUIZ_Control_SY</p>
                        </div>
                        <h1 className="text-7xl font-display font-black tracking-tighter text-white uppercase leading-none">
                            Luke<span className="text-primary">QUIZ</span>
                        </h1>
                        <p className="text-[9px] font-display font-bold tracking-[0.4em] text-on-surface-variant uppercase opacity-40">
                            Protocolo de Acceso a Trivia
                        </p>
                    </div>

                    <form onSubmit={handleJoin} className="space-y-12">
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-display font-black text-primary tracking-[0.3em] uppercase ml-1 flex items-center gap-3">
                                    <Key size={14} className="opacity-50" /> PIN_DE_JUEGO
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-surface-lowest border-2 border-white/10 rounded-sm p-8 text-white font-display font-black text-6xl text-center focus:border-primary focus:bg-primary/5 focus:outline-none transition-all uppercase tracking-[0.3em] placeholder:opacity-5"
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    required
                                    maxLength={6}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-display font-black text-secondary tracking-[0.3em] uppercase ml-1 flex items-center gap-3">
                                    <User size={14} className="opacity-50" /> APODO_JUGADOR
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-surface-lowest border-2 border-white/10 rounded-sm p-6 text-white font-display font-black text-2xl focus:border-secondary focus:bg-secondary/5 focus:outline-none transition-all text-center uppercase tracking-widest"
                                    placeholder="Identificador..."
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    required
                                    maxLength={12}
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-display font-black text-white/30 tracking-[0.3em] uppercase ml-1">Avatar_Designator</label>
                                <div className="grid grid-cols-5 gap-3">
                                    {EMOJIS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setSelectedEmoji(emoji)}
                                            className={`text-3xl p-4 rounded-sm border-2 transition-all transform active:scale-90 flex items-center justify-center ${selectedEmoji === emoji
                                                ? 'bg-primary/20 border-primary scale-105 shadow-[0_0_20px_rgba(236,72,153,0.2)]'
                                                : 'bg-surface-lowest border-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-primary py-7 rounded-sm text-background font-display font-black text-xl tracking-[0.5rem] transition-all hover:bg-primary/90 active:scale-[0.98] flex items-center justify-center gap-6 group overflow-hidden relative"
                            disabled={loading}
                        >
                            <div className="absolute inset-0 scan-line opacity-20 pointer-events-none" />
                            {loading ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <span className="relative z-10">INICIAR_SESION</span>
                            )}
                        </button>
                    </form>
                </div>
            </main>

            <footer className="h-20 flex items-center justify-center relative z-10 border-t border-white/5 opacity-30">
                <p className="text-[9px] font-display font-black tracking-[0.6em] uppercase">LukeQuiz 3.0 // System_Access_Point</p>
            </footer>
        </div>
    )
}
