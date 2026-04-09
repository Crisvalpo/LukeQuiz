import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Play, SkipForward, BarChart2, CheckCircle, Users, Trophy, Loader2 } from 'lucide-react'
import { calculateScore } from '../utils/helpers'
import { toast } from 'sonner'
import { useGameRoom } from '../hooks/useGameRoom'

export default function Host() {
    const { quizId: gameId } = useParams()
    const { game, setGame, players, loading } = useGameRoom(gameId)
    const [questions, setQuestions] = useState([])
    const [answerCount, setAnswerCount] = useState(0)
    const navigate = useNavigate()

    useEffect(() => {
        if (game) {
            fetchQuestions(game.quiz_id)
            fetchCounts()
        }

        // Subscribe to answers count
        const channel = supabase.channel(`host_counts_${gameId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, () => fetchCounts())
            .subscribe()

        return () => channel.unsubscribe()
    }, [gameId, game?.quiz_id])

    const fetchQuestions = async (qId) => {
        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', qId).order('order_index', { ascending: true })
        if (qs) setQuestions(qs)
    }

    const fetchCounts = async () => {
        if (!game) return
        // Get answers for the current question specifically
        const currentQ = questions[game.current_question_index]
        if (!currentQ) return

        const { count } = await supabase
            .from('answers')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', currentQ.id)

        setAnswerCount(count || 0)
    }

    const updateStatus = async (status, indexOffset = 0) => {
        const promise = new Promise(async (resolve, reject) => {
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

            if (error) reject(error)
            else {
                setGame(data)
                resolve(data)
            }
        })

        toast.promise(promise, {
            loading: 'Actualizando estado...',
            success: 'Estado actualizado',
            error: 'Error al cambiar estado'
        })
    }

    const processScores = async () => {
        const currentQ = questions[game.current_question_index]
        if (!currentQ) return

        // Prefer RPC if the user has installed it (Backend optimization)
        const { error: rpcError } = await supabase.rpc('process_scores', {
            p_game_id: gameId,
            p_question_id: currentQ.id
        })

        if (!rpcError) {
            console.log('Scores processed via RPC')
            return
        }

        // Fallback for MVP (Frontend processing)
        console.warn('RPC failed or not found, falling back to frontend scoring:', rpcError)
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

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
    )

    return (
        <div className="container max-w-2xl py-8 font-main">
            <div className="glass-card mb-8 border-white/10 shadow-2xl">
                <div className="flex justify-between items-start mb-10">
                    <div>
                        <span className="text-primary font-bold text-xs uppercase tracking-[0.3em]">Game Master</span>
                        <h2 className="text-4xl font-black mt-1 leading-tight">{game?.quizzes?.title}</h2>
                    </div>
                    <div className="bg-darker px-6 py-3 rounded-2xl text-primary font-black border border-primary/20 shadow-inner text-xl">
                        {game?.join_code}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-10">
                    <div className="bg-white/5 p-6 rounded-3xl flex items-center gap-5 border border-white/5">
                        <Users className="text-secondary" size={32} />
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Players</p>
                            <p className="text-3xl font-black">{players.length}</p>
                        </div>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl flex items-center gap-5 border border-white/5">
                        <CheckCircle className="text-success" size={32} />
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Answers</p>
                            <p className="text-3xl font-black">{answerCount}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {game?.status === 'waiting' && (
                        <button onClick={handleNext} className="btn-primary w-full py-6 text-2xl font-black shadow-lg transform active:scale-[0.98] transition-all">
                            <Play size={28} fill="currentColor" className="mr-2" /> INICIAR PARTIDA
                        </button>
                    )}

                    {game?.status === 'question' && (
                        <button onClick={handleNext} className="btn-primary w-full py-6 text-2xl font-black bg-amber-500 hover:bg-amber-400 border-amber-600 shadow-xl active:scale-[0.98]">
                            <BarChart2 size={28} className="mr-2" /> MOSTRAR RESULTADOS
                        </button>
                    )}

                    {game?.status === 'results' && (
                        <button onClick={handleNext} className="btn-primary w-full py-6 text-2xl font-black shadow-lg transform active:scale-[0.98]">
                            <SkipForward size={28} fill="currentColor" className="mr-2" />
                            {game.current_question_index < questions.length - 1 ? 'SIGUIENTE PREGUNTA' : 'FINALIZAR JUEGO'}
                        </button>
                    )}

                    {game?.status === 'finished' && (
                        <div className="text-center py-10 bg-white/5 rounded-3xl flex flex-col items-center">
                            <Trophy size={64} className="text-accent mb-4 animate-bounce" />
                            <p className="text-gray-400 mb-6 font-bold uppercase tracking-widest">El juego ha concluido</p>
                            <button onClick={() => navigate('/')} className="text-primary font-black hover:scale-105 transition-transform text-lg border-b-2 border-primary">
                                Volver al Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white/5 border border-white/5 p-6 rounded-3xl text-gray-500 text-center text-sm leading-relaxed">
                <span className="font-bold text-gray-400 block mb-1">PRO-TIP 💡</span>
                Asegúrate de mostrar la pestaña de <b>Pantalla (Screen)</b> en el proyector principal. <br />
                Para grandes grupos, se recomienda habilitar el <b>RPC process_scores</b> en Supabase.
            </div>
        </div>
    )
}
