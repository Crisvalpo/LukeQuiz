import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Save, ArrowLeft, Terminal, Layout, FileText, ImageIcon, Sparkles, Wand2, Loader2, Volume2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

export default function EditQuiz() {
    const { quizId } = useParams()
    const [quiz, setQuiz] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [bulkText, setBulkText] = useState('')
    const [showBulk, setShowBulk] = useState(false)
    const [aiTopic, setAiTopic] = useState('')
    const [aiCount, setAiCount] = useState(5)
    const [isGenerating, setIsGenerating] = useState(false)
    const [ttsEnabled, setTtsEnabled] = useState(false)
    const [isGeneratingTts, setIsGeneratingTts] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuiz()
    }, [quizId])

    const fetchQuiz = async () => {
        const { data: q } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
        if (q) {
            setQuiz(q)
            setAiTopic(q.title) // Valor por defecto para el tema
        }

        const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index', { ascending: true })
        if (qs) setQuestions(qs)
        setLoading(false)
    }

    const handleGenerateTTS = async (question, index) => {
        if (!question.text) return

        try {
            const { data, error } = await supabase.functions.invoke('generate-tts', {
                body: {
                    text: question.text,
                    questionId: question.id || question.id_temp,
                    quizId
                }
            })

            if (error) {
                if (error.status === 403) {
                    toast.error('SWITCH_KILLER: Cuota del 80% alcanzada. TTS desactivado.')
                    setTtsEnabled(false)
                }
                throw error
            }

            if (data?.publicUrl) {
                updateQuestion(index, 'audio_url', data.publicUrl)
                return data.publicUrl
            }
        } catch (e) {
            console.error('Error TTS:', e)
            throw e
        }
    }

    const handleGenerateAI = async () => {
        if (!aiTopic.trim()) return toast.error('Ingresa un tema para la IA')

        setIsGenerating(true)
        const toastId = toast.loading('Consultando oráculo de la IA...')

        try {
            const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: { topic: aiTopic, count: aiCount }
            })

            if (error) throw error

            const newQuestions = data.map((q, i) => ({
                ...q,
                id_temp: crypto.randomUUID(),
                quiz_id: quizId,
                order_index: questions.length + i,
                audio_url: ''
            }))

            if (ttsEnabled) {
                toast.loading('Generando voces neuronales...', { id: toastId })
                for (let i = 0; i < newQuestions.length; i++) {
                    try {
                        const url = await handleGenerateTTS(newQuestions[i], questions.length + i)
                        newQuestions[i].audio_url = url
                    } catch (e) {
                        console.error(`Error TTS en pregunta ${i}:`, e)
                    }
                }
            }

            setQuestions(prev => [...prev, ...newQuestions])
            toast.success(`Protocolo completado: ${newQuestions.length} nuevas preguntas integradas`, { id: toastId })
            setAiTopic('')
        } catch (e) {
            console.error(e)
            toast.error('Error en la matriz: No se pudo generar el quiz', { id: toastId })
        } finally {
            setIsGenerating(false)
        }
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

    if (loading && !quiz) return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-8 relative overflow-hidden">
            <div className="v-grid absolute inset-0 opacity-20" />
            <div className="text-center space-y-6 relative z-10">
                <div className="relative inline-block">
                    <Terminal className="text-primary animate-pulse" size={64} />
                    <div className="absolute inset-0 bg-primary blur-[30px] opacity-20 animate-pulse" />
                </div>
                <div className="space-y-2">
                    <p className="text-xl font-display font-black tracking-[0.5em] uppercase text-white animate-pulse">SINCRONIZANDO_PROTOCOLO</p>
                    <p className="text-[10px] font-display font-black tracking-[0.3em] uppercase text-primary/40">LukeQUIZ 3.0 // Editor_Interface</p>
                </div>
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
                            className="w-12 h-12 glass rounded-sm flex items-center justify-center hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <p className="text-[10px] font-display font-black text-primary tracking-[0.3em] uppercase mb-1 opacity-50">SISTEMA_EDICIÓN_V3.0</p>
                            <h1 className="text-4xl font-display font-black tracking-tighter uppercase italic">{quiz?.title}</h1>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowBulk(!showBulk)}
                        className="bg-surface-lowest border border-primary/30 px-6 py-3 rounded-sm flex items-center gap-3 text-xs font-display font-black text-primary hover:bg-primary hover:text-surface transition-all uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(236,72,153,0.2)]"
                    >
                        <FileText size={16} />
                        CARGA_MASIVA
                    </button>
                </header>

                {showBulk && (
                    <div className="glass p-8 rounded border-primary/20 bg-primary/5 mb-12 space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-center bg-surface-lowest/50 p-6 rounded-sm mb-4 border border-white/5">
                            <div className="flex flex-col">
                                <h3 className="text-sm font-display font-black text-primary uppercase tracking-widest">Carga de Preguntas en Bloque</h3>
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase opacity-50 mt-1">Formato: Pregunta | A | B | C | D | Correcta(A/B/C/D) | ImagenURL</p>
                            </div>
                            <button
                                onClick={copyPrompt}
                                className="flex items-center gap-3 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-sm transition-all border border-primary/20 hover:scale-105"
                            >
                                <Sparkles size={14} />
                                <span className="text-[10px] font-display font-black uppercase tracking-widest">Generar con IA</span>
                            </button>
                        </div>
                        <textarea
                            className="w-full h-48 bg-surface-lowest border-2 border-white/5 rounded-sm p-6 text-on-surface font-mono text-sm focus:border-primary focus:outline-none"
                            placeholder="¿Cuál es la capital de Francia? | Madrid | Parí­s | Roma | Berlín | B | https://link-a-imagen.jpg"
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                        />
                        <div className="flex gap-4">
                            <button
                                onClick={handleBulkUpload}
                                className="flex-1 bg-primary py-4 rounded-sm text-surface font-display font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-sm"
                            >
                                Importar Preguntas
                            </button>
                            <button
                                onClick={() => setShowBulk(false)}
                                className="px-8 bg-surface-lowest border border-white/10 rounded-sm text-on-surface-variant font-display font-black uppercase tracking-widest text-[10px]"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* AI Generation Sector */}
                <div className="glass-card p-8 mb-12 border-primary/20 bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wand2 size={80} className="rotate-12" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-sm">
                                    <Sparkles size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-display font-black text-white uppercase tracking-[0.2em]">Generación Mágica_IA</h3>
                                    <p className="text-[10px] text-primary font-black uppercase tracking-widest opacity-60 italic">Protocolo Gemini 1.5 Flash activated</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-black/30 p-4 rounded border border-white/5">
                                <div className="flex items-center gap-2">
                                    <Volume2 size={16} className={ttsEnabled ? "text-secondary" : "text-white/20"} />
                                    <span className="text-[10px] font-display font-black uppercase tracking-widest">Voz_Neuronal</span>
                                </div>
                                <button
                                    onClick={() => setTtsEnabled(!ttsEnabled)}
                                    className={`w-12 h-6 rounded-full relative transition-all ${ttsEnabled ? 'bg-secondary' : 'bg-white/10'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${ttsEnabled ? 'left-7 shadow-[0_0_10px_#22d3ee]' : 'left-1'}`} />
                                </button>
                                {ttsEnabled && (
                                    <div className="flex items-center gap-1 text-[8px] font-display font-black text-secondary uppercase animate-pulse">
                                        <ShieldAlert size={10} />
                                        <span>Safe_80%_on</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 space-y-2">
                                <label className="text-[9px] font-display font-black text-white/40 tracking-[0.3em] uppercase ml-1">TEMA_DE_INSPECCIÓN</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/40 border-2 border-white/5 rounded-sm p-4 text-white font-display text-sm focus:border-primary focus:outline-none transition-all placeholder:text-white/10"
                                    placeholder="Ej: Historia de la computación, Química avanzada..."
                                    value={aiTopic}
                                    onChange={(e) => setAiTopic(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:w-32 space-y-2">
                                <label className="text-[9px] font-display font-black text-white/40 tracking-[0.3em] uppercase ml-1">CANTIDAD</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    className="w-full bg-black/40 border-2 border-white/5 rounded-sm p-4 text-white font-display text-sm focus:border-primary focus:outline-none transition-all text-center"
                                    value={aiCount}
                                    onChange={(e) => setAiCount(parseInt(e.target.value))}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating}
                                    className="h-[52px] px-8 bg-primary rounded-sm text-surface font-display font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-xs flex items-center gap-3 disabled:opacity-50 disabled:scale-100 shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>PROCESANDO...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 size={16} />
                                            <span>GENERAR_IA</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    {questions.map((q, idx) => (
                        <div key={idx} className="glass p-10 rounded-md border-white/5 space-y-8 group transition-all hover:bg-surface-high">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary text-surface px-4 py-2 rounded-sm text-[10px] font-display font-black tracking-[0.3em] uppercase mb-1 italic">
                                        MODULO_PREGUNTA_00{idx + 1}
                                    </div>
                                    <div className="w-10 h-[1px] bg-white/10" />
                                    <div className="text-[9px] font-display font-black text-white/30 uppercase tracking-[0.5em] italic">EDITOR_DE_SERIALES</div>
                                </div>
                                <button
                                    onClick={() => removeQuestion(idx)}
                                    className="p-3 bg-danger/10 text-danger rounded-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/20"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.2em] uppercase ml-1">Enunciado</label>
                                <textarea
                                    className="w-full bg-surface-lowest border-2 border-white/5 rounded-sm p-6 text-on-surface font-display text-2xl focus:border-primary focus:outline-none transition-colors min-h-[120px]"
                                    value={q.text}
                                    onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                                    placeholder="Ingrese el texto de la pregunta..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { id: 'a', label: 'A', color: 'border-danger/20' },
                                    { id: 'b', label: 'B', color: 'border-secondary/20' },
                                    { id: 'c', label: 'C', color: 'border-white/10' },
                                    { id: 'd', label: 'D', color: 'border-success/20' }
                                ].map((opt) => (
                                    <div key={opt.id} className="space-y-2">
                                        <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.3em] uppercase ml-1">OPCIÓN_{opt.id.toUpperCase()}</label>
                                        <div className={`flex items-center gap-4 bg-black/40 rounded-sm p-1 border-2 transition-all group-focus-within:border-primary/50 ${opt.color}`}>
                                            <span className="w-12 h-12 bg-white/5 border-r border-white/10 flex items-center justify-center font-display font-black text-xl text-primary italic">{opt.label}</span>
                                            <input
                                                className="bg-transparent border-none focus:outline-none flex-1 font-display font-bold text-lg p-3 text-white placeholder:opacity-20 translate-y-[-1px]"
                                                value={q[`option_${opt.id}`]}
                                                onChange={(e) => updateQuestion(idx, `option_${opt.id}`, e.target.value)}
                                                placeholder={`Contenido de la opción ${opt.label}...`}
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
                                    className="w-full bg-surface-lowest border-2 border-white/5 rounded-sm p-4 text-on-surface font-display text-sm focus:border-primary focus:outline-none transition-colors"
                                    value={q.image_url || ''}
                                    onChange={(e) => updateQuestion(idx, 'image_url', e.target.value)}
                                    placeholder="https://ejemplo.com/imagen.jpg"
                                />
                                {q.image_url && (
                                    <div className="mt-4 rounded-sm overflow-hidden h-40 border border-white/5">
                                        <img src={q.image_url} alt="Vista previa" className="w-full h-full object-cover opacity-50" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col md:flex-row gap-8 pt-4">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-display font-black text-on-surface-variant tracking-[0.2em] uppercase ml-1">Respuesta Correcta</label>
                                    <select
                                        className="w-full bg-surface-container border-2 border-white/5 rounded-sm p-5 text-on-surface font-display font-black text-xl focus:border-primary focus:outline-none appearance-none cursor-pointer"
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
                        className="w-full py-12 border-2 border-dashed border-white/10 rounded-md flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all text-on-surface-variant hover:text-primary group"
                    >
                        <Plus size={40} className="group-hover:rotate-90 transition-transform" />
                        <span className="font-display font-black tracking-[0.4em] uppercase text-xs">Añadir Nueva Pregunta</span>
                    </button>

                    <div className="sticky bottom-8 z-50 pt-10">
                        <button
                            onClick={saveAll}
                            disabled={loading}
                            className="bg-primary w-full py-7 rounded-sm text-surface font-display font-black text-2xl tracking-[0.5em] flex items-center justify-center gap-6 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(236,72,153,0.3)] group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                            <Save size={24} className="relative z-10" />
                            <span className="relative z-10 italic">{loading ? 'ACTUALIZANDO_PROTOCOLO...' : 'GUARDAR_CONFIGURACIÓN'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-20" /> {/* Spacer */}
        </div>
    )
}
