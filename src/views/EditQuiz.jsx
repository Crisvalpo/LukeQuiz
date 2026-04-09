import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'

export default function EditQuiz() {
    const { quizId } = useParams()
    const [quiz, setQuiz] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuiz()
    }, [quizId])

    const fetchQuiz = async () => {
        const { data: q } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
        if (q) setQuiz(q)

        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index', { ascending: true })
        if (qs) setQuestions(qs)
        setLoading(false)
    }

    const addQuestion = () => {
        const newQ = {
            quiz_id: quizId,
            text: 'Nueva Pregunta',
            option_a: 'Opción A',
            option_b: 'Opción B',
            option_c: 'Opción C',
            option_d: 'Opción D',
            correct_option: 'A',
            time_limit: 20,
            order_index: questions.length
        }
        setQuestions([...questions, newQ])
    }

    const updateQuestion = (index, field, value) => {
        const updated = [...questions]
        updated[index][field] = value
        setQuestions(updated)
    }

    const saveAll = async () => {
        setLoading(true)
        // For MVP we just upsert all
        const { error } = await supabase.from('questions').upsert(questions)
        if (error) alert('Error al guardar')
        else alert('¡Guardado con éxito!')
        setLoading(false)
    }

    if (loading) return <div className="p-8 text-center">Cargando...</div>

    return (
        <div className="container py-8 max-w-4xl">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-glass rounded-lg"><ArrowLeft /></button>
                <h1 className="text-3xl font-bold">Editar: {quiz?.title}</h1>
            </div>

            <div className="space-y-6">
                {questions.map((q, idx) => (
                    <div key={idx} className="glass-card space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="bg-primary px-3 py-1 rounded-full text-xs font-bold">PREGUNTA {idx + 1}</span>
                            <button className="text-danger"><Trash2 size={18} /></button>
                        </div>

                        <input
                            className="input-field text-xl"
                            value={q.text}
                            onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                            placeholder="Texto de la pregunta"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center font-bold">A</span>
                                <input className="input-field" value={q.option_a} onChange={(e) => updateQuestion(idx, 'option_a', e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold">B</span>
                                <input className="input-field" value={q.option_b} onChange={(e) => updateQuestion(idx, 'option_b', e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center font-bold text-dark">C</span>
                                <input className="input-field" value={q.option_c} onChange={(e) => updateQuestion(idx, 'option_c', e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center font-bold">D</span>
                                <input className="input-field" value={q.option_d} onChange={(e) => updateQuestion(idx, 'option_d', e.target.value)} />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-xs text-gray-400">Opción Correcta</label>
                                <select
                                    className="input-field mt-1"
                                    value={q.correct_option}
                                    onChange={(e) => updateQuestion(idx, 'correct_option', e.target.value)}
                                >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-400">Tiempo (seg)</label>
                                <input
                                    type="number"
                                    className="input-field mt-1"
                                    value={q.time_limit}
                                    onChange={(e) => updateQuestion(idx, 'time_limit', parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button onClick={addQuestion} className="w-full py-4 border-2 border-dashed border-gray-600 rounded-2xl flex items-center justify-center gap-2 hover:border-primary text-gray-400 hover:text-primary transition-all">
                    <Plus /> Agregar Pregunta
                </button>

                <div className="sticky bottom-4">
                    <button onClick={saveAll} className="btn-primary w-full py-4 shadow-2xl">
                        <Save size={20} /> GUARDAR CAMBIOS
                    </button>
                </div>
            </div>
        </div>
    )
}
