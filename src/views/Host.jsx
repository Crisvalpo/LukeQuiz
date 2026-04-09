import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Play, SkipForward, BarChart2, CheckCircle, Users, Trophy } from 'lucide-react'
import { calculateScore } from '../utils/helpers'

export default function Host() {
    const { quizId } = useParams() // Actually gameId in current implementation
    const gameId = quizId
    const [game, setGame] = useState(null)
    const [questions, setQuestions] = useState([])
    const [playerCount, setPlayerCount] = useState(0)
    const [answerCount, setAnswerCount] = useState(0)
    const navigate = useNavigate()

    useEffect(() => {
        fetchGame()

        // Subscribe to counts
        const channel = supabase.channel('host_stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, () => fetchCounts())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, () => fetchCounts())
            .subscribe()

        return () => channel.unsubscribe()
    }, [gameId])

    const fetchGame = async () => {
        const { data: g } = await supabase.from('games').select('*, quizzes(*)').eq('id', gameId).single()
        if (g) {
            setGame(g)
            fetchQuestions(g.quiz_id)
            fetchCounts()
        }
    }

    const fetchQuestions = async (qId) => {
        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', qId).order('order_index', { ascending: true })
        if (qs) setQuestions(qs)
    }

    const fetchCounts = async () => {
        const { count: p } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('game_id', gameId)
        setPlayerCount(p || 0)

        // In a real scenario we'd track answers for the current question
        // For MVP we just count total answers in table for simplicity of the trigger later
        const { count: a } = await supabase.from('answers').select('*', { count: 'exact', head: true })
        setAnswerCount(a || 0)
    }

    const updateStatus = async (status, indexOffset = 0) => {
        if (status === 'results') {
            await processScores()
        }

        const updates = {
            status,
            current_question_index: (game.current_question_index + indexOffset),
            question_started_at: status === 'question' ? new Date().toISOString() : game.question_started_at
        }

        const { data, error } = await supabase
            .from('games')
            .update(updates)
            .eq('id', gameId)
            .select()
            .single()

        if (data) setGame(data)
    }

    const processScores = async () => {
        const currentQ = questions[game.current_question_index]
        if (!currentQ) return

        const { data: qAnswers } = await supabase
            .from('answers')
            .select('*, players(*)')
            .eq('question_id', currentQ.id)

        if (!qAnswers) return

        for (const ans of qAnswers) {
            const isCorrect = ans.selected_option === currentQ.correct_option
            if (isCorrect) {
                const startTime = new Date(game.question_started_at).getTime()
                const answerTime = new Date(ans.created_at).getTime()
                const elapsed = (answerTime - startTime) / 1000
                const timeLeft = Math.max(0, currentQ.time_limit - elapsed)

                const points = calculateScore(timeLeft, currentQ.time_limit, true)

                const currentScore = ans.players?.score || 0
                await supabase
                    .from('players')
                    .update({ score: currentScore + points })
                    .eq('id', ans.player_id)
            }
        }
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

    if (!game) return <div className="p-8 text-center">Cargando partida...</div>

    return (
        <div className="container max-w-2xl py-8">
            <div className="glass-card mb-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className="text-primary font-bold text-sm uppercase tracking-widest">Host Control</span>
                        <h2 className="text-3xl font-bold">{game.quizzes?.title}</h2>
                    </div>
                    <div className="bg-dark px-4 py-2 rounded-xl text-primary font-black border border-primary/30">
                        PIN: {game.join_code}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-glass p-4 rounded-2xl flex items-center gap-4">
                        <Users className="text-secondary" />
                        <div>
                            <p className="text-xs text-gray-400">Jugadores</p>
                            <p className="text-2xl font-black">{playerCount}</p>
                        </div>
                    </div>
                    <div className="bg-glass p-4 rounded-2xl flex items-center gap-4">
                        <CheckCircle className="text-success" />
                        <div>
                            <p className="text-xs text-gray-400">Respuestas</p>
                            <p className="text-2xl font-black">{answerCount}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {game.status === 'waiting' && (
                        <button onClick={handleNext} className="btn-primary w-full py-6 text-2xl">
                            <Play size={24} fill="currentColor" /> EMPEZAR JUEGO
                        </button>
                    )}

                    {game.status === 'question' && (
                        <button onClick={handleNext} className="btn-primary w-full py-6 text-2xl bg-amber-500 hover:bg-amber-400">
                            <BarChart2 size={24} /> MOSTRAR RESULTADOS
                        </button>
                    )}

                    {game.status === 'results' && (
                        <button onClick={handleNext} className="btn-primary w-full py-6 text-2xl">
                            <SkipForward size={24} fill="currentColor" />
                            {game.current_question_index < questions.length - 1 ? 'SIGUIENTE PREGUNTA' : 'FINALIZAR JUEGO'}
                        </button>
                    )}

                    {game.status === 'finished' && (
                        <div className="text-center py-8">
                            <p className="text-gray-400 mb-4">El juego ha terminado</p>
                            <button onClick={() => navigate('/')} className="text-primary font-bold hover:underline">
                                Volver al inicio
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-gray-500 text-center text-sm">
                Controla el ritmo del juego desde aquí. <br />
                Asegúrate de tener abierta la pestaña de <b>Pantalla (Screen)</b> para que todos vean.
            </div>
        </div>
    )
}
