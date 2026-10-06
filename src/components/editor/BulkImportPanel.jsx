import React, { useState, useMemo } from 'react';
import { FileText, X, Trash2, Plus, Sparkles, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { parseBulkQuestions } from '../../utils/bulkQuestionParser';

const BulkImportPanel = ({
    isOpen,
    onClose,
    onImport,
    quizTitle = '',
    quizDescription = ''
}) => {
    const [bulkText, setBulkText] = useState('');
    const [bulkCount, setBulkCount] = useState(5);
    const [showPreviewList, setShowPreviewList] = useState(false);

    // Detección automática en tiempo real de preguntas parseadas
    const detectedQuestions = useMemo(() => {
        return parseBulkQuestions(bulkText);
    }, [bulkText]);

    if (!isOpen) return null;

    const handleCopyPrompt = () => {
        const prompt = `Actúa como un creador experto de trivias interactivas. Genera una lista de ${bulkCount} preguntas para un concurso titulado "${quizTitle || 'Mi Trivia'}" sobre "${quizDescription || 'temas variados'}".

Cada pregunta debe seguir este formato de texto plano, separando los campos con el carácter pipe (|):

Pregunta | Opción A | Opción B | Opción C | Opción D | Opción Correcta (Solo la letra A, B, C o D) | Palabra clave de imagen

Por ejemplo:
¿Cuál es la capital de Francia? | Madrid | París | Roma | Berlín | B | torre eiffel
¿Qué planeta es conocido como el planeta rojo? | Venus | Marte | Júpiter | Saturno | B | planeta marte

REGLAS CRÍTICAS:
1. Devuelve EXACTAMENTE las ${bulkCount} líneas de preguntas, una por línea.
2. Sin introducciones, sin explicaciones ni notas finales.
3. Las preguntas deben ser breves y dinámicas (máximo 14 palabras).
4. La última columna es 1 a 3 palabras clave del tema para buscar una foto real (ej: "torre eiffel", "sistema solar").
5. Formato exacto: Pregunta | A | B | C | D | Correcta | Palabra_clave`;

        navigator.clipboard.writeText(prompt);
        toast.success(`Prompt para ${bulkCount} preguntas copiado al portapapeles`);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setBulkText(text);
            const parsed = parseBulkQuestions(text);
            if (parsed.length > 0) {
                toast.success(`${parsed.length} preguntas detectadas automáticamente`);
            } else {
                toast.info('Texto pegado. Verifica el formato si no se detectan preguntas');
            }
        } catch (err) {
            toast.error('Error al acceder al portapapeles. Pega usando Ctrl+V');
        }
    };

    const handleProcessImport = () => {
        if (detectedQuestions.length === 0) {
            toast.error('No se detectaron preguntas válidas en el texto pegado');
            return;
        }

        onImport(detectedQuestions);
        setBulkText('');
        toast.success(`¡${detectedQuestions.length} preguntas importadas con éxito!`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#16062d] border border-white/10 p-6 md:p-8 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex justify-between items-center mb-5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">
                                IMPORTACIÓN MASIVA INTELIGENTE
                            </h3>
                            <p className="text-[11px] text-white/40 font-medium">
                                Soporta tablas Markdown, pipes (|), Excel/Sheets y formato examen
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body con Scroll */}
                <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
                    {/* Instrucciones y Prompt */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white/5 p-4 rounded-xl border border-white/5">
                        <div className="col-span-2 space-y-2">
                            <h4 className="text-[10px] font-black text-cyan-400 tracking-widest uppercase">
                                Pasos rápidos:
                            </h4>
                            <ol className="text-xs text-white/70 space-y-1.5 list-decimal list-inside font-medium leading-relaxed">
                                <li>Haz clic en <strong className="text-pink-400">Copiar Prompt IA</strong> para copiar la instrucción perfecta.</li>
                                <li>Pega en ChatGPT, Gemini o Claude y copia las respuestas.</li>
                                <li>Presiona <strong className="text-cyan-400">Pegar Contenido</strong> abajo. Verás la vista previa al instante.</li>
                            </ol>

                            <div className="pt-2 flex items-center gap-3">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Cantidad:</span>
                                <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
                                    {[5, 10, 15, 20].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setBulkCount(n)}
                                            className={`px-3 py-1 rounded text-xs font-black transition-all ${bulkCount === n ? 'bg-cyan-500 text-black shadow' : 'text-white/40 hover:text-white'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col justify-between space-y-3">
                            <button
                                type="button"
                                onClick={handleCopyPrompt}
                                className="w-full py-2.5 bg-pink-500/10 text-pink-400 rounded-lg text-xs font-black uppercase tracking-wider border border-pink-500/20 hover:bg-pink-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Sparkles size={14} /> Copiar Prompt ({bulkCount})
                            </button>

                            <div className="grid grid-cols-2 gap-1.5">
                                <button type="button" onClick={() => window.open('https://chatgpt.com/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase text-center">ChatGPT</button>
                                <button type="button" onClick={() => window.open('https://gemini.google.com/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase text-center">Gemini</button>
                                <button type="button" onClick={() => window.open('https://deepseek.com/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase text-center">DeepSeek</button>
                                <button type="button" onClick={() => window.open('https://claude.ai/', '_blank')} className="py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[9px] font-black tracking-widest text-white/60 hover:text-white transition-all uppercase text-center">Claude</button>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Acciones del Textarea */}
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-white/50 tracking-widest uppercase">
                            Texto o preguntas a importar
                        </label>
                        <div className="flex gap-2">
                            {bulkText && (
                                <button
                                    type="button"
                                    onClick={() => setBulkText('')}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-500/20 transition-all"
                                >
                                    <Trash2 size={12} /> Limpiar
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handlePaste}
                                className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-cyan-500/20 hover:bg-cyan-500/20 active:scale-95 transition-all"
                            >
                                <Plus size={12} /> Pegar Contenido
                            </button>
                        </div>
                    </div>

                    {/* Textarea */}
                    <textarea
                        className="w-full h-36 bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono outline-none resize-none leading-relaxed text-white placeholder-white/20 focus:border-cyan-500/50 transition-colors"
                        placeholder="Pega aquí el resultado de la IA o tu archivo... Acepta:&#10;• Pregunta | Opción A | Opción B | Opción C | Opción D | Correcta | Palabra_clave&#10;• Tablas de Markdown con |&#10;• Formato examen (1. Pregunta \n A) ... \n Respuesta: B)"
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                    />

                    {/* Feedback en Vivo del Parser */}
                    {bulkText.trim() && (
                        <div className="space-y-3">
                            {detectedQuestions.length > 0 ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                                            <CheckCircle2 size={16} />
                                            <span>¡{detectedQuestions.length} {detectedQuestions.length === 1 ? 'pregunta detectada' : 'preguntas detectadas'} listas para importar!</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowPreviewList(!showPreviewList)}
                                            className="text-[10px] font-black uppercase tracking-wider text-emerald-300 hover:text-white flex items-center gap-1"
                                        >
                                            {showPreviewList ? 'Ocultar vista previa' : 'Ver preguntas'}
                                            {showPreviewList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                    </div>

                                    {/* Lista desplegable de vista previa */}
                                    {showPreviewList && (
                                        <div className="mt-2 max-h-56 overflow-y-auto space-y-2 pr-1 border-t border-emerald-500/20 pt-2 custom-scrollbar">
                                            {detectedQuestions.map((q, idx) => (
                                                <div key={idx} className="bg-black/40 p-2.5 rounded-lg border border-white/5 text-xs space-y-1.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="font-bold text-white">
                                                            <span className="text-cyan-400 font-mono mr-1.5">#{idx + 1}</span>
                                                            {q.text}
                                                        </span>
                                                        {q.image_keyword && (
                                                            <span className="text-[9px] bg-white/10 text-white/60 px-2 py-0.5 rounded shrink-0">
                                                                📷 {q.image_keyword}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[11px]">
                                                        {['A', 'B', 'C', 'D'].map(letter => {
                                                            const optKey = `option_${letter.toLowerCase()}`;
                                                            const isCorrect = q.correct_option === letter;
                                                            return (
                                                                <div
                                                                    key={letter}
                                                                    className={`px-2 py-1 rounded truncate border ${
                                                                        isCorrect
                                                                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                                                                            : 'bg-white/5 border-white/5 text-white/60'
                                                                    }`}
                                                                    title={q[optKey]}
                                                                >
                                                                    <span className="font-mono mr-1 font-black">{letter}:</span>
                                                                    {q[optKey]}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2 text-amber-300 text-xs">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>
                                        No se han detectado preguntas en el texto. Asegúrate de separar las opciones con pipes (|) o seguir el formato indicado en las instrucciones.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer / Botón de Acción */}
                <div className="mt-5 pt-4 border-t border-white/10 shrink-0">
                    <button
                        type="button"
                        onClick={handleProcessImport}
                        disabled={detectedQuestions.length === 0}
                        className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg ${
                            detectedQuestions.length > 0
                                ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20 active:scale-[0.99]'
                                : 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed'
                        }`}
                    >
                        <FileText size={16} />
                        {detectedQuestions.length > 0
                            ? `IMPORTAR ${detectedQuestions.length} PREGUNTAS DETECTADAS`
                            : 'IMPORTAR PREGUNTAS (PEGA CONTENIDO)'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkImportPanel;
