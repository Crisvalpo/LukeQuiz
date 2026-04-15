import React from 'react';
import { ArrowLeft, Plus, FileText, Sparkles, Crown } from 'lucide-react';

const EditorHeader = ({
    quiz,
    user,
    onQuizChange,
    onSafeNavigate,
    onAddNewQuestion,
    onOpenBulkPanel,
    onOpenAiPanel,
    onOpenPremiumModal
}) => {
    return (
        <header className="fixed top-0 left-0 right-0 h-[10vh] md:h-24 bg-black/80 backdrop-blur-md border-b border-white/10 px-[4vw] md:px-20 flex items-center justify-between z-50 shadow-2xl transition-all">
            <div className="flex items-center gap-[2vw] md:gap-6 flex-1 overflow-hidden">
                <button
                    onClick={() => onSafeNavigate('/')}
                    className="p-[1.5vh] md:p-3 hover:bg-white/10 rounded-full transition-all shrink-0"
                >
                    <ArrowLeft size={18} className="md:w-[22px]" />
                </button>
                <div className="flex flex-col flex-1 min-w-0 group/meta">
                    <div className="flex flex-col border-l-2 border-white/5 pl-[2vw] md:pl-6 mt-1 hover:border-white/20 transition-all overflow-hidden">
                        <input
                            value={quiz?.title || ''}
                            onChange={(e) => onQuizChange({ ...quiz, title: e.target.value })}
                            className={`bg-transparent border-none text-[2.2vh] md:text-3xl font-display font-black text-white italic tracking-tight leading-none outline-none placeholder:text-white/20 w-full truncate ${!quiz?.title?.trim() ? 'animate-pulse-input' : ''}`}
                            placeholder="Título de la trivia"
                        />
                        <input
                            value={quiz?.description || ''}
                            onChange={(e) => onQuizChange({ ...quiz, description: e.target.value })}
                            className={`bg-transparent border-none text-[1.2vh] md:text-sm font-bold text-white/40 tracking-[0.2em] outline-none placeholder:text-white/10 w-full mt-1 md:mt-2 truncate ${!quiz?.description?.trim() ? 'animate-pulse-input' : ''}`}
                            placeholder="Añade una descripción..."
                        />
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10 ml-4 shrink-0">
                    <button
                        onClick={() => onQuizChange({ ...quiz, visibility: 'public' })}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${quiz?.visibility === 'public' ? 'bg-primary text-white' : 'text-white/20 hover:text-white/40'}`}
                    >
                        PÚBLICO
                    </button>
                    <button
                        onClick={() => {
                            if (!user?.is_premium && quiz?.visibility !== 'private') {
                                onOpenPremiumModal();
                                return;
                            }
                            onQuizChange({ ...quiz, visibility: 'private' });
                        }}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${quiz?.visibility === 'private' ? 'bg-amber-500 text-black' : 'text-white/20 hover:text-white/40'} flex items-center gap-2`}
                    >
                        {(!user?.is_premium && quiz?.visibility !== 'private') && <Crown size={10} />}
                        PRIVADO
                    </button>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-3 ml-6">
                {/* Botón Nueva Pregunta - MANUAL */}
                <button
                    onClick={onAddNewQuestion}
                    title="NUEVA PREGUNTA"
                    className="group relative flex items-center justify-center gap-3 px-6 h-11 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/10 transition-all shadow-lg active:scale-95 overflow-hidden shrink-0"
                >
                    <Plus size={18} /> <span>NUEVA PREGUNTA</span>
                    <div className="absolute top-0 right-0 bg-white/20 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter text-white opacity-50 group-hover:opacity-100 transition-opacity uppercase">MANUAL</div>
                </button>

                {/* Botón Carga Masiva - IA */}
                <button
                    onClick={onOpenBulkPanel}
                    title="CARGA MASIVA"
                    className="group relative flex items-center justify-center gap-3 px-6 h-11 bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 rounded-lg text-xs font-bold transition-all overflow-hidden shrink-0"
                >
                    <FileText size={16} />
                    <span>CARGA MASIVA</span>
                    <div className="absolute top-0.5 right-0.5 px-2 py-0.5 text-[8px] font-black rounded-bl-lg tracking-tighter transition-opacity uppercase bg-cyan-500/20 text-cyan-400 opacity-50 group-hover:opacity-100">
                        IA
                    </div>
                </button>

                {/* Botón Generar IA - MAGIA */}
                <button
                    onClick={onOpenAiPanel}
                    title="GENERAR CON IA"
                    className={`group relative flex items-center justify-center gap-3 px-6 h-11 border rounded-lg text-xs font-black tracking-widest transition-all active:scale-95 shrink-0 overflow-hidden ${user?.is_premium ? 'bg-secondary text-on-secondary border-none shadow-lg shadow-secondary/20 hover:bg-secondary/80' : 'bg-white/5 border-amber-500/20 text-amber-500/50 grayscale opacity-70 cursor-not-allowed hover:grayscale-0 hover:opacity-100'}`}
                >
                    {user?.is_premium ? <Sparkles size={18} /> : <Crown size={18} />}
                    <span>{user?.is_premium ? 'IA GENERADOR' : 'PREMIUM'}</span>
                </button>
            </div>
        </header>
    );
};

export default EditorHeader;
