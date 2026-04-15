import React, { useState } from 'react';
import { Sparkles, X, Loader2, Wand2, Volume2, Crown } from 'lucide-react';

const AiPanel = ({
    isOpen,
    onClose,
    onGenerate,
    initialTopic = '',
    initialDescription = '',
    isGenerating = false,
    isPremium = false,
    openPremiumModal
}) => {
    const [topic, setTopic] = useState(initialTopic);
    const [count, setCount] = useState(5);
    const [ttsEnabled, setTtsEnabled] = useState(false);

    if (!isOpen) return null;

    return (
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
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all">
                        <X size={20} className="opacity-40 hover:opacity-100" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-white/40 tracking-widest uppercase ml-1">TEMA DE LA TRIVIA</label>
                        <input
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary transition-all"
                            placeholder="Ej: Historia de Chile, Ciencia Ficción..."
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 tracking-widest uppercase ml-1">CANTIDAD</label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-bold text-white outline-none focus:border-primary transition-all text-center"
                            value={count}
                            onChange={e => setCount(parseInt(e.target.value) || 1)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 tracking-widest uppercase ml-1 flex items-center gap-1">
                            VOZ NEURONAL
                            {!isPremium && <Crown size={8} className="text-amber-500" />}
                        </label>
                        <div className="h-[54px] flex items-center justify-between px-4 bg-black/40 border border-white/10 rounded-xl">
                            <Volume2 size={18} className={ttsEnabled ? "text-secondary" : "text-white/20"} />
                            <button
                                onClick={() => {
                                    if (!isPremium) {
                                        openPremiumModal();
                                        return;
                                    }
                                    setTtsEnabled(!ttsEnabled);
                                }}
                                className={`w-10 h-5 rounded-full relative transition-all ${ttsEnabled ? 'bg-secondary' : 'bg-white/10'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${ttsEnabled ? 'left-5.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => onGenerate({ topic, count, ttsEnabled, description: initialDescription })}
                    disabled={isGenerating || !topic}
                    className="w-full py-5 bg-primary rounded-xl font-black text-xs uppercase tracking-[0.3em] hover:bg-primary/80 transition-all flex items-center justify-center gap-3 disabled:opacity-30 shadow-lg shadow-primary/20 active:scale-95"
                >
                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                    GENERAR NUEVAS PREGUNTAS
                </button>
            </div>
        </div>
    );
};

export default AiPanel;
