import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlusCircle, Play, Settings } from 'lucide-react'
import { generateJoinCode } from '../utils/helpers'

export default function Home() {
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuizzes()
    }, [])

    const fetchQuizzes = async () => {
        const { data } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false })
        if (data) setQuizzes(data)
        setLoading(false)
    }

    const startNewGame = async (quizId) => {
        const code = generateJoinCode()
        const { data: game, error } = await supabase
            .from('games')
            .insert({
                quiz_id: quizId,
                join_code: code,
                status: 'waiting',
                current_question_index: 0
            })
            .select()
            .single()

        if (error) {
            alert('Error al iniciar partida')
            return
        }

        // Open screen in new tab, keep host here
        window.open(`/screen/${game.id}`, '_blank')
        navigate(`/host/${game.id}`)
    }

    const createQuiz = async () => {
        const title = prompt('Título del Quiz:')
        if (!title) return

        const { data, error } = await supabase
            .from('quizzes')
            .insert({ title, description: '' })
            .select()
            .single()

        if (data) {
            fetchQuizzes()
            // Logic to add questions could go here or a separate view
            alert('Quiz creado. Ahora agrega preguntas en la base de datos o en una futura vista de edición.')
        }
    }

    return (
        <div className="container py-12">
            <div className="flex justify-between items-center mb-12">
                <h1 className="text-5xl font-black">Mis <span className="text-primary">Quizzes</span></h1>
                <button onClick={createQuiz} className="btn-primary">
                    <PlusCircle size={20} /> Crear Nuevo
                </button>
            </div>

            {loading ? (
                <div className="text-center text-gray-500">Cargando...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map(q => (
                        <div key={q.id} className="glass-card hover:border-primary transition-all group">
                            <h3 className="text-2xl font-bold mb-2">{q.title}</h3>
                            <p className="text-gray-400 mb-6">{q.description || 'Sin descripción'}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => startNewGame(q.id)}
                                    className="flex-1 bg-success hover:bg-green-400 text-dark font-black py-3 rounded-xl flex items-center justify-center gap-2"
                                >
                                    <Play size={20} fill="currentColor" /> INICIAR
                                </button>
                                <button
                                    onClick={() => navigate(`/edit/${q.id}`)}
                                    className="bg-glass p-3 rounded-xl hover:bg-gray-700"
                                >
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {quizzes.length === 0 && (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-700 rounded-3xl">
                            <p className="text-gray-500">No tienes quizzes aún. ¡Crea el primero!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
