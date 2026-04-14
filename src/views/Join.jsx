import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EMOJIS } from '../utils/helpers'
import { User, Key, CheckCircle2, Users, Loader2, Sparkles, Trophy, Send } from 'lucide-react'
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
    const [winnerId, setWinnerId] = useState(null)
    const [exitCountdown, setExitCountdown] = useState(null)
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

                            if (payload.new.status === 'finished') {
                                // Fetch all players to find winner
                                const { data: allPlayers } = await supabase
                                    .from('players')
                                    .select('id, score')
                                    .eq('game_id', player.game_id)
                                    .order('score', { ascending: false })
                                    .limit(1)

                                if (allPlayers && allPlayers.length > 0) {
                                    const top = allPlayers[0]
                                    setWinnerId(top.id)
                                    // Start exit countdown
                                    setExitCountdown(top.id === player.id ? 15 : 10)
                                }
                            }
                        }
                    }
                )
                .subscribe()

            return () => channel.unsubscribe()
        }
    }, [joined, player])

    useEffect(() => {
        if (exitCountdown === null) return
        if (exitCountdown <= 0) {
            localStorage.removeItem('kahoot_player')
            window.location.reload()
            return
        }
        const timer = setInterval(() => setExitCountdown(prev => prev - 1), 1000)
        return () => clearInterval(timer)
    }, [exitCountdown])

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
            <div className="h-[100dvh] w-screen bg-background flex flex-col p-[4vh] font-body text-on-surface relative overflow-hidden v-grid">
                {/* Atmosphere */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5">
                    <div className="absolute top-[10%] left-[-5%] w-[40vw] h-[40vw] bg-primary rounded-full blur-[10vh]" />
                    <div className="absolute bottom-[10%] right-[-5%] w-[40vw] h-[40vw] bg-secondary rounded-full blur-[10vh]" />
                </div>

                <div className="relative z-10 flex-1 flex flex-col max-w-lg mx-auto w-full pt-[4vh]">
                    {(!game || game.status === 'waiting') && (
                        <div className="flex-1 flex flex-col items-center justify-center pb-[5vh]">
                            <div className="glass p-[5vh] rounded-[3vh] border border-white/10 text-center relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-secondary scan-line opacity-50" />
                                <div className="text-[15vh] mb-[4vh] animate-float drop-shadow-[0_0_3vh_rgba(6,182,212,0.3)]">{player?.emoji}</div>

                                <p className="text-[1.2vh] font-display font-black text-secondary tracking-[0.4em] uppercase mb-[1vh] opacity-50">JUGADOR_CONECTADO</p>
                                <h2 className="text-[5vh] font-display font-black tracking-tighter mb-[4vh] uppercase text-white truncate">{player?.nickname}</h2>

                                <div className="bg-surface-lowest/50 border border-white/5 p-[3vh] rounded-[2vh] mb-[4vh]">
                                    <p className="text-on-surface-variant font-display font-bold uppercase tracking-[0.2em] text-[1.2vh] animate-pulse">
                                        Estado: Esperando al anfitrión...
                                    </p>
                                </div>
                                <div className="text-[1vh] font-mono text-white/20 uppercase tracking-widest">
                                    PLAYER_ID: {player?.id.split('-')[0]}
                                </div>
                            </div>
                        </div>
                    )}

                    {game?.status === 'question' && (
                        <div className="flex-1 flex flex-col pt-[2vh]">
                            <div className="mb-[4vh]">
                                <p className="text-[1.2vh] font-display font-black text-primary tracking-[0.5em] uppercase mb-[0.5vh]">Estado: JUGANDO</p>
                                <h2 className="text-[5vh] font-display font-black tracking-tighter uppercase text-white leading-none">Tu Respuesta</h2>
                                {hasAnswered && (
                                    <div className="mt-[2vh] inline-flex items-center gap-[1vh] bg-success/10 text-success px-[3vh] py-[1vh] rounded-[0.5vh] font-display font-black text-[1.2vh] uppercase tracking-widest border border-success/20 animate-fade">
                                        <CheckCircle2 size={12} /> Respuesta enviada con éxito
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 grid grid-cols-1 gap-[2vh] pb-[4vh]">
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
                                        className={`relative h-full min-h-[12vh] rounded-[2vh] flex items-center justify-between px-[5vh] transition-all duration-300 border-2 overflow-hidden
                                            ${opt.color} ${hasAnswered
                                                ? (playerAnswer === opt.id ? 'opacity-100 scale-100 border-white' : 'opacity-20 grayscale scale-95 border-transparent')
                                                : 'hover:scale-[1.02] active:scale-95 border-white/10'}`}
                                    >
                                        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity" />
                                        <span className="text-[8vh] font-display font-black text-white relative z-10">{opt.id}</span>
                                        <span className="text-[4vh] font-black text-white/30 relative z-10">{opt.icon}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(game?.status === 'results' || game?.status === 'finished') && (
                        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-[4vh] animate-fade transition-colors duration-1000 ${!hasAnswered ? 'bg-surface' : (currentQuestion?.correct_option === playerAnswer ? 'bg-success' : 'bg-destructive')}`}>
                            {/* Dynamic Glow for Result */}
                            <div className={`absolute inset-0 opacity-40 blur-[12vh] pointer-events-none transition-all duration-1000 ${currentQuestion?.correct_option === playerAnswer ? 'bg-success-bright' : 'bg-red-500'}`} />
                            <div className="v-grid absolute inset-0 opacity-20" />

                            <div className="text-center space-y-[6vh] w-full max-w-sm relative z-10">
                                {game.status === 'finished' ? (
                                    <div className="animate-in zoom-in duration-1000 text-center space-y-[4vh]">
                                        <div className="size-[25vh] rounded-full bg-black/40 backdrop-blur-3xl flex items-center justify-center mx-auto border-[0.5vh] border-white/20 shadow-[0_0_8vh_rgba(255,255,255,0.2)] relative">
                                            {winnerId === player.id ? (
                                                <Trophy size={100} className="text-primary animate-bounce w-[15vh] h-[15vh]" />
                                            ) : (
                                                <div className="text-white/60 text-center leading-tight">
                                                    <p className="text-[1.5vh] font-display font-black tracking-widest uppercase">Fin de</p>
                                                    <p className="text-[4vh] font-display font-black italic">Partida</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-[1vh]">
                                            <h2 className="text-[7vh] font-display font-black tracking-tighter text-white uppercase italic leading-none">
                                                {winnerId === player.id ? '¡CAMPEÓN!' : 'Finalizado'}
                                            </h2>
                                            <p className="text-[1.2vh] font-display font-black text-white/50 tracking-[0.5em] uppercase">
                                                {winnerId === player.id ? 'Has dominado el tablero' : 'Gracias por participar'}
                                            </p>
                                        </div>

                                        <div className="bg-black/30 backdrop-blur-md p-[5vh] rounded-[3vh] border border-white/10 w-full shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-[2px] bg-primary animate-scan z-0" />
                                            <p className="text-[1.2vh] font-display font-black text-white/40 tracking-[0.4em] uppercase mb-[1vh] relative z-10">Ranking Final</p>
                                            <p className="text-[10vh] font-display font-black text-white tabular-nums tracking-tighter relative z-10 leading-none">
                                                #{winnerId === player.id ? '1' : 'Podio'}
                                            </p>
                                            <p className="text-[3vh] font-display font-black text-primary uppercase mt-[2vh] opacity-80">{player?.score?.toLocaleString()} PTS</p>
                                        </div>

                                        <div className="pt-[2vh]">
                                            <p className="text-[1.2vh] font-display font-black text-white/40 tracking-[0.3em] uppercase animate-pulse">
                                                Saliendo en {exitCountdown}s...
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="size-[20vh] rounded-[3vh] bg-black/20 backdrop-blur-xl flex items-center justify-center mx-auto border-[0.2vh] border-white/20 shadow-2xl">
                                            {!hasAnswered ? (
                                                <Loader2 className="animate-spin text-white w-[8vh] h-[8vh]" />
                                            ) : (
                                                currentQuestion?.correct_option === playerAnswer
                                                    ? <Sparkles size={100} className="text-white w-[12vh] h-[12vh]" />
                                                    : <div className="text-white text-[15vh] font-display font-black leading-none">×</div>
                                            )}
                                        </div>

                                        <div className="space-y-[2vh]">
                                            <p className="text-[1.2vh] font-display font-black text-white/50 tracking-[0.5em] uppercase">RESULTADOS</p>
                                            <h2 className="text-[8vh] font-display font-black tracking-tighter text-white uppercase leading-none">
                                                {!hasAnswered
                                                    ? 'SIN DATOS'
                                                    : (currentQuestion?.correct_option === playerAnswer ? 'CORRECTO' : 'ERROR')}
                                            </h2>
                                            <div className="h-[0.5vh] w-[10vh] bg-white/30 mx-auto" />
                                        </div>

                                        <div className="bg-black/30 backdrop-blur-md p-[4vh] rounded-[3vh] border border-white/10 w-full shadow-2xl">
                                            <p className="text-[1.2vh] font-display font-black text-white/40 tracking-[0.4em] uppercase mb-[1vh]">Puntuación Actual</p>
                                            <p className="text-[8vh] font-display font-black text-white tabular-nums tracking-tighter leading-none">{player?.score?.toLocaleString()}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="h-[10vh] flex items-center justify-center relative z-10 border-t border-white/5 bg-surface-lowest/50">
                    <div className="flex items-center gap-[4vh] opacity-40">
                        <p className="text-[1.2vh] font-display font-black text-white tracking-[0.4em] uppercase">
                            USER: {player?.nickname}
                        </p>
                        <div className="w-[1px] h-[2vh] bg-white/20" />
                        <p className="text-[1.2vh] font-display font-black text-white tracking-[0.4em] uppercase">
                            LINK: {game?.join_code}
                        </p>
                    </div>
                </footer>
            </div>
        )
    }

    return (
        <div className="h-[100dvh] w-screen bg-background flex flex-col p-[4vh] font-body text-on-surface relative overflow-hidden v-grid">
            {/* Ambient Atmosphere */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] bg-primary rounded-full blur-[10vh]" />
                <div className="absolute bottom-[20%] right-[-10%] w-[50vw] h-[50vw] bg-secondary rounded-full blur-[10vh]" />
            </div>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-[2vh]">
                <div className="w-full max-w-sm space-y-[4vh]">
                    <div className="text-center space-y-[1vh]">
                        <h1 className="text-[6vh] font-display font-black tracking-tighter text-white uppercase leading-none">
                            Acceso al <span className="text-primary">Juego</span>
                        </h1>
                        <p className="text-[1.1vh] font-display font-bold tracking-[0.4em] text-on-surface-variant uppercase opacity-40">
                            Ingresa el PIN para comenzar
                        </p>
                    </div>

                    <form onSubmit={handleJoin} className="space-y-[4vh]">
                        <div className="space-y-[2vh]">
                            <div className="space-y-[0.5vh]">
                                <label className="text-[1.1vh] font-display font-black text-primary tracking-[0.3em] uppercase ml-1 flex items-center gap-[1vh]">
                                    <Key size={14} className="opacity-50" /> PIN_DE_JUEGO
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-surface-lowest border-2 border-white/10 rounded-[2vh] p-[2vh] text-white font-display font-black text-[5vh] text-center focus:border-primary focus:bg-primary/5 focus:outline-none transition-all uppercase tracking-[0.3em] placeholder:opacity-5"
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    required
                                    maxLength={6}
                                />
                            </div>

                            <div className="space-y-[0.5vh]">
                                <label className="text-[1.1vh] font-display font-black text-secondary tracking-[0.3em] uppercase ml-1 flex items-center gap-[1vh]">
                                    <User size={14} className="opacity-50" /> APODO_JUGADOR
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-surface-lowest border-2 border-white/10 rounded-[2vh] p-[1.5vh] text-white font-display font-black text-[2.5vh] focus:border-secondary focus:bg-secondary/5 focus:outline-none transition-all text-center uppercase tracking-widest"
                                    placeholder="Tu apodo..."
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    required
                                    maxLength={12}
                                />
                            </div>

                            <div className="space-y-[1vh]">
                                <label className="text-[1.1vh] font-display font-black text-white/30 tracking-[0.3em] uppercase ml-1">Selecciona tu Avatar</label>
                                <div className="grid grid-cols-5 gap-[1vh]">
                                    {EMOJIS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setSelectedEmoji(emoji)}
                                            className={`text-[2.5vh] p-[1vh] rounded-[1vh] border-2 transition-all transform active:scale-90 flex items-center justify-center ${selectedEmoji === emoji
                                                ? 'bg-primary/20 border-primary scale-105 shadow-[0_0_2vh_rgba(236,72,153,0.2)]'
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
                            className="w-full bg-primary py-[2.5vh] rounded-[1vh] text-background font-display font-black text-[2vh] tracking-[0.5rem] transition-all hover:bg-primary/90 active:scale-[0.98] flex items-center justify-center gap-[2vh] group overflow-hidden relative"
                            disabled={loading}
                        >
                            <div className="absolute inset-0 scan-line opacity-20 pointer-events-none" />
                            {loading ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <span className="relative z-10 transition-transform group-hover:scale-110">ENTRAR AL JUEGO</span>
                            )}
                        </button>
                    </form>
                </div>
            </main>

            <footer className="h-[8vh] flex items-center justify-center relative z-10 border-t border-white/5 opacity-30">
                <p className="text-[1vh] font-display font-black tracking-[0.6em] uppercase">Control Maestro // Acceso</p>
            </footer>
        </div>
    )
}
