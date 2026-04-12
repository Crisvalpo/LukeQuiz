import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    ArrowLeft, Save, Plus, Trash2, Volume2, ImageIcon,
    Sparkles, Loader2, ChevronLeft, ChevronRight, CheckCircle2,
    FileText, X, FileQuestion, MessageSquare, Layout, Search, Link as LinkIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { useAudioSync } from '../hooks/useAudioSync'

export default function EditQuiz() {
    const { quizId } = useParams()
    const navigate = useNavigate()
    const [quiz, setQuiz] = useState(null)
    const [questions, setQuestions] = useState([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [loading, setLoading] = useState(true)
    const [showAiPanel, setShowAiPanel] = useState(false)
    const [showBulk, setShowBulk] = useState(false)
    const [isDirty, setIsDirty] = useState(false)

    // Hook unificado de Audio (TTS Engine 2.0)
    const { isGenerating: isSyncing, generateAudio, generateBatch, removeAudio } = useAudioSync(quizId)
    const [bulkText, setBulkText] = useState('')
    const questionInputRef = React.useRef(null)
    const [aiPrompt, setAiPrompt] = useState('')
    const [showMediaSearch, setShowMediaSearch] = useState(false)

    useEffect(() => {
        console.log('EditQuiz Loaded - Version 1.1');
        fetchQuizData()
    }, [quizId])

    // Protección contra pérdida de datos
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handleSafeNavigate = (to) => {
        if (isDirty) {
            if (window.confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?')) {
                navigate(to);
            }
        } else {
            navigate(to);
        }
    };

    const fetchQuizData = async () => {
        if (quizId === 'new') {
            setQuiz({ title: '', description: '' })
            setQuestions([{
                quiz_id: null,
                text: '¿  ?',
                option_a: '',
                option_b: '',
                option_c: '',
                option_d: '',
                correct_option: 'A',
                image_url: '',
                media_type: 'none',
                order_index: 0,
                is_cover: true
            }])
            setLoading(false)
            setTimeout(() => {
                if (questionInputRef.current) {
                    questionInputRef.current.focus()
                    questionInputRef.current.setSelectionRange(2, 2)
                }
            }, 100)
            return
        }

        try {
            const { data: qData } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
            const { data: qsData } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index')
            setQuiz(qData)
            if (qsData && qsData.length > 0) {
                setQuestions(qsData.map(q => ({ ...q, last_tts_text: q.text })))
            } else {
                addNewQuestion()
            }
        } catch (e) {
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    const updateQuestion = (idx, updates) => {
        setIsDirty(true)
        setQuestions(prev => {
            const newQs = [...prev]
            newQs[idx] = { ...newQs[idx], ...updates }
            return newQs
        })
    }

    const addNewQuestion = () => {
        setIsDirty(true)
        const newQ = {
            quiz_id: quizId,
            text: '¿  ?',
            option_a: '',
            option_b: '',
            option_c: '',
            option_d: '',
            correct_option: 'A',
            image_url: '',
            media_type: 'none',
            order_index: questions.length,
            is_cover: false
        }
        setQuestions([...questions, newQ])
        setCurrentIdx(questions.length)

        setTimeout(() => {
            if (questionInputRef.current) {
                questionInputRef.current.focus()
                questionInputRef.current.setSelectionRange(2, 2)
            }
        }, 10)
    }

    const deleteCurrent = async () => {
        if (questions.length <= 1) return toast.error('No puedes eliminar la única pregunta')
        const q = questions[currentIdx]

        setIsDirty(true)
        if (q.id) {
            // Limpia el audio antes de borrar el registro (Garantiza mantenimiento)
            if (q.audio_url) await removeAudio(q.id)

            const { error } = await supabase.from('questions').delete().eq('id', q.id)
            if (error) return toast.error('Error al eliminar pregunta')
        }

        const newQuestions = questions.filter((_, i) => i !== currentIdx)
        setQuestions(newQuestions)
        setCurrentIdx(Math.max(0, currentIdx - 1))
        toast.success('Pregunta eliminada')
    }

    const handleGenerateTTS = async (question) => {
        if (!question.id) return toast.error('Guarda la pregunta antes de generar el audio')
        const url = await generateAudio(question)
        if (url) {
            updateQuestion(currentIdx, { audio_url: url, last_tts_text: question.text })
        }
    }

    const handleGenerateAllTTS = async () => {
        const toProcess = questions.filter(q => q.id && (!q.audio_url || q.text !== q.last_tts_text))
        if (toProcess.length === 0) return toast.success('Todo el contenido ya tiene audio')

        const results = await generateBatch(toProcess)
        if (results.length > 0) {
            setQuestions(prev => prev.map(q => {
                const match = results.find(r => r.id === q.id)
                return match ? { ...q, ...match } : q
            }))
        }
    }

    const saveAll = async () => {
        setLoading(true)
        const tid = toast.loading('Guardando...')
        try {
            let currentQuizId = quizId

            // 1. Guardar/Actualizar Quiz
            if (quizId === 'new') {
                const { data, error } = await supabase.from('quizzes').insert({
                    title: quiz.title || 'Nueva Trivia',
                    description: quiz.description
                }).select().single()
                if (error) throw error
                currentQuizId = data.id
                setQuiz(data)
            } else {
                const { error } = await supabase.from('quizzes').update({
                    title: quiz.title,
                    description: quiz.description
                }).eq('id', quizId)
                if (error) throw error
            }

            // 2. Guardar Preguntas
            const nextQuestions = [...questions]
            for (let i = 0; i < nextQuestions.length; i++) {
                const q = nextQuestions[i]
                const { last_tts_text, created_at, ...dbData } = q
                dbData.quiz_id = currentQuizId // Asegurar relación

                if (q.id) {
                    const { id, ...updateData } = dbData
                    const { error } = await supabase.from('questions').update(updateData).eq('id', q.id)
                    if (error) throw error
                } else {
                    const { data, error } = await supabase.from('questions').insert(dbData).select().single()
                    if (error) throw error
                    if (data) nextQuestions[i] = { ...data, last_tts_text: '' }
                }
            }

            setQuestions(nextQuestions)
            setIsDirty(false)
            toast.success('Cuestionario guardado', { id: tid })

            // Redirigir si era nuevo
            if (quizId === 'new') {
                navigate(`/edit/${currentQuizId}`, { replace: true })
            }
        } catch (e) {
            console.error(e)
            toast.error('Error al guardar: ' + e.message, { id: tid })
        } finally {
            setLoading(false)
        }
    }

    const handleAiGenerate = async () => {
        setLoading(true)
        const tid = toast.loading('Generando preguntas...')
        try {
            const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: { prompt: aiPrompt, quizId }
            })
            if (error) throw error
            const newQuestions = data.questions.map((q, i) => ({ ...q, order_index: questions.length + i }))
            setQuestions([...questions, ...newQuestions])
            setIsDirty(true)
            setShowAiPanel(false)
            toast.success('Preguntas generadas', { id: tid })
        } catch (e) {
            toast.error('Error IA: ' + e.message, { id: tid })
        } finally {
            setLoading(false)
        }
    }

    if (loading && !quiz) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-pink-500" size={48} /></div>

    const q = questions[currentIdx]

    return (
        <div className="h-screen bg-surface-lowest text-white font-sans overflow-hidden flex flex-col relative pt-24">
            <header className="fixed top-0 left-0 right-0 h-24 bg-black/80 backdrop-blur-md border-b border-white/10 px-12 md:px-20 flex items-center justify-between z-50 shadow-2xl transition-all">
                <div className="flex items-center gap-6">
                    <button onClick={() => handleSafeNavigate('/')} className="p-3 hover:bg-white/10 rounded-full transition-all"><ArrowLeft size={22} /></button>
                    <div className="flex flex-col flex-1 max-w-xl group/meta">
                        <div className="flex flex-col border-l-2 border-white/5 pl-6 mt-1 hover:border-white/20 transition-all">
                            <input
                                value={quiz?.title || ''}
                                onChange={(e) => { setQuiz({ ...quiz, title: e.target.value }); setIsDirty(true); }}
                                className="bg-transparent border-none text-xl font-display font-black text-white italic tracking-tight leading-none outline-none placeholder:text-white/20 w-full"
                                placeholder="Título de la trivia"
                            />
                            <input
                                value={quiz?.description || ''}
                                onChange={(e) => { setQuiz({ ...quiz, description: e.target.value }); setIsDirty(true); }}
                                className="bg-transparent border-none text-[11px] font-bold text-white/40 tracking-[0.2em] outline-none placeholder:text-white/10 w-full mt-2"
                                placeholder="Añade una descripción..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botón Nueva Pregunta - MANUAL */}
                    <button onClick={addNewQuestion} className="group relative flex items-center gap-3 px-6 h-11 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/10 transition-all shadow-lg active:scale-95 overflow-hidden">
                        <Plus size={18} /> <span className="hidden md:inline">NUEVA PREGUNTA</span>
                        <div className="absolute top-0 right-0 bg-white/20 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter text-white opacity-50 group-hover:opacity-100 transition-opacity uppercase">MANUAL</div>
                    </button>

                    {/* Botón Carga Masiva - IA */}
                    <button onClick={() => setShowBulk(!showBulk)} className="group relative flex items-center gap-3 px-6 h-11 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-all text-white/60 overflow-hidden">
                        <FileText size={16} /> <span className="hidden md:inline">CARGA MASIVA</span>
                        <div className="absolute top-0 right-0 bg-cyan-500/20 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity uppercase">IA</div>
                    </button>

                    {/* Botón Generar IA - MAGIA */}
                    <button onClick={() => setShowAiPanel(!showAiPanel)} className="group relative flex items-center gap-3 px-6 h-11 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-all text-secondary overflow-hidden">
                        <Sparkles size={16} /> <span className="hidden md:inline">GENERAR IA</span>
                        <div className="absolute top-0 right-0 bg-secondary/20 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter text-secondary opacity-50 group-hover:opacity-100 transition-opacity uppercase">Magia</div>
                    </button>

                    {/* Botón Guardar - ICON ONLY */}
                    <button
                        onClick={saveAll}
                        title="GUARDAR TODO"
                        className="flex items-center justify-center w-11 h-11 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-90 shrink-0"
                    >
                        <Save size={20} />
                    </button>
                </div>
            </header>

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col pt-0 pb-24">
                {showAiPanel && (
                    <div className="absolute top-4 inset-x-8 z-[60] bg-surface border border-primary/30 p-8 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-300 max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-pink-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={18} /> GENERADOR IA</h3>
                            <button onClick={() => setShowAiPanel(false)}><X size={20} className="opacity-40 hover:opacity-100" /></button>
                        </div>
                        <input className="w-full bg-black border border-white/10 rounded-lg p-5 text-sm outline-none mb-4" placeholder="Ej: Crea 5 preguntas sobre la historia de Roma..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                        <button onClick={handleAiGenerate} className="w-full py-4 bg-pink-600 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-pink-500 transition-all">Generar nuevas preguntas</button>
                    </div>
                )}

                {showBulk && (
                    <div className="absolute top-4 inset-x-8 z-[60] bg-surface border border-white/10 p-8 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-300 max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><FileText size={18} /> IMPORTACIÓN MASIVA</h3>
                            <button onClick={() => setShowBulk(false)}><X size={20} className="opacity-40 hover:opacity-100" /></button>
                        </div>
                        <textarea className="w-full h-48 bg-black border border-white/10 rounded-lg p-6 text-xs font-mono outline-none resize-none leading-relaxed" placeholder="Pregunta | A | B | C | D | Correcta | URL" value={bulkText} onChange={e => setBulkText(e.target.value)} />
                        <button
                            onClick={() => {
                                const lines = bulkText.split('\n').filter(l => l.trim().includes('|'))
                                const newQs = lines.map((l, i) => {
                                    const [t, a, b, c, d, corr, img] = l.split('|').map(s => s.trim())
                                    return { quiz_id: quizId, text: t, option_a: a, option_b: b, option_c: c, option_d: d, correct_option: corr?.toUpperCase() || 'A', image_url: img || '', order_index: questions.length + i }
                                })
                                setQuestions([...questions, ...newQs]); setShowBulk(false); setBulkText('')
                            }}
                            className="w-full mt-6 py-4 border border-white/10 hover:bg-white/5 rounded-lg text-[10px] font-black tracking-widest"
                        >
                            IMPORTAR PREGUNTAS
                        </button>
                    </div>
                )}

                <div className="w-full max-w-[1700px] mx-auto flex-1 flex flex-col justify-start animate-in fade-in zoom-in-95 duration-500 overflow-hidden px-8 md:px-12 lg:px-24">
                    {questions.length > 0 && q ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start flex-1 overflow-y-auto h-full pt-4 pb-12 pr-2 custom-scrollbar">
                            <div className="lg:col-span-1 space-y-8 bg-white/5 p-8 lg:p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl relative z-10 flex flex-col justify-center min-h-[400px]">
                                <div>
                                    <textarea
                                        ref={questionInputRef}
                                        value={q.text}
                                        onChange={(e) => updateQuestion(currentIdx, { text: e.target.value })}
                                        className="w-full bg-transparent text-2xl lg:text-3xl font-black focus:outline-none resize-none placeholder:opacity-10 leading-tight transition-all"
                                        placeholder="Escribe la pregunta aquí..."
                                        rows={3}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-2 mt-4">
                                    {['A', 'B', 'C', 'D'].map(opt => (
                                        <div key={opt} className={`flex items-center gap-3 p-1 pr-2 rounded-xl border-2 transition-all group ${q.correct_option === opt ? 'border-pink-500 bg-pink-500/10 shadow-[0_0_20px_rgba(236,72,153,0.1)]' : 'border-white/5 bg-white/5 hover:border-white/20'}`}>
                                            <button
                                                onClick={() => updateQuestion(currentIdx, { correct_option: opt })}
                                                className={`w-10 h-10 flex items-center justify-center rounded-lg text-base font-black transition-all shrink-0 ${q.correct_option === opt ? 'bg-pink-500 text-black scale-105' : 'bg-white/5 text-white/20 group-hover:bg-white/10'}`}
                                            >
                                                {opt}
                                            </button>
                                            <input
                                                value={q[`option_${opt.toLowerCase()}`]}
                                                onChange={(e) => updateQuestion(currentIdx, { [`option_${opt.toLowerCase()}`]: e.target.value })}
                                                className="w-full bg-transparent text-sm font-bold focus:outline-none"
                                                placeholder={`Respuesta ${opt}...`}
                                            />
                                            <button
                                                onClick={() => updateQuestion(currentIdx, { correct_option: opt })}
                                                className={`flex items-center justify-center transition-all shrink-0 ${q.correct_option === opt ? 'text-pink-500' : 'text-white/10 hover:text-white/30'}`}
                                                title="Marcar como correcta"
                                            >
                                                <CheckCircle2 size={22} className={q.correct_option === opt ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Media & Herramientas */}
                            <div className="lg:col-span-1 h-full flex flex-col gap-4 py-4 overflow-hidden">
                                <div className="flex-1 bg-surface-lowest/40 rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden relative group">
                                    <div className="absolute top-4 left-4 z-20 flex gap-2">
                                        <span className="text-[9px] font-black text-cyan-400 tracking-widest bg-cyan-400/10 border border-cyan-400/20 px-3 py-1.5 rounded-full uppercase">VISTA PREVIA</span>
                                    </div>
                                    <div className="absolute top-4 right-4 z-20">
                                        <button
                                            onClick={() => {
                                                const newQs = questions.map((item, i) => ({ ...item, is_cover: i === currentIdx }))
                                                setQuestions(newQs)
                                                toast.success('Esta imagen será la portada del quiz')
                                            }}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all backdrop-blur-md ${q.is_cover ? 'bg-pink-500/90 text-white border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:border-white/30'}`}
                                            title="Usar como portada del quiz"
                                        >
                                            <Layout size={14} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">{q.is_cover ? 'PORTADA ACTIVA' : 'USAR COMO PORTADA'}</span>
                                        </button>
                                    </div>
                                    {q.image_url ? (
                                        <img src={q.image_url} alt="" className="absolute inset-0 w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-700" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 opacity-10">
                                            <ImageIcon size={80} strokeWidth={1} />
                                            <span className="text-xs font-black tracking-widest">SIN IMAGEN</span>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-cyan-400/10 rounded-xl text-cyan-400"><ImageIcon size={20} /></div>
                                        <input
                                            className="flex-1 bg-transparent text-sm font-mono text-cyan-400 outline-none placeholder:text-cyan-400/20"
                                            value={q.image_url || ''}
                                            onChange={e => updateQuestion(currentIdx, { image_url: e.target.value })}
                                            placeholder="Introduce URL de imagen..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${quiz?.title} ${q.text}`)}&tbm=isch`, '_blank')} className="flex items-center justify-center gap-2 py-2.5 bg-white/5 rounded-xl text-[9px] font-black hover:bg-white/10 transition-all uppercase tracking-widest border border-white/5"><Search size={14} />Buscar</button>
                                        <button onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t.startsWith('http')) updateQuestion(currentIdx, { image_url: t, media_type: 'image' }) } catch (e) { } }} className="flex items-center justify-center gap-2 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl text-[9px] font-black hover:bg-cyan-500/20 transition-all uppercase tracking-widest border border-cyan-500/20"><LinkIcon size={14} />Pegar</button>
                                        <button onClick={() => updateQuestion(currentIdx, { image_url: '', media_type: 'none' })} className="flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-500 rounded-xl text-[9px] font-black hover:bg-red-500/20 transition-all uppercase tracking-widest border border-red-500/10"><Trash2 size={14} />Limpiar</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto">
                            <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center gap-8 border-l border-white/10 pl-8">
                                    <div className="flex flex-col">
                                        <h2 className="text-xl font-display font-black text-white italic tracking-tight leading-none uppercase">Configuración</h2>
                                    </div>
                                </div>
                                <h2 className="text-5xl font-black text-white italic tracking-tighter mb-4">
                                    Configurar<span className="text-primary not-italic">Trivia</span>
                                </h2>
                                <p className="text-on-surface-variant font-bold uppercase tracking-[0.4em] text-xs opacity-40">Elige un método para cargar preguntas</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full">
                                {/* Opción 1: Manual */}
                                <button
                                    onClick={addNewQuestion}
                                    className="group relative bg-surface-lowest/40 backdrop-blur-xl border border-white/5 rounded-4xl p-10 flex flex-col items-center text-center gap-6 hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
                                >
                                    <div className="absolute top-6 right-6">
                                        <span className="text-[9px] font-black px-3 py-1 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-widest">MANUAL</span>
                                    </div>
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 group-hover:text-white group-hover:bg-white/10 transition-all">
                                        <Plus size={40} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-white tracking-tight">Carga Tradicional</h3>
                                        <p className="text-xs text-on-surface-variant leading-relaxed opacity-40">Crea tus propios desafíos paso a paso con control total.</p>
                                    </div>
                                </button>

                                {/* Opción 2: Masiva */}
                                <button
                                    onClick={() => setShowBulk(true)}
                                    className="group relative bg-surface-lowest/40 backdrop-blur-xl border border-white/5 rounded-4xl p-10 flex flex-col items-center text-center gap-6 hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
                                >
                                    <div className="absolute top-6 right-6">
                                        <span className="text-[9px] font-black px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 tracking-widest uppercase">Prompt IA</span>
                                    </div>
                                    <div className="w-20 h-20 rounded-2xl bg-cyan-500/5 flex items-center justify-center text-cyan-400/40 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-all">
                                        <FileText size={40} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-white tracking-tight">Carga Masiva</h3>
                                        <p className="text-xs text-on-surface-variant leading-relaxed opacity-40">Pega tu documento o lista y el motor IA la estructurará.</p>
                                    </div>
                                </button>

                                {/* Opción 3: Generar con IA */}
                                <button
                                    onClick={() => setShowAiPanel(true)}
                                    className="group relative bg-surface-lowest/40 backdrop-blur-xl border border-primary/20 rounded-4xl p-10 flex flex-col items-center text-center gap-6 hover:bg-primary/5 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl shadow-primary/10"
                                >
                                    <div className="absolute top-6 right-6">
                                        <span className="text-[9px] font-black px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 tracking-widest uppercase animate-pulse">IA GENERADOR</span>
                                    </div>
                                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-all">
                                        <Sparkles size={40} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-white tracking-tight">Generar con IA</h3>
                                        <p className="text-xs text-on-surface-variant leading-relaxed opacity-60">Deja que la Inteligencia Artificial cree una trivia por ti.</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main >

            <footer className="fixed bottom-0 left-0 right-0 h-28 bg-black/90 backdrop-blur-xl border-t border-white/10 px-8 z-50">
                <div className="max-w-[1600px] mx-auto w-full h-full flex items-center justify-between gap-8">
                    {/* Navegación */}
                    {questions && questions.length > 0 ? (
                        <div className="flex items-center gap-4 shrink-0">
                            <button
                                onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                                disabled={currentIdx === 0}
                                className="w-14 h-14 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 disabled:opacity-10 transition-all border border-white/5"
                            >
                                <ChevronLeft size={28} />
                            </button>
                            <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4 text-center min-w-[120px] justify-center">
                                <span className="text-2xl font-black text-pink-500">{currentIdx + 1}</span>
                                <div className="h-6 w-[1.5px] bg-white/10" />
                                <span className="text-[10px] font-black text-white/40 tracking-widest">{questions.length} TOTAL</span>
                            </div>
                            <button
                                onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
                                disabled={currentIdx === questions.length - 1}
                                className="w-14 h-14 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 disabled:opacity-10 transition-all border border-white/5"
                            >
                                <ChevronRight size={28} />
                            </button>
                        </div>
                    ) : null}

                    {/* Espaciador Central */}
                    <div className="flex-1"></div>

                    {/* Acciones de Quiz */}
                    <div className="flex items-center gap-4 shrink-0">
                        {questions && questions.length > 0 ? (
                            <button onClick={deleteCurrent} className="w-14 h-14 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-2xl transition-all border border-red-500/10" title="Eliminar pregunta">
                                <Trash2 size={24} />
                            </button>
                        ) : null}
                    </div>
                </div>
            </footer>
        </div >
    )
}
