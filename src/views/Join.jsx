import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EMOJIS } from '../utils/helpers'
import { User, Key, CheckCircle2, Users } from 'lucide-react'

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
            setPlayer(p)
            setJoined(true)
            fetchGame(p.game_id)
        }
    }, [])

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

    const fetchGame = async (id) => {
        const { data } = await supabase.from('games').select('*').eq('id', id).single()
        if (data) setGame(data)
    }

    const fetchQuestion = async (quizId, index) => {
        const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizId).eq('order_index', index).single()
        if (data) setCurrentQuestion(data)
    }

    const handleJoin = async (e) => {
        e.preventDefault()
        setLoading(true)

        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .select('id, status, quiz_id, current_question_index')
            .eq('join_code', code.toUpperCase())
            .single()

        if (gameError || !gameData) {
            alert('¡Código de juego no válido!')
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
            alert('Error al unirse al juego')
            setLoading(false)
            return
        }

        setPlayer(newPlayer)
        setGame(gameData)
        setJoined(true)
        setLoading(false)
        localStorage.setItem('kahoot_player', JSON.stringify(newPlayer))
    }

    const submitAnswer = async (option) => {
        if (hasAnswered || game?.status !== 'question') return

        setHasAnswered(true)
        const { error } = await supabase
            .from('answers')
            .insert({
                player_id: player.id,
                question_id: currentQuestion.id,
                selected_option: option
            })

        if (error) {
            alert('Error enviando respuesta')
            setHasAnswered(false)
        }
    }

    if (joined) {
        return (
            <div className="container flex flex-col items-center justify-center min-h-screen animate-fade p-4">
                {(!game || game.status === 'waiting') && (
                    <div className="glass-card text-center max-w-sm w-full">
                        <div className="text-6xl mb-4">{player?.emoji}</div>
                        <h2 className="text-3xl font-bold mb-2">¡Hola, {player?.nickname}!</h2>
                        <p className="text-gray-400">Espera a que el host inicie...</p>
                        <div className="mt-8 flex justify-center animate-pulse">
                            <Users size={48} className="text-primary" />
                        </div>
                    </div>
                )}

                {game?.status === 'question' && (
                    <div className="w-full max-w-sm space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold uppercase tracking-tighter">¡Responde Ahora!</h2>
                            {hasAnswered && <p className="text-success font-bold mt-2 flex items-center justify-center gap-2"><CheckCircle2 /> ¡Ok!</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4 h-[60vh]">
                            {['A', 'B', 'C', 'D'].map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => submitAnswer(opt)}
                                    disabled={hasAnswered}
                                    className={`option-card option-${opt} text-5xl font-black ${hasAnswered ? 'opacity-30 grayscale' : ''}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {(game?.status === 'results' || game?.status === 'finished') && (
                    <div className="glass-card text-center w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4">¡Ronda terminada!</h2>
                        <div className="text-6xl mb-4">🎯</div>
                        <p className="text-gray-400">Mira el ranking en la pantalla.</p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="container flex flex-col items-center justify-center min-h-screen animate-fade">
            <div className="glass-card w-full max-w-md">
                <h1 className="text-4xl font-extrabold text-center mb-8 italic">
                    LUKE<span className="text-primary font-normal">QUIZ</span>
                </h1>

                <form onSubmit={handleJoin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                            <Key size={16} /> PIN DEL JUEGO
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="ABC123"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                            <User size={16} /> TU NOMBRE
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            required
                            maxLength={12}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-400">ELIGE EMOJI</label>
                        <div className="grid grid-cols-5 gap-2">
                            {EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setSelectedEmoji(emoji)}
                                    className={`text-2xl p-2 rounded-lg border transition-all ${selectedEmoji === emoji
                                            ? 'bg-primary border-primary'
                                            : 'bg-glass border-transparent'
                                        }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary w-full py-4 text-xl mt-4"
                        disabled={loading}
                    >
                        {loading ? 'Entrando...' : '¡A JUGAR!'}
                    </button>
                </form>
            </div>
        </div>
    )
}
