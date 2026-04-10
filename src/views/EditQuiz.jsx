import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Save, ArrowLeft, Terminal, Layout, FileText, ImageIcon, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export default function EditQuiz() {
    const { quizId } = useParams()
    const [quiz, setQuiz] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [bulkText, setBulkText] = useState('')
    const [showBulk, setShowBulk] = useState(false)
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
            image_url: '',
            order_index: questions.length
        }
        setQuestions([...questions, newQ])
    }

    const handleBulkUpload = () => {
        try {
            const lines = bulkText.split('\n').filter(l => l.trim())
            const newQuestions = lines.map((line, i) => {
                const [text, a, b, c, d, correct, img] = line.split('|').map(s => s.trim())
                if (!text || !a || !b || !c || !d || !correct) throw new Error(`Línea ${i + 1} incompleta`)
                return {
                    quiz_id: quizId,
                    text,
                    option_a: a,
                    option_b: b,
                    option_c: c,
                    option_d: d,
                    correct_option: correct.toUpperCase(),
                    image_url: img || '',
                    order_index: questions.length + i
                }
            })
            setQuestions([...questions, ...newQuestions])
            setShowBulk(false)
            setBulkText('')
            toast.success(`${newQuestions.length} preguntas añadidas con éxito`)
        } catch (e) {
            toast.error(e.message)
        }
    }

    const updateQuestion = (index, field, value) => {
        const updated = [...questions]
        updated[index][field] = value
        setQuestions(updated)
    }

    const removeQuestion = (index) => {
        const updated = questions.filter((_, i) => i !== index)
        setQuestions(updated)
    }

    const saveAll = async () => {
        setLoading(true)

        // Sanitizar datos minuciosamente
        const sanitizedQuestions = questions.map(q => {
            const cleanQ = {
                quiz_id: q.quiz_id,
                text: q.text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct_option: q.correct_option,
                image_url: q.image_url || '',
                order_index: q.order_index
            }
            // Solo incluir ID si ya existe (para que Supabase haga UPDATE en lugar de INSERT)
            if (q.id) cleanQ.id = q.id
            return cleanQ
        })

        const { error } = await supabase.from('questions').upsert(sanitizedQuestions)
        if (error) {
            toast.error('Error: No se pudieron guardar los cambios')
        } else {
            toast.success('Juego Guardado con Éxito')
            fetchQuiz()
        }
        setLoading(false)
    }

    const copyPrompt = () => {
        const promptText = `Actúa como un experto en creación de contenido educativo. Genera una lista de 20 preguntas para una trivia titulada "${quiz?.title}" sobre "${quiz?.description || 'temas generales'}".
Cada pregunta debe seguir estrictamente este formato de texto plano, separando los campos con el carácter pipe (|):
Pregunta | Opción A | Opción B | Opción C | Opción D | Letra de Opción Correcta (Solo la letra A, B, C o D) | URL de Imagen Relevante

Por ejemplo:
¿Cuál es la capital de Francia? | Madrid | París | Roma | Berlín | B | https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80

REGLAS CRÍTICAS:
1. Devuelve SOLO las 20 líneas de preguntas, una por línea.
2. Sin introducciones, sin números al inicio, sin explicaciones.
3. Asegúrate de que las URLs de imagen sean de Unsplash o sitios similares y que funcionen.
4. Las opciones deben ser coherentes y solo una debe ser la correcta.
5. Usa exactamente el formato: texto|a|b|c|d|letra_correcta|url_imagen`

        navigator.clipboard.writeText(promptText)
        toast.success('Prompt copiado para tu IA favorita')
    }

    if (loading) return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-8">
            <div className="text-center animate-pulse">
                <Terminal className="text-primary mb-4 mx-auto" size={48} />
                <p className="text-[10px] font-display font-black tracking-[0.4em] uppercase text-on-surface-variant">Cargando...</p>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-surface font-body text-on-surface selection:bg-primary/30 relative">
            {/* Atmosphere */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-5">
                <div className="absolute top-[10%] left-[-5%] w-[40%] h-[40%] bg-primary rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-secondary rounded-full blur-[100px]" />
            </div>

            <div className="max-w-4xl mx-auto px-8 py-12 relative z-10">
                <header className="flex items-center justify-between mb-16">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/')}
                            className="w-12 h-12 glass rounded-2xl flex items-center justify-center hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <p className="text-[10px] font-display font-black text-primary tracking-[0.3em] uppercase mb-1 opacity-50">Editor de Preguntas</p>
                            <h1 className="text-4xl font-display font-black tracking-tighter uppercase">{quiz?.title}</h1>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowBulk(!showBulk)}
                        className="bg-surface-high border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3 text-xs font-display font-black hover:bg-surface-highest transition-colors uppercase tracking-widest"
                    >
                        <FileText size={16} />
                        Carga Masiva
                    </button>
                </header>

                {showBulk && (
                    <div className="glass p-8 rounded-[2rem] border-primary/20 bg-primary/5 mb-12 space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-center bg-surface-lowest/50 p-6 rounded-3xl mb-4 border border-white/5">
                            <div className="flex flex-col">
                                <h3 className="text-sm font-display font-black text-primary uppercase tracking-widest">Carga de Preguntas en Bloque</h3>
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase opacity-50 mt-1">Formato: Pregunta | A | B | C | D | Correcta(A/B/C/D) | ImagenURL</p>
                            </div>
                            <button
                                onClick={copyPrompt}
                                className="flex items-center gap-3 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl transition-all border border-primary/20 hover:scale-105"
                            >
                                <Sparkles size={14} />
                                <span className="text-[10px] font-display font-black uppercase tracking-widest">Generar con IA</span>
                            </button>
                        </div>
                        <textarea
                            className="w-full h-48 bg-surface-lowest border-2 border-white/5 rounded-2xl p-6 text-on-surface font-mono text-sm focus:border-primary focus:outline-none"
                            placeholder="¿Cuál es la capital de Francia? | Madrid | Parí­s | Roma | Berlín | B | https://link-a-imagen.jpg"
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                        />
                        <div className="flex gap-4">
                            <button
                                onClick={handleBulkUpload}
                                className="flex-1 bg-primary py-4 rounded-xl text-surface font-display font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-sm"
                            >
                                Importar Preguntas
                            </button>
                            <button
                                onClick={() => setShowBulk(false)}
                                className="px-8 bg-surface-lowest border border-white/10 rounded-xl text-on-surface-variant font-display font-black uppercase tracking-widest text-[10px]"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-10">
                    {questions.map((q, idx) => (
                        <div key={idx} className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8 group transition-all hover:bg-surface-high">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/20 text-primary px-4 py-2 rounded-xl text-[10px] font-display font-black tracking-widest uppercase mb-1">
                                        PREGUNTA {idx + 1}
                                    </div>
                                    <div className="w-[1px] h-6 bg-white/10" />
                                    <div className="text-xs font-display font-bold text-on-surface-variant uppercase tracking-widest">Editor de Texto</div>
                                </div>
                                <button
                                    onClick={() => removeQuestion(idx)}
                                    className="p-3 bg-danger/10 text-danger rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/20"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.2em] uppercase ml-1">Enunciado</label>
                                <textarea
                                    className="w-full bg-surface-lowest border-2 border-white/5 rounded-2xl p-6 text-on-surface font-display text-2xl focus:border-primary focus:outline-none transition-colors min-h-[120px]"
                                    value={q.text}
                                    onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                                    placeholder="Ingrese el texto de la pregunta..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { id: 'a', label: '▲', color: 'border-danger/30' },
                                    { id: 'b', label: '◆', color: 'border-secondary/30' },
                                    { id: 'c', label: '●', color: 'border-on-surface/30' },
                                    { id: 'd', label: '■', color: 'border-success/30' }
                                ].map((opt) => (
                                    <div key={opt.id} className="space-y-2">
                                        <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.2em] uppercase ml-1">Opción {opt.id.toUpperCase()}</label>
                                        <div className={`flex items-center gap-4 bg-surface-container rounded-2xl p-2 border-2 ${opt.color}`}>
                                            <span className="w-12 h-12 glass rounded-xl flex items-center justify-center font-display font-black text-xs text-on-surface-variant">{opt.label}</span>
                                            <input
                                                className="bg-transparent border-none focus:outline-none flex-1 font-display font-bold text-lg p-3"
                                                value={q[`option_${opt.id}`]}
                                                onChange={(e) => updateQuestion(idx, `option_${opt.id}`, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                                    <ImageIcon size={10} /> URL de la Imagen (Opcional)
                                </label>
                                <input
                                    className="w-full bg-surface-lowest border-2 border-white/5 rounded-2xl p-4 text-on-surface font-display text-sm focus:border-primary focus:outline-none transition-colors"
                                    value={q.image_url || ''}
                                    onChange={(e) => updateQuestion(idx, 'image_url', e.target.value)}
                                    placeholder="https://ejemplo.com/imagen.jpg"
                                />
                                {q.image_url && (
                                    <div className="mt-4 rounded-2xl overflow-hidden h-40 border border-white/5">
                                        <img src={q.image_url} alt="Vista previa" className="w-full h-full object-cover opacity-50" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col md:flex-row gap-8 pt-4">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.2em] uppercase ml-1">Respuesta Correcta</label>
                                    <select
                                        className="w-full bg-surface-container border-2 border-white/5 rounded-2xl p-5 text-on-surface font-display font-black text-xl focus:border-primary focus:outline-none appearance-none cursor-pointer"
                                        value={q.correct_option}
                                        onChange={(e) => updateQuestion(idx, 'correct_option', e.target.value)}
                                    >
                                        <option value="A">OPCIÓN A</option>
                                        <option value="B">OPCIÓN B</option>
                                        <option value="C">OPCIÓN C</option>
                                        <option value="D">OPCIÓN D</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={addQuestion}
                        className="w-full py-12 border-2 border-dashed border-white/10 rounded-[3rem] flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all text-on-surface-variant hover:text-primary group"
                    >
                        <Plus size={40} className="group-hover:rotate-90 transition-transform" />
                        <span className="font-display font-black tracking-[0.4em] uppercase text-xs">Añadir Nueva Pregunta</span>
                    </button>

                    <div className="sticky bottom-8 z-50 pt-10">
                        <button
                            onClick={saveAll}
                            disabled={loading}
                            className="bg-primary w-full py-6 rounded-3xl text-surface font-display font-black text-xl tracking-[0.2em] flex items-center justify-center gap-4 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            <Save size={20} />
                            {loading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-20" /> {/* Spacer */}
        </div>
    )
}
