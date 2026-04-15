import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAudioSync } from '../hooks/useAudioSync'
import { useAuth } from '../lib/AuthContext'
import PremiumModal from '../components/PremiumModal'
import EditorHeader from '../components/editor/EditorHeader'
import NavigationBar from '../components/editor/NavigationBar'
import QuestionEditor from '../components/editor/QuestionEditor'
import QuestionMethodPicker from '../components/editor/QuestionMethodPicker'
import AiPanel from '../components/editor/AiPanel'
import BulkImportPanel from '../components/editor/BulkImportPanel'

export default function EditQuiz() {
    const { user } = useAuth()
    const { quizId } = useParams()
    const navigate = useNavigate()
    const [activeQuizId, setActiveQuizId] = useState(quizId === 'new' ? null : quizId)
    const [quiz, setQuiz] = useState(null)
    const [questions, setQuestions] = useState([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const touchStartRef = React.useRef(0)
    const touchEndRef = React.useRef(0)
    const [showAiPanel, setShowAiPanel] = useState(false)
    const [showBulk, setShowBulk] = useState(false)
    const [isDirty, setIsDirty] = useState(false)

    // Hook unificado de Audio (TTS Engine 2.0)
    const { isGenerating: isSyncing, generateAudio, generateBatch, removeAudio } = useAudioSync(quizId)
    const questionInputRef = React.useRef(null)
    const [showMediaSearch, setShowMediaSearch] = useState(false)

    useEffect(() => {
        console.log('EditQuiz Loaded - Version 1.2');
        fetchQuizData()
        if (quizId !== 'new') setActiveQuizId(quizId);
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

            // Verificación de Autoría (Seguridad Crítica)
            if (qData && user && qData.user_id !== user.id) {
                toast.error('No tienes permiso para editar esta trivia');
                navigate('/');
                return;
            }

            const { data: qsData } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index')
            setQuiz(qData)
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
            quiz_id: activeQuizId,
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

    const handleQuizChange = (updatedQuiz) => {
        setQuiz(updatedQuiz);
        setIsDirty(true);
    };

    const handleGenerateTTS = async (question) => {
        if (!question.id || String(question.id).startsWith('temp-')) return toast.error('Guarda la pregunta antes de generar el audio')
        const url = await generateAudio(question)
        if (url) {
            updateQuestion(currentIdx, { audio_url: url, last_tts_text: question.text })
        }
    }

    const handleGenerateAllTTS = async () => {
        const toProcess = questions.filter(q =>
            q.id &&
            !String(q.id).startsWith('temp-') &&
            q.text &&
            q.text.trim() !== '¿  ?' &&
            (!q.audio_url || q.text !== q.last_tts_text)
        )
        if (toProcess.length === 0) return toast.success('Todo el contenido válido ya tiene audio')

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
            let workingQuizId = activeQuizId

            // 1. Guardar/Actualizar Quiz
            if (!workingQuizId) {
                const { data, error } = await supabase.from('quizzes').insert({
                    title: quiz.title || 'Sin título',
                    description: quiz.description || '',
                    user_id: user?.id,
                    visibility: quiz.visibility || 'public'
                }).select().single()
                if (error) throw error
                workingQuizId = data.id
                setActiveQuizId(data.id)
                // Actualizamos la URL sin recargar para no perder el estado
                window.history.replaceState(null, '', `/edit/${data.id}`)
            } else {
                const { error } = await supabase.from('quizzes').update({
                    title: quiz.title,
                    description: quiz.description,
                    visibility: quiz.visibility
                }).eq('id', workingQuizId)
                if (error) throw error
            }

            // 2. Guardar Preguntas (Bulk Upsert)
            const questionsToUpsert = questions.map((q, i) => {
                const dbData = {
                    quiz_id: workingQuizId,
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

                // Si no es un ID temporal, lo incluimos para que Supabase haga UPDATE
                if (q.id && !String(q.id).startsWith('temp-')) {
                    dbData.id = q.id
                }

                return dbData
            })

            const { data: upsertData, error: upsertError } = await supabase
                .from('questions')
                .upsert(questionsToUpsert)
                .select()

            if (upsertError) throw upsertError

            if (upsertData) {
                setQuestions(upsertData.map(q => ({ ...q, last_tts_text: q.last_tts_text || '' })))
            }

            setIsDirty(false)
            toast.success('Cuestionario guardado', { id: tid })

            // Redirigir si era nuevo en la URL original
            if (quizId === 'new') {
                navigate(`/edit/${workingQuizId}`, { replace: true })
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

    const handleAiGenerate = async ({ topic, count, ttsEnabled, description }) => {
        if (!topic.trim()) return toast.error('Ingresa un tema para la IA')

        setLoading(true)
        const tid = toast.loading('Consultando oráculo de la IA...')
        try {
            // 1. Si es un quiz nuevo, necesitamos un ID real PARA EL AUDIO (evitar carpeta /new/)
            let workingQuizId = activeQuizId;
            if (!workingQuizId) {
                const { data: nQuiz, error: nErr } = await supabase.from('quizzes').insert({
                    title: quiz.title || 'Nuevo Quiz IA',
                    description: quiz.description || '',
                    user_id: user?.id,
                    visibility: quiz.visibility || 'public'
                }).select().single();
                if (nErr) throw nErr;
                workingQuizId = nQuiz.id;
                setActiveQuizId(nQuiz.id);
                window.history.replaceState(null, '', `/edit/${nQuiz.id}`);
                // No navegamos formalmente para no perder el estado local, pero actualizamos la ruta
            }

            const { data: { session } } = await supabase.auth.getSession();
            console.log('Invocando generate-quiz con sesión:', !!session);

            const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: {
                    topic: topic,
                    description: description,
                    count: count
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
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
                quiz_id: workingQuizId,
                order_index: baseQuestions.length + i,
                audio_url: '',
                last_tts_text: q.text
            }))

            if (ttsEnabled) {
                toast.loading('Generando voces neuronales...', { id: tid })
                for (let i = 0; i < newQuestions.length; i++) {
                    try {
                        const url = await generateAudio(newQuestions[i], workingQuizId)
                        newQuestions[i].audio_url = url
                    } catch (e) {
                        console.error(`Error TTS en pregunta ${i}:`, e)
                    }
                }
            }

            setQuestions([...baseQuestions, ...newQuestions])
            setIsDirty(true)
            setShowAiPanel(false)
            setCurrentIdx(baseQuestions.length) // Ir a la primera pregunta generada
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
        setShowAiPanel(true);
        setShowBulk(false);
    }

    const handleBulkImport = (newParsedQuestions) => {
        // Limpiar marcador de posición si es el único y está vacío
        const baseQuestions = (questions.length === 1 && (questions[0].text === '¿  ?' || !questions[0].text.trim())) ? [] : questions;

        const questionsWithMetadata = newParsedQuestions.map((q, i) => ({
            ...q,
            id: 'temp-' + crypto.randomUUID(),
            quiz_id: activeQuizId,
            order_index: baseQuestions.length + i
        }));

        setQuestions([...baseQuestions, ...questionsWithMetadata]);
        setShowBulk(false);
        setCurrentIdx(baseQuestions.length); // Ir a la primera de las nuevas
        setIsDirty(true);
        toast.success(`${questionsWithMetadata.length} preguntas importadas con éxito`);
    };

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

    const handleTouchStart = (e) => {
        touchStartRef.current = e.targetTouches[0].clientX;
    }

    const handleTouchEnd = (e) => {
        touchEndRef.current = e.changedTouches[0].clientX;
        const diff = touchStartRef.current - touchEndRef.current;
        if (Math.abs(diff) > 50) {
            if (diff > 0) { // Swipe Left -> Next
                if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
            } else { // Swipe Right -> Prev
                if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
            }
        }
    }

    return (
        <div
            className="h-screen bg-surface-lowest text-white font-sans overflow-hidden flex flex-col relative pt-[12vh] md:pt-28"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <EditorHeader
                quiz={quiz}
                user={user}
                onQuizChange={handleQuizChange}
                onSafeNavigate={handleSafeNavigate}
                onAddNewQuestion={addNewQuestion}
                onOpenBulkPanel={handleOpenBulkPanel}
                onOpenAiPanel={handleOpenAiPanel}
                onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
            />

            <AiPanel
                isOpen={showAiPanel}
                onClose={() => setShowAiPanel(false)}
                onGenerate={handleAiGenerate}
                initialTopic={quiz?.title}
                initialDescription={quiz?.description}
                isGenerating={loading}
                isPremium={user?.is_premium}
                openPremiumModal={() => setIsPremiumModalOpen(true)}
            />

            <BulkImportPanel
                isOpen={showBulk}
                onClose={() => setShowBulk(false)}
                onImport={handleBulkImport}
                quizTitle={quiz?.title}
                quizDescription={quiz?.description}
            />

            <main className="flex-1 relative z-10 overflow-hidden flex flex-col pt-0 pb-[10vh] md:pb-24">
                <div className="w-full max-w-[1700px] mx-auto flex-1 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-500 overflow-hidden px-[4vw] md:px-12 lg:px-24">
                    {questions.length > 0 && q ? (
                        <QuestionEditor
                            question={q}
                            currentIdx={currentIdx}
                            questions={questions}
                            loading={loading}
                            user={user}
                            quiz={quiz}
                            onUpdateQuestion={updateQuestion}
                            onSetQuestions={setQuestions}
                            onHandleIndividualTTS={handleIndividualTTS}
                            questionInputRef={questionInputRef}
                        />
                    ) : (
                        <QuestionMethodPicker
                            onAddNewManual={addNewQuestion}
                            onOpenBulk={handleOpenBulkPanel}
                            onOpenAi={handleOpenAiPanel}
                        />
                    )}
                </div>
            </main >

            <NavigationBar
                currentIdx={currentIdx}
                totalQuestions={questions.length}
                isDirty={isDirty}
                onPrev={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                onNext={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                onAddNewQuestion={addNewQuestion}
                onDelete={deleteCurrent}
                onSave={saveAll}
            />

            <PremiumModal
                isOpen={isPremiumModalOpen}
                onClose={() => setIsPremiumModalOpen(false)}
            />
        </div >
    )
}
