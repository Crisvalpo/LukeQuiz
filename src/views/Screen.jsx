import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Users, Trophy, Loader2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useGameRoom } from '../hooks/useGameRoom'

export default function Screen() {
    const { gameId } = useParams()
    const { game, players, loading } = useGameRoom(gameId)
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const [answers, setAnswers] = useState([])
    const [timeLeft, setTimeLeft] = useState(0)

    // Sync answers and questions
    useEffect(() => {
        if (!game) return

        if (game.status === 'question') {
            fetchQuestion(game.quiz_id, game.current_question_index)

            // Filtered subscription to answers for current question
            const answerSub = supabase
                .channel(`answers_${gameId}`)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'answers' },
                    payload => {
                        // We check question_id in code if currentQuestion is set
                        // But better to fetch initial and then add if matches
                        setAnswers(prev => [...prev, payload.new])
                    }
                )
                .subscribe()

            return () => answerSub.unsubscribe()
        } else if (game.status === 'finished') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } })
        }
    }, [game?.status, game?.current_question_index])

    const fetchQuestion = async (quizId, index) => {
        const { data: qs } = await supabase
            .from('questions')
            .select('*')
            .eq('quiz_id', quizId)
            .eq('order_index', index)
            .single()

        if (qs) {
            setCurrentQuestion(qs)
            setAnswers([]) // Reset answers for new question

            // Initial fetch of answers already submitted (if any)
            const { data: initialAnswers } = await supabase
                .from('answers')
                .select('*')
                .eq('question_id', qs.id)
            if (initialAnswers) setAnswers(initialAnswers)
        }
    }

    // Synced Timer logic: uses question_started_at + time_limit
    useEffect(() => {
        if (game?.status !== 'question' || !currentQuestion || !game.question_started_at) {
            setTimeLeft(0)
            return
        }

        const calculateTime = () => {
            const start = new Date(game.question_started_at).getTime()
            const now = Date.now()
            const elapsed = Math.floor((now - start) / 1000)
            const remaining = Math.max(0, currentQuestion.time_limit - elapsed)
            setTimeLeft(remaining)
        }

        calculateTime()
        const interval = setInterval(calculateTime, 1000)
        return () => clearInterval(interval)
    }, [game?.status, game?.question_started_at, currentQuestion])

    if (loading) {
        return (
            <div className="min-h-screen bg-darker flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={64} />
            </div>
        )
    }

    const joinUrl = `${window.location.origin}/join?code=${game?.join_code}`

    return (
        <div className="min-h-screen bg-darker p-8 flex flex-col font-main">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
                <h1 className="text-4xl font-black italic tracking-tighter">
                    LUKE<span className="text-primary font-normal">QUIZ</span>
                </h1>
                <div className="flex gap-4">
                    <div className="glass-card py-2 px-6 rounded-full flex items-center gap-3 border-primary/20 bg-primary/5">
                        <Users size={20} className="text-primary" />
                        <span className="font-bold text-xl">{players.length}</span>
                    </div>
                    {game?.join_code && (
                        <div className="bg-primary px-8 py-2 rounded-full font-black text-xl shadow-[0_0_20px_rgba(108,92,231,0.4)]">
                            PIN: {game.join_code}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">

                {game?.status === 'waiting' && (
                    <div className="animate-fade text-center">
                        <div className="flex gap-16 items-center justify-center mb-16">
                            <div className="bg-white p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform">
                                <QRCodeSVG value={joinUrl} size={280} />
                            </div>
                            <div className="text-left max-w-lg">
                                <h2 className="text-6xl font-black mb-6 leading-tight">¡Únete a la <span className="text-primary">Partida</span>!</h2>
                                <p className="text-2xl text-gray-400 mb-8">Escanea el código o entra a <br /> <span className="text-white font-bold opacity-80">{window.location.host}/join</span></p>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto">
                            {players.map(p => (
                                <div key={p.id} className="player-bubble text-2xl px-8 py-4 bg-white/10 hover:bg-white/20 transition-colors">
                                    <span>{p.emoji}</span>
                                    <span>{p.nickname}</span>
                                </div>
                            ))}
                            {players.length === 0 && (
                                <p className="text-gray-500 italic text-2xl animate-pulse">Esperando a los primeros valientes...</p>
                            )}
                        </div>
                    </div>
                )}

                {game?.status === 'question' && currentQuestion && (
                    <div className="w-full max-w-6xl animate-fade">
                        <div className="text-center mb-16">
                            <h2 className="text-6xl font-bold leading-tight mb-12 drop-shadow-lg">{currentQuestion.text}</h2>
                            <div className="relative inline-block">
                                <div className={`w-32 h-32 rounded-full border-[10px] flex items-center justify-center text-4xl font-black transition-colors ${timeLeft < 5 ? 'border-danger text-danger animate-pulse' : 'border-primary'}`}>
                                    {timeLeft}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="option-card option-A text-3xl py-12">{currentQuestion.option_a}</div>
                            <div className="option-card option-B text-3xl py-12">{currentQuestion.option_b}</div>
                            <div className="option-card option-C text-3xl py-12">{currentQuestion.option_c}</div>
                            <div className="option-card option-D text-3xl py-12">{currentQuestion.option_d}</div>
                        </div>

                        <div className="mt-12 text-center text-3xl font-black text-gray-400">
                            RESPUESTAS: <span className="text-white">{answers.length}</span> / {players.length}
                        </div>
                    </div>
                )}

                {game?.status === 'results' && (
                    <div className="w-full max-w-4xl animate-fade text-center">
                        <h2 className="text-5xl font-black mb-16 tracking-tight">RANKING ACTUAL</h2>
                        <div className="space-y-6">
                            {players.slice(0, 5).map((p, idx) => (
                                <div key={p.id} className="glass-card flex justify-between items-center py-6 px-10 border-white/5 hover:border-primary/30 transition-all">
                                    <div className="flex items-center gap-6">
                                        <span className={`text-3xl font-black ${idx === 0 ? 'text-accent' : 'text-gray-500'}`}>#{idx + 1}</span>
                                        <span className="text-5xl">{p.emoji}</span>
                                        <span className="text-3xl font-bold">{p.nickname}</span>
                                    </div>
                                    <span className="text-3xl font-black text-primary">{p.score.toLocaleString()} pts</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {game?.status === 'finished' && (
                    <div className="animate-fade text-center">
                        <Trophy size={140} className="text-accent mx-auto mb-10 drop-shadow-[0_0_30px_rgba(253,203,110,0.5)]" />
                        <h2 className="text-7xl font-black mb-16 italic tracking-tighter">¡PODIO FINAL!</h2>
                        <div className="flex items-end justify-center gap-10 h-80">
                            {/* Silver */}
                            {players[1] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-5xl mb-4">{players[1].emoji}</span>
                                    <div className="bg-gray-400 w-40 h-40 rounded-t-3xl flex flex-col items-center justify-center p-6 shadow-2xl">
                                        <span className="font-bold truncate w-full text-center text-xl">{players[1].nickname}</span>
                                        <div className="mt-2 bg-black/20 px-4 py-1 rounded-full font-black text-sm">2ND</div>
                                    </div>
                                </div>
                            )}
                            {/* Gold */}
                            {players[0] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-7xl mb-4 transform scale-125 animate-bounce">{players[0].emoji}</span>
                                    <div className="bg-accent w-48 h-56 rounded-t-3xl flex flex-col items-center justify-center p-6 shadow-[0_0_50px_rgba(253,203,110,0.3)]">
                                        <span className="font-bold truncate w-full text-center text-2xl text-dark">{players[0].nickname}</span>
                                        <div className="mt-4 bg-black/10 px-6 py-2 rounded-full font-black text-xl text-dark">1ST</div>
                                    </div>
                                </div>
                            )}
                            {/* Bronze */}
                            {players[2] && (
                                <div className="flex flex-col items-center">
                                    <span className="text-5xl mb-4">{players[2].emoji}</span>
                                    <div className="bg-[#cd7f32] w-40 h-32 rounded-t-3xl flex flex-col items-center justify-center p-6 shadow-2xl">
                                        <span className="font-bold truncate w-full text-center text-xl">{players[2].nickname}</span>
                                        <div className="mt-2 bg-black/20 px-4 py-1 rounded-full font-black text-sm">3RD</div>
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
