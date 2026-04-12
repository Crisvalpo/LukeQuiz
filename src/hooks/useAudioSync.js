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
            const { data, error } = await supabase.functions.invoke('generate-tts', {
                body: { text: question.text, questionId: question.id, quizId: activeId }
            });

            if (error || data?.error_code) {
                const code = error?.status === 403 || data?.error_code === 'LIMIT_EXCEEDED' ? 'LIMIT' : 'ERROR';
                if (code === 'LIMIT') {
                    toast.error('Switch Killer Activo: Se ha alcanzado el 80% de la cuota gratuita de Google TTS.');
                } else {
                    toast.error(data?.message || 'Error al generar audio');
                }
                return null;
            }

            return data.publicUrl;
        } catch (err) {
            toast.error('Error de conexión con el motor de audio');
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
