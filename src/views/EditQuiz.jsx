import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    ArrowLeft, Save, Plus, Trash2, Volume2, ImageIcon,
    Sparkles, Loader2, ChevronLeft, ChevronRight, CheckCircle2,
    FileText, X, FileQuestion, MessageSquare, Layout, Search, Link as LinkIcon,
    Wand2, Play, RefreshCcw, Mic2, Crown
} from 'lucide-react'
import { toast } from 'sonner'
import { useAudioSync } from '../hooks/useAudioSync'
import { useAuth } from '../lib/AuthContext'
import PremiumModal from '../components/PremiumModal'

export default function EditQuiz() {
    const { user } = useAuth()
    const { quizId } = useParams()
    const navigate = useNavigate()
    const [quiz, setQuiz] = useState(null)
    const [questions, setQuestions] = useState([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showAiPanel, setShowAiPanel] = useState(false)
    const [showBulk, setShowBulk] = useState(false)
    const [isDirty, setIsDirty] = useState(false)

    // Hook unificado de Audio (TTS Engine 2.0)
    const { isGenerating: isSyncing, generateAudio, generateBatch, removeAudio } = useAudioSync(quizId)
    const [bulkText, setBulkText] = useState('')
    const questionInputRef = React.useRef(null)
    const [aiPrompt, setAiPrompt] = useState('')
    const [aiTopic, setAiTopic] = useState('')
    const [aiCount, setAiCount] = useState(5)
    const [ttsEnabled, setTtsEnabled] = useState(false)
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
            setQuiz({ title: '', description: '', visibility: 'public' })
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
            if (qData) setAiTopic(qData.title) // Pre-cargar tema con el título del quiz
            if (qsData && qsData.length > 0) {
                setQuestions(qsData.map(q => ({ ...q, last_tts_text: q.last_tts_text || '' })))
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
            id: 'temp-' + crypto.randomUUID(),
            quiz_id: quizId === 'new' ? null : quizId,
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
        if (q.id && !String(q.id).startsWith('temp-')) {
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
        if (!question.id || String(question.id).startsWith('temp-')) return toast.error('Guarda la pregunta antes de generar el audio')
        const url = await generateAudio(question)
        if (url) {
            updateQuestion(currentIdx, { audio_url: url, last_tts_text: question.text })
        }
    }

    const handleGenerateAllTTS = async () => {
        const toProcess = questions.filter(q => q.id && !String(q.id).startsWith('temp-') && (!q.audio_url || q.text !== q.last_tts_text))
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
                    title: quiz.title || 'Sin título',
                    description: quiz.description || '',
                    user_id: user?.id,
                    visibility: quiz.visibility || 'public'
                }).select().single()
                if (error) throw error
                currentQuizId = data.id
                // Actualizamos la URL sin recargar para no perder el estado
                window.history.replaceState(null, '', `/edit/${data.id}`)
            } else {
                const { error } = await supabase.from('quizzes').update({
                    title: quiz.title,
                    description: quiz.description,
                    visibility: quiz.visibility
                }).eq('id', quizId)
                if (error) throw error
            }

            // 2. Guardar Preguntas
            const nextQuestions = [...questions]
            for (let i = 0; i < nextQuestions.length; i++) {
                const q = nextQuestions[i]

                // Sanitizar para el esquema de la DB (Solo las columnas que existen en la tabla)
                const dbData = {
                    quiz_id: currentQuizId,
                    text: q.text || '',
                    option_a: q.option_a || '',
                    option_b: q.option_b || '',
                    option_c: q.option_c || '',
                    option_d: q.option_d || '',
                    correct_option: q.correct_option || 'A',
                    time_limit: q.time_limit || 10,
                    order_index: i,
                    image_url: q.image_url || '',
                    audio_url: q.audio_url || '',
                    last_tts_text: q.last_tts_text || '',
                    is_cover: q.is_cover || false
                }

                // Si el ID no existe o empieza con 'temp-', es una pregunta nueva
                const isNew = !q.id || String(q.id).startsWith('temp-')

                if (!isNew) {
                    // Actualizar existente (dbData no incluye id, usamos q.id en el eq)
                    const { error } = await supabase.from('questions').update(dbData).eq('id', q.id)
                    if (error) throw error
                } else {
                    // Insertar nueva (borramos ID temporal si lo tiene, para que Supabase genere el real)
                    const { data, error } = await supabase.from('questions').insert(dbData).select().single()
                    if (error) throw error
                    if (data) nextQuestions[i] = { ...data, last_tts_text: data.last_tts_text || '' }
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

    const handleIndividualTTS = async (idx) => {
        if (!user?.is_premium) {
            setIsPremiumModalOpen(true)
            return
        }
        const q = questions[idx];
        if (!q.text || q.text === '¿  ?') return toast.error('Ingresa texto válido');
        if (String(q.id).startsWith('temp-')) return toast.error('Guarda la pregunta antes de generar el audio');

        setLoading(true);
        const url = await generateAudio(q);
        if (url) {
            updateQuestion(idx, { audio_url: url, last_tts_text: q.text });
        }
        setLoading(false);
    };

    const handleAiGenerate = async () => {
        if (!aiTopic.trim()) return toast.error('Ingresa un tema para la IA')

        setLoading(true)
        const tid = toast.loading('Consultando oráculo de la IA...')
        try {
            // 1. Si es un quiz nuevo, necesitamos un ID real PARA EL AUDIO (evitar carpeta /new/)
            let activeQuizId = quizId;
            if (quizId === 'new') {
                const { data: nQuiz, error: nErr } = await supabase.from('quizzes').insert({
                    title: quiz.title || 'Nuevo Quiz IA',
                    description: quiz.description || '',
                    user_id: user?.id,
                    visibility: quiz.visibility || 'public'
                }).select().single();
                if (nErr) throw nErr;
                activeQuizId = nQuiz.id;
                window.history.replaceState(null, '', `/edit/${nQuiz.id}`);
                // No navegamos formalmente para no perder el estado local, pero actualizamos la ruta
            }

            const { data: { session } } = await supabase.auth.getSession();
            console.log('Invocando generate-quiz con sesión:', !!session);

            const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: {
                    topic: aiTopic,
                    description: quiz.description,
                    count: aiCount
                }
            })
            if (error) throw error

            // Limpiar marcador de posición si es el único y está vacío
            const baseQuestions = (questions.length === 1 && (questions[0].text === '¿  ?' || !questions[0].text.trim())) ? [] : questions;

            const newQuestions = data.map((q, i) => ({
                text: q.text || 'Sin título',
                option_a: q.option_a || '',
                option_b: q.option_b || '',
                option_c: q.option_c || '',
                option_d: q.option_d || '',
                correct_option: q.correct_option || 'A',
                image_url: q.image_url || '',
                id: 'temp-' + crypto.randomUUID(),
                quiz_id: activeQuizId,
                order_index: baseQuestions.length + i,
                audio_url: '',
                last_tts_text: q.text
            }))

            if (ttsEnabled) {
                toast.loading('Generando voces neuronales...', { id: tid })
                for (let i = 0; i < newQuestions.length; i++) {
                    try {
                        const url = await generateAudio(newQuestions[i], activeQuizId)
                        newQuestions[i].audio_url = url
                    } catch (e) {
                        console.error(`Error TTS en pregunta ${i}:`, e)
                    }
                }
            }

            setQuestions([...baseQuestions, ...newQuestions])
            setIsDirty(true)
            setShowAiPanel(false)
            setCurrentIdx(0) // Ir a la primera pregunta generada
            toast.success(`Protocolo completado: ${newQuestions.length} nuevas preguntas integradas`, { id: tid })
        } catch (e) {
            toast.error('Error IA: ' + e.message, { id: tid })
        } finally {
            setLoading(false)
        }
    }

    const handleOpenAiPanel = () => {
        if (!user?.is_premium) {
            setIsPremiumModalOpen(true)
            return;
        }
        if (!quiz?.title?.trim() || !quiz?.description?.trim()) {
            toast.error('Ingresa un Título y Descripción para darle contexto a la IA', {
                style: { background: '#ec4899', color: '#fff', border: 'none' }
            });
            return;
        }
        setAiTopic(quiz.title);
        setShowAiPanel(true);
        setShowBulk(false);
    }

    const handleOpenBulkPanel = () => {
        if (!quiz?.title?.trim() || !quiz?.description?.trim()) {
            toast.error('Ingresa un Título y Descripción para el contexto de la carga masiva', {
                style: { background: '#ec4899', color: '#fff', border: 'none' }
            });
            return;
        }
        setShowBulk(true);
        setShowAiPanel(false);
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
                                className={`bg-transparent border-none text-3xl font-display font-black text-white italic tracking-tight leading-none outline-none placeholder:text-white/20 w-full ${!quiz?.title?.trim() ? 'animate-pulse-input' : ''}`}
                                placeholder="Título de la trivia"
                            />
                            <input
                                value={quiz?.description || ''}
                                onChange={(e) => { setQuiz({ ...quiz, description: e.target.value }); setIsDirty(true); }}
                                className={`bg-transparent border-none text-sm font-bold text-white/40 tracking-[0.2em] outline-none placeholder:text-white/10 w-full mt-2 ${!quiz?.description?.trim() ? 'animate-pulse-input' : ''}`}
                                placeholder="Añade una descripción..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10 ml-8">
                        <button
                            onClick={() => { setQuiz({ ...quiz, visibility: 'public' }); setIsDirty(true); }}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${quiz?.visibility === 'public' ? 'bg-primary text-white' : 'text-white/20 hover:text-white/40'}`}
                        >
                            PÚBLICO
                        </button>
                        <button
                            onClick={() => {
                                if (!user?.is_premium && quiz?.visibility !== 'private') {
                                    setIsPremiumModalOpen(true)
                                    return;
                                }
                                setQuiz({ ...quiz, visibility: 'private' });
                                setIsDirty(true);
                            }}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${quiz?.visibility === 'private' ? 'bg-amber-500 text-black' : 'text-white/20 hover:text-white/40'} flex items-center gap-2`}
                        >
                            {(!user?.is_premium && quiz?.visibility !== 'private') && <Crown size={10} />}
                            PRIVADO
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botón Nueva Pregunta - MANUAL */}
                    <button onClick={addNewQuestion} className="group relative flex items-center gap-3 px-6 h-11 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/10 transition-all shadow-lg active:scale-95 overflow-hidden">
                        <Plus size={18} /> <span className="hidden md:inline">NUEVA PREGUNTA</span>
                        <div className="absolute top-0 right-0 bg-white/20 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter text-white opacity-50 group-hover:opacity-100 transition-opacity uppercase">MANUAL</div>
                    </button>

                    {/* Botón Carga Masiva - IA */}
                    <button
                        onClick={handleOpenBulkPanel}
                        className="group relative flex items-center gap-3 px-6 h-11 bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 rounded-lg text-xs font-bold transition-all overflow-hidden"
                    >
                        <FileText size={16} />
                        <span className="hidden md:inline">CARGA MASIVA</span>
                        <div className="absolute top-0.5 right-0.5 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter transition-opacity uppercase bg-cyan-500/20 text-cyan-400 opacity-50 group-hover:opacity-100">
                            IA
                        </div>
                    </button>

                    {/* Botón Generar IA - MAGIA */}
                    <button
                        onClick={handleOpenAiPanel}
                        className={`group relative flex items-center gap-3 px-6 h-11 border rounded-lg text-xs font-bold transition-all overflow-hidden ${user?.is_premium
                            ? 'bg-white/5 border-white/10 text-secondary hover:bg-white/10'
                            : 'bg-white/5 border-amber-500/20 text-amber-500/50 grayscale opacity-80 cursor-not-allowed'
                            }`}
                    >
                        {user?.is_premium ? <Sparkles size={16} /> : <Crown size={16} className="text-amber-500" />}
                        <span className="hidden md:inline">GENERAR IA</span>
                        <div className={`absolute top-0.5 right-0.5 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter transition-opacity uppercase ${user?.is_premium
                            ? 'bg-secondary/20 text-secondary opacity-50 group-hover:opacity-100'
                            : 'bg-amber-500/20 text-amber-500 opacity-100'
                            }`}>
                            {user?.is_premium ? 'Magia' : 'Premium'}
                        </div>
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

            {showAiPanel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl bg-surface border border-primary/30 p-8 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg">
                                    <Sparkles size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-display font-black text-white uppercase tracking-[0.2em]">Generación Mágica_IA</h3>
                                    <p className="text-[10px] text-primary font-black uppercase tracking-widest opacity-60 italic">Motor Gemini 1.5 Flash Online</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAiPanel(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                                <X size={20} className="opacity-40 hover:opacity-100" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-white/40 tracking-widest uppercase ml-1">TEMA DE LA TRIVIA</label>
                                <input
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary transition-all"
                                    placeholder="Ej: Historia de Chile, Ciencia Ficción..."
                                    value={aiTopic}
                                    onChange={e => setAiTopic(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/40 tracking-widest uppercase ml-1">CANTIDAD</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary transition-all text-center"
                                    value={aiCount}
                                    onChange={e => setAiCount(parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/40 tracking-widest uppercase ml-1 flex items-center gap-1">
                                    VOZ NEURONAL
                                    {!user?.is_premium && <Crown size={8} className="text-amber-500" />}
                                </label>
                                <div className="h-[54px] flex items-center justify-between px-4 bg-black/40 border border-white/10 rounded-xl">
                                    <Volume2 size={18} className={ttsEnabled ? "text-secondary" : "text-white/20"} />
                                    <button
                                        onClick={() => {
                                            if (!user?.is_premium) {
                                                setIsPremiumModalOpen(true)
                                                return
                                            }
                                            setTtsEnabled(!ttsEnabled)
                                        }}
                                        className={`w-10 h-5 rounded-full relative transition-all ${ttsEnabled ? 'bg-secondary' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${ttsEnabled ? 'left-5.5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleAiGenerate}
                            disabled={loading || !aiTopic}
                            className="w-full py-5 bg-primary rounded-xl font-black text-xs uppercase tracking-[0.3em] hover:bg-primary/80 transition-all flex items-center justify-center gap-3 disabled:opacity-30 shadow-lg shadow-primary/20 active:scale-95"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                            GENERAR NUEVAS PREGUNTAS
                        </button>
                    </div>
                </div>
            )}

            {showBulk && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl bg-surface border border-white/10 p-8 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <FileText size={18} /> IMPORTACIÓN MASIVA
                                </h3>
                            </div>
                            <button onClick={() => setShowBulk(false)}><X size={20} className="opacity-40 hover:opacity-100" /></button>
                        </div>

                        {/* Instrucciones */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="col-span-2 space-y-3">
                                <h4 className="text-[10px] font-black text-cyan-400 tracking-widest uppercase">Instrucciones de Uso:</h4>
                                <ol className="text-xs text-white/70 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                                    <li>Haz clic en <strong>Copiar Prompt IA</strong> para copiar las instrucciones.</li>
                                    <li>Abre tu IA favorita y pega el prompt copiado.</li>
                                    <li>Copia las <strong>líneas de texto</strong> que la IA te devolverá.</li>
                                    <li>Pega el resultado en la caja de abajo y presiona <strong>Importar</strong>.</li>
                                </ol>
                            </div>
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        const prompt = `Actúa como un experto en creación de contenido educativo. Genera una lista de 20 preguntas para una trivia titulada "${quiz?.title || 'Mi Trivia'}" sobre "${quiz?.description || 'temas variados'}".\n\nCada pregunta debe seguir estrictamente este formato de texto plano, separando los campos con el carácter pipe (|):\n\nPregunta | Opción A | Opción B | Opción C | Opción D | Letra de Opción Correcta (Solo la letra A, B, C o D) | URL de Imagen Relevante\n\nPor ejemplo:\n¿Cuál es la capital de Francia? | Madrid | París | Roma | Berlín | B | https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80\n\nREGLAS CRÍTICAS:\n1. Devuelve SOLO las 20 líneas de preguntas, una por línea.\n2. Sin introducciones, sin números al inicio, sin explicaciones.\n3. Asegúrate de que las URLs de imagen sean de Unsplash o sitios similares y que funcionen.\n4. Las opciones deben ser coherentes y solo una debe ser la correcta.\n5. Usa exactamente el formato: texto|a|b|c|d|letra_correcta|url_imagen`;
                                        navigator.clipboard.writeText(prompt);
                                        toast.success('Prompt original copiado al portapapeles');
                                    }}
                                    className="w-full py-2.5 bg-pink-500/10 text-pink-500 rounded-lg text-xs font-black uppercase tracking-wider border border-pink-500/20 hover:bg-pink-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={14} /> Copiar Prompt IA
                                </button>

                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button onClick={() => window.open('https://chatgpt.com/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase">ChatGPT</button>
                                    <button onClick={() => window.open('https://gemini.google.com/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase">Gemini</button>
                                    <button onClick={() => window.open('https://deepseek.com/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase">DeepSeek</button>
                                    <button onClick={() => window.open('https://claude.ai/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase">Claude</button>
                                </div>
                            </div>
                        </div>

                        <textarea
                            className="w-full h-48 bg-black/50 border border-white/10 rounded-xl p-6 text-xs font-mono outline-none resize-none leading-relaxed focus:border-cyan-500/50 transition-colors"
                            placeholder="Pega aquí el resultado de la IA...&#10;&#10;Ejemplo:&#10;¿Cuál es la capital de Francia? | Madrid | París | Roma | Berlín | B | https://images.unsplash.com/photo-150260..."
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                        />
                        <button
                            onClick={() => {
                                if (!bulkText.trim()) return;
                                const lines = bulkText.split('\n').filter(l => l.trim().includes('|'));
                                if (lines.length === 0) {
                                    toast.error('Formato inválido. Usa: Pregunta | A | B | C | D | Correcta');
                                    return;
                                }

                                // Limpiar marcador de posición si es el único y está vacío
                                const baseQuestions = (questions.length === 1 && (questions[0].text === '¿  ?' || !questions[0].text.trim())) ? [] : questions;

                                const newQs = lines.map((l, i) => {
                                    const parts = l.split('|').map(s => s.trim());
                                    const [t, a, b, c, d, corr, img] = parts;

                                    let cleanCorr = 'A';
                                    if (corr) {
                                        const match = corr.match(/[A-D]/i);
                                        if (match) cleanCorr = match[0].toUpperCase();
                                    }

                                    return {
                                        id: 'temp-' + crypto.randomUUID(),
                                        quiz_id: quizId,
                                        text: t || 'Nueva Pregunta',
                                        option_a: a || '',
                                        option_b: b || '',
                                        option_c: c || '',
                                        option_d: d || '',
                                        correct_option: cleanCorr,
                                        image_url: img || '',
                                        order_index: baseQuestions.length + i
                                    };
                                });

                                setQuestions([...baseQuestions, ...newQs]);
                                setShowBulk(false);
                                setCurrentIdx(0);
                                setBulkText('');
                                toast.success(`${newQs.length} preguntas importadas con éxito`);
                            }}
                            className="w-full mt-6 py-4 border border-white/10 hover:bg-white/5 rounded-lg text-[10px] font-black tracking-widest"
                        >
                            IMPORTAR PREGUNTAS
                        </button>
                    </div>
                </div>
            )}

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col pt-0 pb-24">
                <div className="w-full max-w-[1700px] mx-auto flex-1 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-500 overflow-hidden px-8 md:px-12 lg:px-24">
                    {questions.length > 0 && q ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch flex-1 overflow-y-auto h-full py-4 pr-2 custom-scrollbar">
                            <div className="lg:col-span-1 space-y-4 bg-white/5 p-6 lg:p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl relative z-10 flex flex-col justify-center h-full">
                                <div>
                                    <textarea
                                        ref={questionInputRef}
                                        value={q.text}
                                        onChange={(e) => updateQuestion(currentIdx, { text: e.target.value })}
                                        className="w-full bg-transparent text-xl lg:text-2xl font-black focus:outline-none resize-none placeholder:opacity-10 leading-tight transition-all"
                                        placeholder="Escribe la pregunta aquí..."
                                        rows={3}
                                    />
                                </div>

                                {/* TTS Engine 2.0 - Control de Sincronización */}
                                <div className="flex items-center justify-between p-3 bg-surface-lowest/60 rounded-2xl border border-white/5 backdrop-blur-md">
                                    <div className="flex items-center gap-3">
                                        {!q.audio_url ? (
                                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                                                <Mic2 size={12} className="text-red-500" />
                                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Sin Audio</span>
                                            </div>
                                        ) : q.text !== q.last_tts_text ? (
                                            <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 rounded-full border border-orange-500/20">
                                                <RefreshCcw size={12} className="text-orange-500 animate-pulse" />
                                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Desactualizado</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                                                <Volume2 size={12} className="text-green-500" />
                                                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Sincronizado</span>
                                            </div>
                                        )}
                                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] hidden md:block">TTS Engine 2.0</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {q.audio_url && (
                                            <button
                                                onClick={() => new Audio(q.audio_url).play()}
                                                className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center justify-center"
                                                title="Probar sonido"
                                            >
                                                <Play size={16} fill="currentColor" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleIndividualTTS(currentIdx)}
                                            disabled={loading || (q.audio_url && q.text === q.last_tts_text)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${q.audio_url && q.text === q.last_tts_text
                                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                                : 'bg-secondary text-on-secondary hover:bg-secondary/80 active:scale-95'
                                                }`}
                                        >
                                            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                                            {q.audio_url && q.text !== q.last_tts_text ? "RE-VINCULAR" : "VINCULAR VOZ"}
                                            {!user?.is_premium && <Crown size={10} />}
                                        </button>
                                    </div>
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
                            <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden h-full">
                                <div className="aspect-video lg:aspect-auto lg:flex-1 min-h-[250px] bg-surface-lowest/40 rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden relative group">
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
                                            id="media-url-input"
                                            className="flex-1 bg-transparent text-sm font-mono text-cyan-400 outline-none placeholder:text-cyan-400/20"
                                            value={q.image_url || ''}
                                            onChange={e => updateQuestion(currentIdx, { image_url: e.target.value })}
                                            placeholder="Introduce URL de imagen..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${quiz?.title} ${q.text}`)}&tbm=isch`, '_blank')} className="flex items-center justify-center gap-2 py-2.5 bg-white/5 rounded-xl text-[9px] font-black hover:bg-white/10 transition-all uppercase tracking-widest border border-white/5"><Search size={14} />Buscar</button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const input = document.getElementById('media-url-input');
                                                input?.focus();

                                                if (!navigator.clipboard || !navigator.clipboard.readText) {
                                                    toast.error('Pegado no soportado. Usa Ctrl+V');
                                                    return;
                                                }

                                                try {
                                                    const text = await navigator.clipboard.readText();
                                                    const cleanText = text?.trim();

                                                    if (cleanText) {
                                                        updateQuestion(currentIdx, { image_url: cleanText, media_type: 'image' });
                                                        toast.success('¡Contenido pegado!');
                                                    } else {
                                                        toast.error('El portapapeles está vacío');
                                                    }
                                                } catch (e) {
                                                    console.error('Clipboard error:', e);
                                                    toast.error('Bloqueado por el navegador. Usa Ctrl+V');
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl text-[9px] font-black hover:bg-cyan-500/20 transition-all uppercase tracking-widest border border-cyan-500/20"
                                        >
                                            <LinkIcon size={14} />Pegar
                                        </button>
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
                                    onClick={handleOpenBulkPanel}
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
                                        <p className="text-xs text-on-surface-variant leading-relaxed opacity-40">Pega tu documento o lista y estructúralo rápidamente.</p>
                                    </div>
                                </button>

                                {/* Opción 3: Generar con IA */}
                                <button
                                    onClick={handleOpenAiPanel}
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

            <footer className="fixed bottom-0 left-0 right-0 h-22 bg-black/90 backdrop-blur-xl border-t border-white/10 px-8 z-50">
                <div className="max-w-[1600px] mx-auto w-full h-full flex items-center justify-between gap-8">
                    {/* Navegación */}
                    {questions && questions.length > 0 ? (
                        <div className="flex items-center gap-4 shrink-0">
                            <button
                                onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                                disabled={currentIdx === 0}
                                className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 disabled:opacity-10 transition-all border border-white/5"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <div className="px-5 py-2.5 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4 text-center min-w-[110px] justify-center">
                                <span className="text-xl font-black text-pink-500">{currentIdx + 1}</span>
                                <div className="h-5 w-[1.5px] bg-white/10" />
                                <span className="text-[9px] font-black text-white/40 tracking-widest">{questions.length} TOTAL</span>
                            </div>
                            <button
                                onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
                                disabled={currentIdx === questions.length - 1}
                                className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 disabled:opacity-10 transition-all border border-white/5"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>
                    ) : null}

                    {/* Espaciador Central */}
                    <div className="flex-1"></div>

                    {/* Acciones de Quiz */}
                    <div className="flex items-center gap-4 shrink-0">
                        {questions && questions.length > 0 ? (
                            <button onClick={deleteCurrent} className="w-12 h-12 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-2xl transition-all border border-red-500/10" title="Eliminar pregunta">
                                <Trash2 size={22} />
                            </button>
                        ) : null}
                    </div>
                </div>
            </footer>

            <PremiumModal
                isOpen={isPremiumModalOpen}
                onClose={() => setIsPremiumModalOpen(false)}
            />
        </div >
    )
}
