import React from 'react';
import { Plus, FileText, Sparkles } from 'lucide-react';

const QuestionMethodPicker = ({ onAddNewManual, onOpenBulk, onOpenAi }) => {
    return (
        <div className="max-w-5xl mx-auto w-full px-[4vw]">
            <div className="text-center mb-[4vh] md:mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className="text-[4vh] md:text-5xl font-black text-white italic tracking-tighter mb-[1vh] md:mb-4">
                    Configurar<span className="text-primary not-italic">Trivia</span>
                </h2>
                <p className="text-on-surface-variant font-bold uppercase tracking-[0.4em] text-[1vh] md:text-xs opacity-40">Elige un método para cargar preguntas</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[2vh] md:gap-8 h-full overflow-y-auto pr-2 custom-scrollbar max-h-[60vh] md:max-h-none">
                {/* Opción 1: Manual */}
                <button
                    onClick={onAddNewManual}
                    className="group relative bg-surface-lowest/40 backdrop-blur-xl border border-white/5 rounded-[3vh] md:rounded-4xl p-[3vh] md:p-10 flex flex-col items-center text-center gap-[2vh] md:gap-6 hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
                >
                    <div className="absolute top-[2vh] right-[2vh] md:top-6 md:right-6">
                        <span className="text-[0.9vh] md:text-[9px] font-black px-[1.5vh] py-[0.5vh] md:px-3 md:py-1 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-widest uppercase">MANUAL</span>
                    </div>
                    <div className="w-[8vh] h-[8vh] md:w-20 md:h-20 rounded-[2vh] md:rounded-2xl bg-white/5 flex items-center justify-center text-white/20 group-hover:text-white group-hover:bg-white/10 transition-all">
                        <Plus size={40} className="w-[5vh] h-[5vh] md:w-10 md:h-10" />
                    </div>
                    <div className="space-y-[0.5vh] md:space-y-2">
                        <h3 className="text-[2vh] md:text-xl font-black text-white tracking-tight leading-none">Carga Tradicional</h3>
                        <p className="text-[1.2vh] md:text-xs text-on-surface-variant leading-relaxed opacity-40">Crea tus desafíos paso a paso con control total.</p>
                    </div>
                </button>

                {/* Opción 2: Masiva */}
                <button
                    onClick={onOpenBulk}
                    className="group relative bg-surface-lowest/40 backdrop-blur-xl border border-white/5 rounded-[3vh] md:rounded-4xl p-[3vh] md:p-10 flex flex-col items-center text-center gap-[2vh] md:gap-6 hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
                >
                    <div className="absolute top-[2vh] right-[2vh] md:top-6 md:right-6">
                        <span className="text-[0.9vh] md:text-[9px] font-black px-[1.5vh] py-[0.5vh] md:px-3 md:py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 tracking-widest uppercase">Prompt IA</span>
                    </div>
                    <div className="w-[8vh] h-[8vh] md:w-20 md:h-20 rounded-[2vh] md:rounded-2xl bg-cyan-500/5 flex items-center justify-center text-cyan-400/40 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-all">
                        <FileText size={40} className="w-[5vh] h-[5vh] md:w-10 md:h-10" />
                    </div>
                    <div className="space-y-[0.5vh] md:space-y-2">
                        <h3 className="text-[2vh] md:text-xl font-black text-white tracking-tight leading-none">Carga Masiva</h3>
                        <p className="text-[1.2vh] md:text-xs text-on-surface-variant leading-relaxed opacity-40">Pega tu documento y estructúralo rápidamente.</p>
                    </div>
                </button>

                {/* Opción 3: Generar con IA */}
                <button
                    onClick={onOpenAi}
                    className="group relative bg-surface-lowest/40 backdrop-blur-xl border border-primary/20 rounded-[3vh] md:rounded-4xl p-[3vh] md:p-10 flex flex-col items-center text-center gap-[2vh] md:gap-6 hover:bg-primary/5 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl shadow-primary/10"
                >
                    <div className="absolute top-[2vh] right-[2vh] md:top-6 md:right-6">
                        <span className="text-[0.9vh] md:text-[9px] font-black px-[1.5vh] py-[0.5vh] md:px-3 md:py-1 rounded-full bg-primary/20 text-primary border border-primary/30 tracking-widest uppercase animate-pulse">IA GENERADOR</span>
                    </div>
                    <div className="w-[8vh] h-[8vh] md:w-20 md:h-20 rounded-[2vh] md:rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-all">
                        <Sparkles size={40} className="w-[5vh] h-[5vh] md:w-10 md:h-10" />
                    </div>
                    <div className="space-y-[0.5vh] md:space-y-2">
                        <h3 className="text-[2vh] md:text-xl font-black text-white tracking-tight leading-none">Generar con IA</h3>
                        <p className="text-[1.2vh] md:text-xs text-on-surface-variant leading-relaxed opacity-60">Deja que la IA cree una trivia por ti.</p>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default QuestionMethodPicker;
