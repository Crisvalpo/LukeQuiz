import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlusCircle, Play, Settings } from 'lucide-react'
import { generateJoinCode } from '../utils/helpers'
import { toast } from 'sonner'
import Modal from '../components/Modal'

export default function Home() {
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newQuizTitle, setNewQuizTitle] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuizzes()
    }, [])

    const fetchQuizzes = async () => {
        const { data, error } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false })
        if (error) {
            toast.error('Error al cargar quizzes')
        } else {
            setQuizzes(data || [])
        }
        setLoading(false)
    }

    const startNewGame = async (quizId) => {
        const promise = new Promise(async (resolve, reject) => {
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

            if (error) reject(error)
            else resolve(game)
        })

        toast.promise(promise, {
            loading: 'Iniciando partida...',
            success: (game) => {
                window.open(`/screen/${game.id}`, '_blank')
                navigate(`/host/${game.id}`)
                return '¡Partida iniciada!'
            },
            error: 'No se pudo iniciar la partida'
        })
    }

    const handleCreateQuiz = async (e) => {
        e.preventDefault()
        if (!newQuizTitle.trim()) return

        const { data, error } = await supabase
            .from('quizzes')
            .insert({ title: newQuizTitle, description: '' })
            .select()
            .single()

        if (error) {
            toast.error('Error al crear el quiz')
        } else {
            toast.success('¡Quiz creado!')
            setIsModalOpen(false)
            setNewQuizTitle('')
            fetchQuizzes()
            navigate(`/edit/${data.id}`)
        }
    }

    return (
        <div className="container py-12">
            <div className="flex justify-between items-center mb-12">
                <h1 className="text-5xl font-black">Mis <span className="text-primary">Quizzes</span></h1>
                <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                    <PlusCircle size={20} /> Crear Nuevo
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 glass-card animate-pulse bg-white/5" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map(q => (
                        <div key={q.id} className="glass-card hover:border-primary transition-all group relative overflow-hidden">
                            <h3 className="text-2xl font-bold mb-2">{q.title}</h3>
                            <p className="text-gray-400 mb-6 line-clamp-2">{q.description || 'Sin descripción'}</p>
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
                        <div className="col-span-full text-center py-20 border-2 border-dashed border-gray-700 rounded-3xl">
                            <p className="text-gray-500 text-xl font-semibold">No tienes quizzes aún. ¡Crea el primero!</p>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Crear Nuevo Quiz"
            >
                <form onSubmit={handleCreateQuiz} className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-400">TÍTULO DEL QUIZ</label>
                        <input
                            className="input-field mt-2"
                            placeholder="Ej: Trivia de Cine"
                            value={newQuizTitle}
                            onChange={(e) => setNewQuizTitle(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-glass py-3 rounded-xl font-bold">Cancelar</button>
                        <button type="submit" className="flex-1 btn-primary py-3">Crear</button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
