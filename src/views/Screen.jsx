import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Timer, Trophy } from 'lucide-react'
import confetti from 'canvas-confetti'

export default function Screen() {
    const { gameId } = useParams()
    const [game, setGame] = useState(null)
    const [quiz, setQuiz] = useState(null)
    const [players, setPlayers] = useState([])
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const [answers, setAnswers] = useState([])
    const [timeLeft, setTimeLeft] = useState(0)

    useEffect(() => {
        fetchGameData()

        // Subscriptions
        const gameSub = supabase
            .channel('game_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                payload => {
                    setGame(payload.new)
                }
            )
            .subscribe()

        const playerSub = supabase
            .channel('player_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
                payload => {
                    setPlayers(prev => [...prev, payload.new])
                }
            )
            .subscribe()

        const answerSub = supabase
            .channel('answer_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' },
                payload => {
                    setAnswers(prev => [...prev, payload.new])
                }
            )
            .subscribe()

        return () => {
            gameSub.unsubscribe()
            playerSub.unsubscribe()
            answerSub.unsubscribe()
        }
    }, [gameId])

    useEffect(() => {
        if (game?.status === 'question') {
            fetchQuestion(game.current_question_index)
            setAnswers([])
        } else if (game?.status === 'finished') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            })
        }
    }, [game?.status, game?.current_question_index])

    const fetchGameData = async () => {
        const { data: g } = await supabase.from('games').select('*, quizzes(*)').eq('id', gameId).single()
        if (g) {
            setGame(g)
            setQuiz(g.quizzes)
            fetchPlayers()
        }
    }

    const fetchPlayers = async () => {
        const { data: p } = await supabase.from('players').select('*').eq('game_id', gameId).order('score', { ascending: false })
        if (p) setPlayers(p)
    }

    const fetchQuestion = async (index) => {
        const { data: qs } = await supabase
            .from('questions')
            .select('*')
            .eq('quiz_id', game.quiz_id)
            .eq('order_index', index)
            .single()

        if (qs) {
            setCurrentQuestion(qs)
            setTimeLeft(qs.time_limit)
        }
    }

    // Timer logic
    useEffect(() => {
        if (game?.status === 'question' && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
            return () => clearInterval(timer)
        }
    }, [game?.status, timeLeft])

    const joinUrl = `${window.location.origin}/join?code=${game?.join_code}`

    return (
        <div className="min-h-screen bg-darker p-8 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
                <h1 className="text-3xl font-black italic tracking-tighter">
                    LUKE<span className="text-primary font-normal">QUIZ</span>
                </h1>
                <div className="flex gap-4">
                    <div className="glass-card py-2 px-4 rounded-full flex items-center gap-2">
                        <Users size={20} className="text-primary" />
                        <span className="font-bold">{players.length}</span>
                    </div>
                    {game?.join_code && (
                        <div className="bg-primary px-6 py-2 rounded-full font-bold shadow-lg">
                            PIN: {game.join_code}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center">

                {game?.status === 'waiting' && (
                    <div className="animate-fade text-center">
                        <div className="flex gap-12 items-center justify-center mb-12">
                            <div className="bg-white p-4 rounded-3xl shadow-2xl">
                                <QRCodeSVG value={joinUrl} size={250} />
                            </div>
                            <div className="text-left max-w-md">
                                <h2 className="text-5xl font-extrabold mb-4">¡Únete ahora!</h2>
                                <p className="text-xl text-gray-400 mb-6">Escanea el código o entra a <span className="text-white font-bold">{window.location.origin}/join</span> y usa el PIN.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
                            {players.map(p => (
                                <div key={p.id} className="player-bubble text-xl">
                                    <span>{p.emoji}</span>
                                    <span>{p.nickname}</span>
                                </div>
                            ))}
                            {players.length === 0 && (
                                <p className="text-gray-500 italic">Esperando jugadores...</p>
                            )}
                        </div>
                    </div>
                )}

                {game?.status === 'question' && currentQuestion && (
                    <div className="w-full max-w-6xl animate-fade">
                        <div className="text-center mb-12">
                            <h2 className="text-5xl font-bold leading-tight mb-8">{currentQuestion.text}</h2>
                            <div className="relative inline-block">
                                <div className="w-24 h-24 rounded-full border-8 border-primary flex items-center justify-center text-3xl font-black">
                                    {timeLeft}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="option-card option-A">{currentQuestion.option_a}</div>
                            <div className="option-card option-B">{currentQuestion.option_b}</div>
                            <div className="option-card option-C">{currentQuestion.option_c}</div>
                            <div className="option-card option-D">{currentQuestion.option_d}</div>
                        </div>

                        <div className="mt-8 text-center text-2xl font-bold">
                            Respuestas: {answers.length} / {players.length}
                        </div>
                    </div>
                )}

                {game?.status === 'results' && (
                    <div className="w-full max-w-4xl animate-fade text-center">
                        <h2 className="text-4xl font-bold mb-12">Puntajes de esta ronda</h2>
                        <div className="space-y-4">
                            {players.slice(0, 5).map((p, idx) => (
                                <div key={p.id} className="glass-card flex justify-between items-center py-4 px-8">
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl font-black text-gray-500">#{idx + 1}</span>
                                        <span className="text-3xl">{p.emoji}</span>
                                        <span className="text-2xl font-bold">{p.nickname}</span>
                                    </div>
                                    <span className="text-2xl font-black text-primary">{p.score} ptos</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {game?.status === 'finished' && (
                    <div className="animate-fade text-center">
                        <Trophy size={120} className="text-accent mx-auto mb-8" />
                        <h2 className="text-6xl font-black mb-12">¡PODIO FINAL!</h2>
                        <div className="flex items-end justify-center gap-8 h-64">
                            {/* Silver */}
                            {players[1] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-4xl mb-2">{players[1].emoji}</span>
                                    <div className="bg-gray-400 w-32 h-32 rounded-t-2xl flex flex-col items-center justify-center p-4">
                                        <span className="font-bold truncate w-full text-center">{players[1].nickname}</span>
                                        <span className="text-sm font-black">2ND</span>
                                    </div>
                                </div>
                            )}
                            {/* Gold */}
                            {players[0] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-6xl mb-2 transform scale-125">{players[0].emoji}</span>
                                    <div className="bg-accent w-40 h-48 rounded-t-2xl flex flex-col items-center justify-center p-4">
                                        <span className="font-bold truncate w-full text-center text-dark">{players[0].nickname}</span>
                                        <span className="text-xl font-black text-dark">1ST</span>
                                    </div>
                                </div>
                            )}
                            {/* Bronze */}
                            {players[2] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-4xl mb-2">{players[2].emoji}</span>
                                    <div className="bg-orange-600 w-32 h-24 rounded-t-2xl flex flex-col items-center justify-center p-4">
                                        <span className="font-bold truncate w-full text-center">{players[2].nickname}</span>
                                        <span className="text-sm font-black">3RD</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
