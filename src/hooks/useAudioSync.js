import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export function useAudioSync(quizId) {
    const [isGenerating, setIsGenerating] = useState(false);

    const generateAudio = async (question, targetQuizId = null) => {
        if (!question.text) {
            toast.error('La pregunta no tiene texto');
            return null;
        }

        const activeId = targetQuizId || quizId;

        try {
            // 1. Intentar endpoint nativo del servidor
            const apiRes = await fetch('/api/generate-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: question.text, questionId: question.id, quizId: activeId })
            });

            if (apiRes.ok) {
                const apiData = await apiRes.json();
                if (apiData?.publicUrl) return apiData.publicUrl;
            }
        } catch (apiErr) {
            console.warn('Endpoint /api/generate-tts no disponible, probando Edge Function:', apiErr);
        }

        try {
            // 2. Fallback a Edge Function
            const { data, error } = await supabase.functions.invoke('generate-tts', {
                body: { text: question.text, questionId: question.id, quizId: activeId }
            });

            if (!error && data?.publicUrl) {
                return data.publicUrl;
            }

            if (data?.error_code === 'LIMIT_EXCEEDED') {
                toast.error('Switch Killer Activo: Se ha alcanzado el límite de cuota.');
            }
            return null;
        } catch (err) {
            console.warn('Error en generador de audio:', err);
            return null;
        }
    };

    const removeAudio = async (questionId, targetQuizId = null) => {
        if (!questionId) return;
        const activeId = targetQuizId || quizId;
        const fileName = `${activeId}/${questionId}.mp3`;
        const { error } = await supabase.storage.from('quiz-audio').remove([fileName]);
        if (error) console.error('Error removing audio from storage:', error);
    };

    const generateBatch = async (questionsToProcess) => {
        if (questionsToProcess.length === 0) return [];

        setIsGenerating(true);
        const tid = toast.loading(`Iniciando generación (0/${questionsToProcess.length})...`);
        const results = [];

        try {
            for (let i = 0; i < questionsToProcess.length; i++) {
                const q = questionsToProcess[i];
                toast.loading(`Generando audio ${i + 1}/${questionsToProcess.length}...`, { id: tid });

                const url = await generateAudio(q);
                if (!url) break; // Detener si falla uno (ej: por cuota)

                results.push({ id: q.id, audio_url: url, last_tts_text: q.text });
            }
            if (results.length > 0) {
                toast.success(`Sincronización de audio (${results.length}) completada`, { id: tid });
            } else {
                toast.dismiss(tid);
            }
        } catch (err) {
            toast.error('Error en el procesamiento por lotes', { id: tid });
        } finally {
            setIsGenerating(false);
        }

        return results;
    };

    return {
        isGenerating,
        generateAudio,
        generateBatch,
        removeAudio
    };
}
