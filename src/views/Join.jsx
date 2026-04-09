import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EMOJIS } from '../utils/helpers'
import { User, Key, CheckCircle2, Users, Loader2 } from 'lucide-react'
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
                    payload => {
                        setGame(payload.new)
                        if (payload.new.status === 'question') {
                            setHasAnswered(false)
                            fetchQuestion(payload.new.quiz_id, payload.new.current_question_index)
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
            // Check if already answered this question
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
            toast.error('¡Código de juego no válido!')
            setLoading(false)
            return
        }

        if (gameData.status === 'finished') {
            toast.error('Este juego ya ha terminado')
            setLoading(false)
            return
        }

        const { data: newPlayer, error: playerError } = await supabase
            .from('players')
            .insert({
                game_id: gameData.id,
                nickname,
                emoji: selectedEmoji,
                score: 0
            })
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
        toast.success('¡Te has unido!')
    }

    const submitAnswer = async (option) => {
        if (hasAnswered || game?.status !== 'question' || !currentQuestion) return

        setHasAnswered(true)
        const { error } = await supabase
            .from('answers')
            .insert({
                player_id: player.id,
                question_id: currentQuestion.id,
                selected_option: option
            })

        if (error) {
            toast.error('Error enviando respuesta')
            setHasAnswered(false)
        } else {
            toast.success('Respuesta enviada')
        }
    }

    if (loading && !joined) {
        return (
            <div className="container flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        )
    }

    if (joined) {
        return (
            <div className="container flex flex-col items-center justify-center min-h-screen animate-fade p-4 font-main">
                {(!game || game.status === 'waiting') && (
                    <div className="glass-card text-center max-w-sm w-full p-8 border-primary/20">
                        <div className="text-8xl mb-6 transform hover:scale-110 transition-transform cursor-default">{player?.emoji}</div>
                        <h2 className="text-3xl font-black mb-2">¡Hola, {player?.nickname}!</h2>
                        <p className="text-gray-400 text-lg">Prepárate... el host está por iniciar.</p>
                        <div className="mt-10 flex justify-center">
                            <div className="animate-bounce bg-primary/10 p-4 rounded-full">
                                <Users size={40} className="text-primary" />
                            </div>
                        </div>
                    </div>
                )}

                {game?.status === 'question' && (
                    <div className="w-full max-w-md space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-4xl font-black uppercase tracking-tighter italic">¡VOTA YA!</h2>
                            {hasAnswered && (
                                <div className="mt-4 bg-success/10 text-success py-2 px-4 rounded-full inline-flex items-center gap-2 font-bold animate-bounce">
                                    <CheckCircle2 size={20} /> RESPUESTA REGISTRADA
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 h-[65vh]">
                            {['A', 'B', 'C', 'D'].map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => submitAnswer(opt)}
                                    disabled={hasAnswered}
                                    className={`option-card option-${opt} text-6xl font-black shadow-xl relative overflow-hidden active:scale-95 ${hasAnswered ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:brightness-110'}`}
                                >
                                    <span className="relative z-10">{opt}</span>
                                    {hasAnswered && opt === player?.last_answer && <div className="absolute inset-0 bg-white/20" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {(game?.status === 'results' || game?.status === 'finished') && (
                    <div className="glass-card text-center w-full max-w-sm p-10 border-white/10">
                        <div className="text-8xl mb-8 animate-pulse">📊</div>
                        <h2 className="text-3xl font-black mb-4">Ronda Terminada</h2>
                        <p className="text-gray-400 text-lg leading-relaxed">Mira la pantalla principal para ver los resultados y el ranking.</p>
                        {game.status === 'finished' && (
                            <button
                                onClick={() => { localStorage.removeItem('kahoot_player'); window.location.reload(); }}
                                className="mt-8 text-primary font-bold hover:underline"
                            >
                                Salir del juego
                            </button>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="container flex flex-col items-center justify-center min-h-screen animate-fade p-4 font-main">
            <div className="glass-card w-full max-w-md p-10 shadow-2xl border-white/5">
                <h1 className="text-5xl font-black text-center mb-10 italic tracking-tighter">
                    LUKE<span className="text-primary font-normal">QUIZ</span>
                </h1>

                <form onSubmit={handleJoin} className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-400 flex items-center gap-2 tracking-widest uppercase">
                            <Key size={16} className="text-primary" /> PIN DEL JUEGO
                        </label>
                        <input
                            type="text"
                            className="input-field text-2xl font-black text-center tracking-widest py-5"
                            placeholder="ABC123"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-400 flex items-center gap-2 tracking-widest uppercase">
                            <User size={16} className="text-primary" /> TU NOMBRE
                        </label>
                        <input
                            type="text"
                            className="input-field text-xl font-bold py-4"
                            placeholder="Ej: Jugador Pro"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            required
                            maxLength={12}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-400 tracking-widest uppercase">ELIGE TU AVATAR</label>
                        <div className="grid grid-cols-5 gap-3">
                            {EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setSelectedEmoji(emoji)}
                                    className={`text-3xl p-3 rounded-2xl border-2 transition-all transform hover:scale-110 ${selectedEmoji === emoji
                                        ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(108,92,231,0.3)] scale-110'
                                        : 'bg-white/5 border-transparent hover:border-white/20'
                                        }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary w-full py-5 text-2xl font-black mt-4 shadow-xl active:translate-y-1 transition-all"
                        disabled={loading}
                    >
                        {loading ? 'Entrando...' : '¡A JUGAR!'}
                    </button>
                </form>
            </div>
        </div>
    )
}
