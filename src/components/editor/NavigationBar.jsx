import React from 'react';
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, FileText, Sparkles } from 'lucide-react';

const NavigationBar = ({
    currentIdx,
    totalQuestions,
    isDirty,
    onPrev,
    onNext,
    onAddNewQuestion,
    onOpenBulkPanel,
    onOpenAiPanel,
    onDelete,
    onSave
}) => {
    return (
        <footer className="fixed bottom-0 left-0 right-0 h-[10vh] md:h-20 bg-black/80 backdrop-blur-md border-t border-white/10 z-50 shadow-2xl transition-all">
            <div className="h-full max-w-7xl mx-auto flex items-center justify-between px-4 md:px-20">
                {/* Controles de Navegación */}
                <div className="flex items-center gap-4 md:gap-8">
                    <div className="flex items-center gap-2 md:gap-4 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={onPrev}
                            disabled={currentIdx === 0}
                            className="p-2 md:p-3 hover:bg-white/10 rounded-lg transition-all disabled:opacity-20 text-white"
                        >
                            <ChevronLeft size={20} className="md:w-[24px]" />
                        </button>
                        <div className="flex items-baseline gap-1 px-2 md:px-4">
                            <span className="text-xl md:text-3xl font-display font-black text-primary italic tracking-tighter leading-none">
                                {currentIdx + 1}
                            </span>
                            <span className="text-[10px] md:text-sm font-bold text-white/20 uppercase tracking-widest italic leading-none">
                                de {totalQuestions}
                            </span>
                        </div>
                        <button
                            onClick={onNext}
                            disabled={currentIdx === totalQuestions - 1}
                            className="p-2 md:p-3 hover:bg-white/10 rounded-lg transition-all disabled:opacity-20 text-white"
                        >
                            <ChevronRight size={20} className="md:w-[24px]" />
                        </button>
                    </div>
                </div>

                {/* Acciones principales */}
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-4 mr-4 text-[10px] font-black tracking-[0.2em] text-white/20 uppercase">
                        <div className="flex items-center gap-2 border-r border-white/5 pr-4">
                            <div className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                            {isDirty ? 'MODIFICACIÓN' : 'SINCRO'}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onAddNewQuestion}
                            title="NUEVA PREGUNTA"
                            className="md:hidden flex h-10 w-10 bg-white/5 border border-white/10 items-center justify-center rounded-xl active:scale-95 transition-all text-white/60"
                        >
                            <Plus size={20} />
                        </button>
                        <button
                            onClick={onOpenBulkPanel}
                            title="CARGA MASIVA"
                            className="md:hidden flex h-10 w-10 bg-white/5 border border-white/10 items-center justify-center rounded-xl active:scale-95 transition-all text-cyan-400"
                        >
                            <FileText size={18} />
                        </button>
                        <button
                            onClick={onOpenAiPanel}
                            title="GENERAR IA"
                            className="md:hidden flex h-10 w-10 bg-secondary/10 border border-secondary/20 items-center justify-center rounded-xl active:scale-95 transition-all text-secondary"
                        >
                            <Sparkles size={18} />
                        </button>
                        {totalQuestions > 1 && (
                            <button
                                onClick={onDelete}
                                className="flex h-10 w-10 md:h-12 md:w-12 bg-red-500/10 border border-red-500/20 items-center justify-center rounded-xl active:scale-95 transition-all text-red-500 hover:bg-red-500 hover:text-white"
                                title="Eliminar pregunta"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button
                            onClick={onSave}
                            disabled={!isDirty}
                            className={`h-11 md:h-12 px-6 md:px-10 rounded-xl font-black text-[1.4vh] md:text-xs tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg active:scale-95
                                ${isDirty
                                    ? 'bg-primary text-white shadow-primary/20 hover:bg-primary-hover border-none'
                                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed opacity-50 shadow-none'
                                }`}
                        >
                            <Save size={18} />
                            <span className="hidden xs:inline">GUARDAR TRIVIA</span>
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default NavigationBar;
