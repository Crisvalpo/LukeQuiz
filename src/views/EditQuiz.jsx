import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { searchImages } from '../lib/imageSearch'
import { Loader2, Sparkles } from 'lucide-react'
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

// Tiempo de inactividad tras el último cambio antes de autoguardar
const AUTOSAVE_DELAY_MS = 1200

const isPlaceholderText = (t) => !t || ['¿  ?', '¿ ?', '¿?'].includes(t.trim()) || !t.trim()

const isBlankQuestion = (q) => {
    if (!q) return true
    const isTextBlank = isPlaceholderText(q.text)
    const hasOptions = !!(q.option_a?.trim() || q.option_b?.trim() || q.option_c?.trim() || q.option_d?.trim())
    const hasImage = !!q.image_url?.trim()
    const hasAudio = !!q.audio_url?.trim()
    return isTextBlank && !hasOptions && !hasImage && !hasAudio
}

const newBlankQuestion = (orderIndex, isCover = false) => ({
    // UUID real desde el inicio: el mismo id vive en local y en la BD
    id: crypto.randomUUID(),
    text: '¿  ?',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    image_url: '',
    media_type: 'none',
    audio_url: '',
    last_tts_text: '',
    order_index: orderIndex,
    is_cover: isCover
})

// Normaliza ids heredados con prefijo "temp-" (versiones anteriores)
const normalizeId = (id) => {
    if (!id) return crypto.randomUUID()
    const s = String(id)
    return s.startsWith('temp-') ? s.slice(5) : s
}

