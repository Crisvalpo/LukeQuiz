import React, { useState } from 'react';
import { FileText, X, Trash2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const BulkImportPanel = ({
    isOpen,
    onClose,
    onImport,
    quizTitle = '',
    quizDescription = ''
}) => {
    const [bulkText, setBulkText] = useState('');
    const [bulkCount, setBulkCount] = useState(5);

    if (!isOpen) return null;

    const handleCopyPrompt = () => {
        const prompt = `Actúa como un experto en creación de contenido educativo. Genera una lista de ${bulkCount} preguntas para una trivia titulada "${quizTitle || 'Mi Trivia'}" sobre "${quizDescription || 'temas variados'}".

Cada pregunta debe seguir estrictamente este formato de texto plano, separando los campos con el carácter pipe (|):

Pregunta | Opción A | Opción B | Opción C | Opción D | Letra de Opción Correcta (Solo la letra A, B, C o D) | URL de Imagen Relevante

Por ejemplo:
¿Cuál es la capital de Francia? | Madrid | París | Roma | Berlín | B | https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80

REGLAS CRÍTICAS:
1. Devuelve SOLO las ${bulkCount} líneas de preguntas, una por línea.
2. Sin introducciones, sin números al inicio, sin explicaciones.
3. Asegúrate de que las URLs de imagen sean de Unsplash o sitios similares y que funcionen.
4. Las opciones deben ser coherentes y solo una debe ser la correcta.
5. Usa exactamente el formato: texto|a|b|c|d|letra_correcta|url_imagen`;
        navigator.clipboard.writeText(prompt);
        toast.success(`Prompt para ${bulkCount} preguntas copiado`);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setBulkText(text);
            toast.success('Contenido pegado del portapapeles');
        } catch (err) {
            toast.error('Error al acceder al portapapeles');
        }
    };

    const handleProcessImport = () => {
        if (!bulkText.trim()) return;
        const lines = bulkText.split('\n').filter(l => l.trim().includes('|'));
        if (lines.length === 0) {
            toast.error('Formato inválido. Usa: Pregunta | A | B | C | D | Correcta');
            return;
        }

        const parsedQuestions = lines.map((l) => {
            const parts = l.split('|').map(s => s.trim());
            const [t, a, b, c, d, corr, img] = parts;

            let cleanCorr = 'A';
            if (corr) {
                const match = corr.match(/[A-D]/i);
                if (match) cleanCorr = match[0].toUpperCase();
            }

            return {
                text: t || 'Nueva Pregunta',
                option_a: a || '',
                option_b: b || '',
                option_c: c || '',
                option_d: d || '',
                correct_option: cleanCorr,
                image_url: img || ''
            };
        });

        onImport(parsedQuestions);
        setBulkText('');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-4xl bg-surface border border-white/10 p-8 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <FileText size={18} /> IMPORTACIÓN MASIVA
                        </h3>
                    </div>
                    <button onClick={onClose}><X size={20} className="opacity-40 hover:opacity-100" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="col-span-2 space-y-3">
                        <h4 className="text-[10px] font-black text-cyan-400 tracking-widest uppercase">Instrucciones de Uso:</h4>
                        <ol className="text-xs text-white/70 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                            <li>Haz clic en <strong>Copiar Prompt IA</strong> para copiar las instrucciones.</li>
                            <li>Abre tu IA favorita y pega el prompt copiado.</li>
                            <li>Copia las <strong>líneas de texto</strong> que la IA te devolverá.</li>
                            <li>Pega el resultado en la caja de abajo y presiona <strong>Importar</strong>.</li>
                        </ol>

                        <div className="mt-8 space-y-3">
                            <label className="text-[10px] font-black text-white/40 tracking-widest uppercase ml-1 block">Número de preguntas deseado</label>
                            <div className="flex items-center gap-4">
                                <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 w-fit">
                                    {[5, 10, 15, 20].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setBulkCount(n)}
                                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${bulkCount === n ? 'bg-cyan-500 text-black' : 'text-white/40 hover:text-white/60'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    className="w-20 bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-cyan-500 transition-all text-center"
                                    value={bulkCount}
                                    onChange={e => setBulkCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                                />
                                <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest italic">Personalizar (Máx 20)</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <button
                            onClick={handleCopyPrompt}
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

                <div className="flex justify-between items-center mb-2 px-1">
                    <label className="text-[10px] font-black text-white/40 tracking-widest uppercase">Contenido de la IA</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setBulkText('')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-500/20 transition-all"
                        >
                            <Trash2 size={12} /> LIMPIAR
                        </button>
                        <button
                            onClick={handlePaste}
                            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 text-cyan-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                        >
                            <Plus size={12} className="rotate-45" /> PEGAR CONTENIDO
                        </button>
                    </div>
                </div>

                <textarea
                    className="w-full h-48 bg-black/50 border border-white/10 rounded-xl p-6 text-xs font-mono outline-none resize-none leading-relaxed focus:border-cyan-500/50 transition-colors"
                    placeholder="Pega aquí el resultado de la IA... Ejemplo: Pregunta | A | B | C | D | B | https://..."
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                />
                <button
                    onClick={handleProcessImport}
                    className="w-full mt-6 py-4 border border-white/10 hover:bg-white/5 rounded-lg text-[10px] font-black tracking-widest"
                >
                    IMPORTAR PREGUNTAS
                </button>
            </div>
        </div>
    );
};

export default BulkImportPanel;