export default function EditQuiz() {
    const { user } = useAuth()
    const { quizId } = useParams()
    const navigate = useNavigate()
    const [activeQuizId, setActiveQuizId] = useState(quizId === 'new' ? null : quizId)
    const [quiz, setQuiz] = useState(null)
    const [questions, setQuestions] = useState([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false)
    const [loading, setLoading] = useState(true)          // carga inicial + IA
    const [saving, setSaving] = useState(false)           // guardado en curso
    const [saveError, setSaveError] = useState(null)      // último error de guardado
    const [ttsBusy, setTtsBusy] = useState(false)         // generación de voz en curso
    const touchStartRef = useRef(0)
    const touchEndRef = useRef(0)
    const [showAiPanel, setShowAiPanel] = useState(false)
    const [showBulk, setShowBulk] = useState(false)
    const [isDirty, setIsDirty] = useState(false)

    // ── Refs: siempre el estado MÁS RECIENTE (evita closures obsoletos en async) ──
    const quizRef = useRef(quiz)
    const questionsRef = useRef(questions)
    const activeQuizIdRef = useRef(activeQuizId)
    const isDirtyRef = useRef(false)
    const versionRef = useRef(0)                 // +1 por cada cambio local
    const saveInFlightRef = useRef(null)         // promesa del guardado en curso
    const autosaveTimerRef = useRef(null)
    const deletedIdsRef = useRef(new Set())      // preguntas a borrar en la BD
    const justCreatedIdRef = useRef(null)        // evita recargar al crear un quiz nuevo

    quizRef.current = quiz
    questionsRef.current = questions
    activeQuizIdRef.current = activeQuizId
    isDirtyRef.current = isDirty

    // Hook unificado de Audio (TTS Engine 2.0) — usa el id REAL, nunca "new"
    const { generateAudio } = useAudioSync(activeQuizId)
    const questionInputRef = useRef(null)
    const titleInputRef = useRef(null)

    // Setters que actualizan estado y ref a la vez (para usar el valor nuevo de inmediato)
    const commitQuestions = (updater) => {
        const next = typeof updater === 'function' ? updater(questionsRef.current) : updater
        questionsRef.current = next
        setQuestions(next)
        return next
    }
    const commitQuiz = (updater) => {
        const next = typeof updater === 'function' ? updater(quizRef.current) : updater
        quizRef.current = next
        setQuiz(next)
        return next
    }

    // ═══════════════════════════ GUARDADO ═══════════════════════════

    const buildQuestionRows = (qs, workingQuizId) => qs.map((q, i) => ({
        id: normalizeId(q.id),
        quiz_id: workingQuizId,
        text: q.text || '',
        question: q.text || '',
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
        is_cover: !!q.is_cover
    }))

    /**
     * Única ruta de guardado. Serializada: si ya hay un guardado en curso,
     * devuelve esa misma promesa y, al terminar, vuelve a guardar si hubo
     * cambios mientras tanto. Nunca sobrescribe el estado local con la
     * respuesta del servidor (así no se pierde lo que escribes mientras guarda).
     */
    const saveAll = async ({ silent = true } = {}) => {
        if (!quizRef.current?.title?.trim()) {
            if (!silent) checkTitleRequired()
            return false
        }
        if (saveInFlightRef.current) return saveInFlightRef.current

        clearTimeout(autosaveTimerRef.current)

        const run = (async () => {
            const versionAtStart = versionRef.current
            const q = quizRef.current
            const qs = questionsRef.current
            setSaving(true)

            try {
                let workingQuizId = activeQuizIdRef.current
                const coverQ = qs.find(x => x.is_cover && x.image_url) || qs.find(x => x.image_url)
                const coverImage = coverQ?.image_url || q?.cover_image || ''

                const quizPayload = {
                    title: q.title.trim(),
                    description: q?.description?.trim() || '',
                    visibility: q?.visibility || 'public',
                    is_public_for_live: q?.is_public_for_live ?? true,
                    creator_handle: q?.creator_handle || user?.email?.split('@')[0] || '@comunidad',
                    category: q?.category || 'General',
                    cover_image: coverImage
                }

                // 1. Quiz: crear o actualizar
                if (!workingQuizId) {
                    const { data, error } = await supabase
                        .from('quizzes')
                        .insert({ ...quizPayload, user_id: user?.id })
                        .select()
                        .single()
                    if (error) throw error
                    workingQuizId = data.id
                    activeQuizIdRef.current = data.id
                    justCreatedIdRef.current = data.id
                    setActiveQuizId(data.id)
                    // Solo tomamos id/autor del servidor; lo demás sigue siendo lo local
                    commitQuiz(prev => ({ ...prev, id: data.id, user_id: data.user_id }))
                    navigate(`/edit/${data.id}`, { replace: true })
                } else {
                    const { error } = await supabase
                        .from('quizzes')
                        .update({ ...quizPayload, updated_at: new Date().toISOString() })
                        .eq('id', workingQuizId)
                    if (error) throw error
                }

                // 2. Preguntas: upsert completo (ids estables generados en cliente)
                const rows = buildQuestionRows(qs, workingQuizId)
                if (rows.length > 0) {
                    const { error } = await supabase.from('questions').upsert(rows)
                    if (error) throw error
                }

                // 3. Borrados pendientes (después del upsert para que nada "resucite")
                const toDelete = [...deletedIdsRef.current]
                if (toDelete.length > 0) {
                    const { error } = await supabase.from('questions').delete().in('id', toDelete)
                    if (error) throw error
                    toDelete.forEach(id => deletedIdsRef.current.delete(id))
                }

                // Si no hubo cambios durante el guardado, quedamos limpios
                if (versionRef.current === versionAtStart) {
                    isDirtyRef.current = false
                    setIsDirty(false)
                }
                setSaveError(null)
                toast.dismiss('save-error')
                if (!silent) toast.success('¡Trivia guardada!', { id: 'save-ok', duration: 1500 })
                return true
            } catch (e) {
                console.error('Error al guardar:', e)
                const msg = e?.message || 'Error de conexión'
                setSaveError(msg)
                toast.error('No se pudo guardar: ' + msg, {
                    id: 'save-error',
                    duration: 6000,
                    action: { label: 'Reintentar', onClick: () => saveAll({ silent: false }) }
                })
                return false
            } finally {
                setSaving(false)
                saveInFlightRef.current = null
                // Hubo cambios mientras guardábamos → otra vuelta
                if (versionRef.current !== versionAtStart) scheduleAutosave(300)
            }
        })()

        saveInFlightRef.current = run
        return run
    }

    const scheduleAutosave = (delay = AUTOSAVE_DELAY_MS) => {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = setTimeout(() => {
            if (isDirtyRef.current) saveAll()
        }, delay)
    }

    // Marca cambio local + programa autoguardado
    const markDirty = () => {
        versionRef.current += 1
        isDirtyRef.current = true
        setIsDirty(true)
        scheduleAutosave()
    }

    // Guardar ya (sin esperar el debounce)
    const flushSave = () => {
        clearTimeout(autosaveTimerRef.current)
        return isDirtyRef.current ? saveAll() : Promise.resolve(true)
    }

    // ═══════════════════════════ CICLO DE VIDA ═══════════════════════════

    useEffect(() => {
        // Si acabamos de crear este quiz, el estado local ya es el correcto: no recargar
        if (quizId !== 'new' && quizId === justCreatedIdRef.current) return
        fetchQuizData()
        if (quizId !== 'new') setActiveQuizId(quizId)
    }, [quizId])

    // Aviso al cerrar/recargar si hay cambios sin guardar
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirtyRef.current || saveInFlightRef.current) {
                flushSave()
                e.preventDefault()
                e.returnValue = 'Tienes cambios sin guardar.'
                return e.returnValue
            }
        }
        // Al ocultar la pestaña, guardar de inmediato
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') flushSave()
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            document.removeEventListener('visibilitychange', handleVisibility)
            clearTimeout(autosaveTimerRef.current)
        }
    }, [])

    // Al cambiar de pregunta: guardar al instante y enfocar
    useEffect(() => {
        flushSave()
        if (questionInputRef.current && quizRef.current?.title?.trim()) {
            questionInputRef.current.focus()
        }
    }, [currentIdx])

    const handleSafeNavigate = async (to) => {
        if (isDirtyRef.current || saveInFlightRef.current) {
            const tid = toast.loading('Guardando cambios...')
            const ok = await (saveInFlightRef.current || saveAll())
            // Si el guardado en curso terminó pero quedaron cambios, una vuelta más
            const ok2 = isDirtyRef.current ? await saveAll() : ok
            toast.dismiss(tid)
            if (!ok2 && quizRef.current?.title?.trim()) {
                if (!window.confirm('No se pudieron guardar los últimos cambios. ¿Salir de todas formas?')) return
            }
        }
        navigate(to)
    }

    const checkTitleRequired = () => {
        if (!quizRef.current?.title?.trim()) {
            toast.error('Define el título del quiz antes de continuar', {
                id: 'title-required',
                icon: '⚠️',
                duration: 3500,
                style: {
                    background: '#1e1136',
                    color: '#f59e0b',
                    border: '1px solid #f59e0b',
                    fontWeight: 'bold',
                    fontSize: '13px'
                }
            })
            if (titleInputRef.current) {
                titleInputRef.current.focus()
                titleInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            return false
        }
        return true
    }

    const fetchQuizData = async () => {
        if (quizId === 'new') {
            commitQuiz({ title: '', description: '', visibility: 'public' })
            commitQuestions([newBlankQuestion(0, true)])
            setActiveQuizId(null)
            setIsDirty(false)
            setLoading(false)
            setTimeout(() => titleInputRef.current?.focus(), 100)
            return
        }

        setLoading(true)
        try {
            const { data: qData, error: qErr } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
            if (qErr || !qData) throw qErr || new Error('Trivia no encontrada')

            // Verificación de Autoría (Seguridad Crítica)
            const isAdmin = user?.email === 'cristianluke@gmail.com'
            if (user && qData.user_id !== user.id && !isAdmin) {
                toast.error('No tienes permiso para editar esta trivia')
                navigate('/')
                return
            }

            const { data: qsData } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index')
            commitQuiz(qData)
            if (qsData && qsData.length > 0) {
                // Auto-sanitizar preguntas fantasma previas si hay preguntas reales presentes
                const hasRealQuestions = qsData.some(q => !isBlankQuestion(q))
                let validQuestions = qsData
                if (hasRealQuestions) {
                    const ghosts = qsData.filter(q => isBlankQuestion(q))
                    if (ghosts.length > 0) {
                        ghosts.forEach(g => {
                            if (g.id) deletedIdsRef.current.add(normalizeId(g.id))
                        })
                        validQuestions = qsData.filter(q => !isBlankQuestion(q)).map((q, idx) => ({
                            ...q,
                            order_index: idx
                        }))
                        markDirty() // Al sincronizar o guardar, se eliminarán definitivamente de Supabase
                    }
                }

                if (validQuestions.length > 0) {
                    commitQuestions(validQuestions.map(q => ({ ...q, last_tts_text: q.last_tts_text || '' })))
                } else {
                    commitQuestions([newBlankQuestion(0, true)])
                }
            } else {
                commitQuestions([newBlankQuestion(0, true)])
            }
            setIsDirty(false)
        } catch (e) {
            console.error('Error al cargar trivia:', e)
            toast.error('Error al cargar datos', {
                action: { label: 'Reintentar', onClick: () => fetchQuizData() }
            })
        } finally {
            setLoading(false)
        }
    }

    // ═══════════════════════════ EDICIÓN ═══════════════════════════

    const updateQuestion = (idx, updates) => {
        commitQuestions(prev => {
            const next = [...prev]
            if (!next[idx]) return prev
            next[idx] = { ...next[idx], ...updates }
            return next
        })
        markDirty()
    }

    // Actualización por id (segura tras operaciones async: el índice pudo cambiar)
    const updateQuestionById = (id, updates) => {
        commitQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))
        markDirty()
    }

    const handleQuizChange = (updatedQuiz) => {
        commitQuiz(updatedQuiz)
        markDirty()
    }

    const addNewQuestion = () => {
        if (!checkTitleRequired()) return
        const len = questionsRef.current.length
        commitQuestions(prev => [...prev, newBlankQuestion(prev.length)])
        markDirty()
        setCurrentIdx(len)

        setTimeout(() => {
            if (questionInputRef.current) {
                questionInputRef.current.focus()
                questionInputRef.current.setSelectionRange(2, 2)
            }
        }, 10)
    }

    const deleteCurrent = async () => {
        const qs = questionsRef.current
        if (qs.length <= 1) return toast.error('No puedes eliminar la única pregunta')
        const q = qs[currentIdx]
        if (!q) return

        if (!window.confirm(`¿Eliminar la pregunta ${currentIdx + 1}?`)) return

        // El borrado en BD se hace dentro de saveAll (después del upsert)
        deletedIdsRef.current.add(normalizeId(q.id))

        let reindexed = qs.filter((_, i) => i !== currentIdx).map((item, idx) => ({ ...item, order_index: idx }))

        // Si la eliminada era la portada, transferir portada a la primera con imagen
        if (q.is_cover && reindexed.length > 0) {
            const coverIdx = Math.max(0, reindexed.findIndex(item => item.image_url))
            reindexed = reindexed.map((item, i) => ({ ...item, is_cover: i === coverIdx }))
            commitQuiz(prev => ({ ...prev, cover_image: reindexed[coverIdx].image_url || '' }))
        }

        commitQuestions(reindexed)
        setCurrentIdx(prev => Math.max(0, Math.min(prev, reindexed.length - 1)))
        markDirty()
        const ok = await flushSave()
        if (ok) toast.success('Pregunta eliminada', { duration: 1500 })
    }

    // Portada: actualización local + guardado inmediato
    const handleSetCover = async (idx, explicitImageUrl = null) => {
        const targetQ = questionsRef.current[idx]
        if (!targetQ) return

        const imageUrl = explicitImageUrl || targetQ.image_url
        if (!imageUrl) {
            toast.error('Asigna primero una imagen a esta pregunta para usarla como portada', { icon: '🖼️' })
            return
        }

        commitQuestions(prev => prev.map((item, i) => ({
            ...item,
            is_cover: i === idx,
            image_url: (i === idx && explicitImageUrl) ? explicitImageUrl : item.image_url
        })))
        commitQuiz(prev => ({ ...prev, cover_image: imageUrl }))
        markDirty()

        const ok = await flushSave()
        if (ok) toast.success('Portada guardada', { id: 'cover-ok', duration: 1500 })
    }

    // Imagen de pregunta: actualización local + guardado inmediato
    const handleUpdateQuestionImage = (idx, imageUrl) => {
        const cleanUrl = imageUrl?.trim() || ''
        updateQuestion(idx, { image_url: cleanUrl, media_type: cleanUrl ? 'image' : 'none' })
        flushSave()
    }

    // Voz individual: ya NO exige guardar antes; si el quiz no existe aún, lo crea
    const handleIndividualTTS = async (idx) => {
        if (!user?.is_premium) {
            setIsPremiumModalOpen(true)
            return
        }
        const q = questionsRef.current[idx]
        if (!q || isPlaceholderText(q.text)) return toast.error('Ingresa texto válido')

        setTtsBusy(true)
        const tid = toast.loading('Generando voz...')
        try {
            // Necesitamos un quiz real para la carpeta del audio
            if (!activeQuizIdRef.current) {
                const ok = await saveAll()
                if (!ok) throw new Error('No se pudo crear la trivia')
            }
            const qid = normalizeId(q.id)
            const url = await generateAudio({ ...q, id: qid }, activeQuizIdRef.current)
            if (!url) throw new Error('El generador de voz no respondió')

            // Cache-buster: el archivo se sobrescribe con el mismo nombre al re-vincular
            const freshUrl = `${url.split('?')[0]}?v=${Date.now()}`
            updateQuestionById(q.id, { audio_url: freshUrl, last_tts_text: q.text })
            await flushSave()
            toast.success('Voz vinculada y guardada', { id: tid, duration: 1500 })
        } catch (e) {
            toast.error('Error de voz: ' + (e?.message || 'desconocido'), { id: tid })
        } finally {
            setTtsBusy(false)
        }
    }

    // ═══════════════════════════ IA / CARGA MASIVA ═══════════════════════════

    /**
     * Descarta preguntas en blanco/placeholder y marca sus IDs para eliminarlas en Supabase
     */
    const cleanAndDiscardBlankQuestions = (qs) => {
        const kept = []
        for (const q of qs) {
            if (isBlankQuestion(q)) {
                if (q.id) {
                    deletedIdsRef.current.add(normalizeId(q.id))
                }
            } else {
                kept.push(q)
            }
        }
        return kept
    }

    const handleAiGenerate = async ({ topic, count, ttsEnabled, description }) => {
        if (!topic.trim()) return toast.error('Ingresa un tema para la IA')

        setLoading(true)
        const tid = toast.loading('Consultando oráculo de la IA...')
        try {
            const { data: sessionData } = await supabase.auth.getSession()
            const session = sessionData?.session

            let data = null
            let lastApiError = null
            try {
                const apiRes = await fetch('/api/generate-quiz', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
                    },
                    body: JSON.stringify({ topic, description, count })
                })
                if (apiRes.ok) {
                    data = await apiRes.json()
                } else {
                    const errPayload = await apiRes.json().catch(() => ({}))
                    lastApiError = errPayload.error || `Error HTTP ${apiRes.status}`
                    console.warn('Fallo /api/generate-quiz, probando Edge Function fallback:', lastApiError)
                }
            } catch (errApi) {
                lastApiError = errApi.message
                console.warn('Excepción al conectar con /api/generate-quiz:', errApi)
            }

            if (!data) {
                const { data: edgeData, error: edgeError } = await supabase.functions.invoke('generate-quiz', {
                    body: { topic, description, count },
                    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
                })
                if (edgeError) throw new Error(lastApiError || edgeError.message || 'Error al generar preguntas con IA')
                data = edgeData
            }
            if (!Array.isArray(data) || data.length === 0) throw new Error('La IA no devolvió preguntas')

            const baseQuestions = cleanAndDiscardBlankQuestions(questionsRef.current)
            const hasCover = baseQuestions.some(q => q.is_cover)

            const newQuestions = data.map((q, i) => ({
                ...newBlankQuestion(baseQuestions.length + i, !hasCover && i === 0),
                text: q.text || 'Sin título',
                option_a: q.option_a || '',
                option_b: q.option_b || '',
                option_c: q.option_c || '',
                option_d: q.option_d || '',
                correct_option: q.correct_option || 'A'
            }))

            // Imágenes REALES por keyword vía Wikimedia / Wikipedia
            toast.loading('Buscando imágenes para las preguntas...', { id: tid })
            await Promise.all(newQuestions.map(async (nq, i) => {
                const kw = data[i]?.keyword || nq.text
                try {
                    const imgData = await searchImages(kw, 1)
                    if (imgData?.results?.[0]?.url) {
                        nq.image_url = imgData.results[0].url
                        nq.media_type = 'image'
                    }
                } catch (e) {
                    console.error(`Sin imagen para "${kw}":`, e)
                }
            }))

            // Insertar en el estado y guardar (crea el quiz si no existía)
            commitQuestions([...baseQuestions, ...newQuestions])
            markDirty()
            setShowAiPanel(false)
            setCurrentIdx(baseQuestions.length)
            toast.loading('Guardando preguntas...', { id: tid })
            const ok = await saveAll()
            if (!ok) throw new Error('Las preguntas se generaron pero no se pudieron guardar')

            if (ttsEnabled) {
                for (let i = 0; i < newQuestions.length; i++) {
                    toast.loading(`Generando voces ${i + 1}/${newQuestions.length}...`, { id: tid })
                    try {
                        const url = await generateAudio(newQuestions[i], activeQuizIdRef.current)
                        if (url) {
                            updateQuestionById(newQuestions[i].id, {
                                audio_url: `${url.split('?')[0]}?v=${Date.now()}`,
                                last_tts_text: newQuestions[i].text
                            })
                        }
                    } catch (e) {
                        console.error(`Error TTS en pregunta ${i}:`, e)
                    }
                }
                await flushSave()
            }

            toast.success(`¡Trivia generada y guardada! (${newQuestions.length} preguntas)`, { id: tid })
        } catch (e) {
            toast.error('Error IA: ' + e.message, { id: tid })
        } finally {
            setLoading(false)
        }
    }

    const handleOpenAiPanel = () => {
        if (!checkTitleRequired()) return
        if (!user?.is_premium) {
            setIsPremiumModalOpen(true)
            return
        }
        setShowAiPanel(true)
        setShowBulk(false)
    }

    const handleBulkImport = async (newParsedQuestions) => {
        if (!newParsedQuestions || newParsedQuestions.length === 0) return

        const baseQuestions = cleanAndDiscardBlankQuestions(questionsRef.current)
        const hasCover = baseQuestions.some(q => q.is_cover)

        const imported = newParsedQuestions.map((q, i) => ({
            ...newBlankQuestion(baseQuestions.length + i, !hasCover && i === 0),
            ...q,
            id: crypto.randomUUID(),
            order_index: baseQuestions.length + i
        }))

        commitQuestions([...baseQuestions, ...imported])
        markDirty()
        setShowBulk(false)
        setCurrentIdx(baseQuestions.length)

        // Resolver palabras clave → fotos reales (Wikimedia / Wikipedia).
        const conKeyword = imported.filter(q => q.image_keyword && !q.image_url)
        if (conKeyword.length > 0) {
            const tid = toast.loading(`Buscando ${conKeyword.length} imágenes...`)
            const found = {}
            await Promise.all(conKeyword.map(async (q) => {
                try {
                    const imgData = await searchImages(q.image_keyword, 1)
                    if (imgData?.results?.[0]?.url) found[q.id] = imgData.results[0].url
                } catch (e) {
                    console.error(`Sin imagen para "${q.image_keyword}":`, e)
                }
            }))
            const n = Object.keys(found).length
            if (n > 0) {
                // Merge por id: respeta cualquier edición hecha mientras se buscaban
                commitQuestions(prev => prev.map(p => found[p.id] && !p.image_url
                    ? { ...p, image_url: found[p.id], media_type: 'image' }
                    : p))
                markDirty()
                toast.success(`${imported.length} preguntas importadas · ${n} con imagen`, { id: tid })
            } else {
                toast.warning('Preguntas importadas (no se encontraron imágenes)', { id: tid })
            }
        } else {
            toast.success(`¡${imported.length} preguntas importadas con éxito!`)
        }
        await flushSave()
    }

    const handleOpenBulkPanel = () => {
        if (!checkTitleRequired()) return
        setShowBulk(true)
        setShowAiPanel(false)
    }

    if (loading && !quiz) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-pink-500" size={48} /></div>

    const q = questions[currentIdx]

    const handleTouchStart = (e) => {
        touchStartRef.current = e.targetTouches[0].clientX
    }

    const handleTouchEnd = (e) => {
        touchEndRef.current = e.changedTouches[0].clientX
        const diff = touchStartRef.current - touchEndRef.current
        if (Math.abs(diff) > 50) {
            if (diff > 0) { // Swipe Left -> Next
                if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1)
            } else { // Swipe Right -> Prev
                if (currentIdx > 0) setCurrentIdx(currentIdx - 1)
            }
        }
    }

    return (
        <div
            className="h-screen bg-[#240b49] text-white font-sans overflow-hidden flex flex-col relative pt-[12vh] md:pt-28"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Doodle Wallpaper Background */}
            <div
                className="fixed inset-0 pointer-events-none bg-cover bg-center opacity-25 md:opacity-30"
                style={{ backgroundImage: `url('/bg-doodle.jpg')` }}
            />
            {/* Ambient Lighting & Kahoot-Style Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none bg-gradient-to-b from-[#240b49]/60 via-[#1a0836]/75 to-[#120428]/90">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-24 w-80 h-80 bg-secondary/15 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl" />
            </div>

            <EditorHeader
                quiz={quiz}
                user={user}
                onQuizChange={handleQuizChange}
                onSafeNavigate={handleSafeNavigate}
                onAddNewQuestion={() => addNewQuestion()}
                onOpenBulkPanel={handleOpenBulkPanel}
                onOpenAiPanel={handleOpenAiPanel}
                onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
                titleInputRef={titleInputRef}
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
                {/* Interceptor visual amigable si aún no se ha definido el título */}
                {!quiz?.title?.trim() && (
                    <div
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            checkTitleRequired()
                        }}
                        className="absolute inset-0 z-40 bg-[#0d0417]/75 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none transition-all animate-in fade-in duration-300"
                    >
                        <div className="bg-[#180830]/95 border-2 border-amber-500/50 p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg flex flex-col items-center animate-in zoom-in-95 duration-300 pointer-events-auto">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 ring-4 ring-amber-500/10">
                                <Sparkles size={28} className="animate-pulse" />
                            </div>
                            <span className="text-[10px] font-black tracking-[0.25em] text-amber-400 uppercase mb-1">
                                Paso 1 Obligatorio
                            </span>
                            <h3 className="text-xl md:text-2xl font-display font-black text-white italic tracking-tight mb-2">
                                Define el título del quiz antes de continuar
                            </h3>
                            <p className="text-white/60 text-xs md:text-sm font-medium mb-6 max-w-sm">
                                Escribe el nombre de tu trivia en la barra superior. Con solo el título podrás crear preguntas, usar la IA o cargar masivamente.
                            </p>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    checkTitleRequired()
                                }}
                                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
                            >
                                Escribir Título Arriba ✍️
                            </button>
                        </div>
                    </div>
                )}
                <div className="w-full max-w-[1700px] mx-auto flex-1 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-500 overflow-hidden px-[4vw] md:px-12 lg:px-24">
                    {questions.length > 0 && q ? (
                        <QuestionEditor
                            question={q}
                            currentIdx={currentIdx}
                            questions={questions}
                            loading={loading || ttsBusy}
                            user={user}
                            quiz={quiz}
                            onUpdateQuestion={updateQuestion}
                            onUpdateQuestionImage={handleUpdateQuestionImage}
                            onSetQuestions={(qs) => { commitQuestions(qs); markDirty() }}
                            onSetCover={handleSetCover}
                            onHandleIndividualTTS={handleIndividualTTS}
                            questionInputRef={questionInputRef}
                        />
                    ) : (
                        <QuestionMethodPicker
                            onAddNewManual={() => addNewQuestion()}
                            onOpenBulk={handleOpenBulkPanel}
                            onOpenAi={handleOpenAiPanel}
                        />
                    )}
                </div>
            </main>

            <NavigationBar
                currentIdx={currentIdx}
                totalQuestions={questions.length}
                isDirty={isDirty}
                saving={saving}
                saveError={saveError}
                loading={loading}
                onPrev={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                onNext={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                onAddNewQuestion={() => addNewQuestion()}
                onOpenBulkPanel={handleOpenBulkPanel}
                onOpenAiPanel={handleOpenAiPanel}
                onDelete={deleteCurrent}
                onSave={() => saveAll({ silent: false })}
            />

            <PremiumModal
                isOpen={isPremiumModalOpen}
                onClose={() => setIsPremiumModalOpen(false)}
            />
        </div>
    )
}
