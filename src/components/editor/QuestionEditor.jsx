import React from 'react';
import {
    Mic2, RefreshCcw, Volume2, Play, CheckCircle2,
    Crown, ImageIcon, Layout, Search, Link as LinkIcon, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const QuestionEditor = ({
    question: q,
    currentIdx,
    questions,
    loading,
    user,
    quiz,
    onUpdateQuestion,
    onSetQuestions,
    onHandleIndividualTTS,
    questionInputRef
}) => {
    if (!q) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[4vh] lg:gap-12 items-stretch flex-1 overflow-y-auto h-full py-[2vh] md:py-4 pr-2 custom-scrollbar">
            {/* Panel Izquierdo: Pregunta y Respuestas */}
            <div className="lg:col-span-1 space-y-[2vh] md:space-y-4 bg-white/5 p-[3vh] md:p-8 rounded-[3vh] md:rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl relative z-10 flex flex-col justify-center h-full">
                <div>
                    <textarea
                        ref={questionInputRef}
                        value={q.text}
                        onChange={(e) => onUpdateQuestion(currentIdx, { text: e.target.value })}
                        className="w-full bg-transparent text-[2.5vh] md:text-2xl font-black focus:outline-none resize-none placeholder:opacity-10 leading-tight transition-all"
                        placeholder="Escribe la pregunta aquí..."
                        rows={3}
                    />
                </div>

                {/* TTS Engine 2.0 - Control de Sincronización */}
                <div className="flex items-center justify-between p-[1.5vh] md:p-3 bg-surface-lowest/60 rounded-[2vh] md:rounded-2xl border border-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-[1.5vh] md:gap-3">
                        {!q.audio_url ? (
                            <div className="flex items-center gap-[1vh] md:gap-2 px-[1.5vh] md:px-3 py-[0.5vh] md:py-1 bg-red-500/10 rounded-full border border-red-500/20">
                                <Mic2 size={12} className="text-red-500 w-[1.5vh] h-[1.5vh] md:w-3 md:h-3" />
                                <span className="text-[1vh] md:text-[10px] font-black text-red-500 uppercase tracking-widest">Sin Audio</span>
                            </div>
                        ) : q.text !== q.last_tts_text ? (
                            <div className="flex items-center gap-[1vh] md:gap-2 px-[1.5vh] md:px-3 py-[0.5vh] md:py-1 bg-orange-500/10 rounded-full border border-orange-500/20">
                                <RefreshCcw size={12} className="text-orange-500 animate-pulse w-[1.5vh] h-[1.5vh] md:w-3 md:h-3" />
                                <span className="text-[1vh] md:text-[10px] font-black text-orange-500 uppercase tracking-widest">Desactualizado</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-[1vh] md:gap-2 px-[1.5vh] md:px-3 py-[0.5vh] md:py-1 bg-green-500/10 rounded-full border border-green-500/20">
                                <Volume2 size={12} className="text-green-500 w-[1.5vh] h-[1.5vh] md:w-3 md:h-3" />
                                <span className="text-[1vh] md:text-[10px] font-black text-green-500 uppercase tracking-widest">Sincronizado</span>
                            </div>
                        )}
                        <span className="text-[0.9vh] md:text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] hidden md:block">TTS Engine 2.0</span>
                    </div>

                    <div className="flex items-center gap-[1vh] md:gap-2">
                        {q.audio_url && (
                            <button
                                onClick={() => new Audio(q.audio_url).play()}
                                className="p-[1vh] md:p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center justify-center"
                                title="Probar sonido"
                            >
                                <Play size={16} fill="currentColor" className="w-[1.8vh] h-[1.8vh] md:w-4 md:h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => onHandleIndividualTTS(currentIdx)}
                            disabled={loading || !q.text || q.text.trim() === '¿  ?' || (q.audio_url && q.text === q.last_tts_text)}
                            className={`flex items-center gap-[1vh] md:gap-2 px-[2vh] md:px-4 py-[1vh] md:py-2 rounded-[1.5vh] md:rounded-xl text-[1vh] md:text-[10px] font-black tracking-widest transition-all ${loading || !q.text || q.text.trim() === '¿  ?' || (q.audio_url && q.text === q.last_tts_text)
                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                : 'bg-secondary text-on-secondary hover:bg-secondary/80 active:scale-95'
                                }`}
                        >
                            <RefreshCcw size={14} className={loading ? "animate-spin w-[1.5vh] h-[1.5vh] md:w-3.5 md:h-3.5" : "w-[1.5vh] h-[1.5vh] md:w-3.5 md:h-3.5"} />
                            {q.audio_url && q.text !== q.last_tts_text ? "RE-VINCULAR" : "VINCULAR VOZ"}
                            {!user?.is_premium && <Crown size={10} className="w-[1.2vh] h-[1.2vh] md:w-2.5 md:h-2.5" />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-[1vh] md:gap-2 mt-[2vh] md:mt-4">
                    {['A', 'B', 'C', 'D'].map(opt => (
                        <div key={opt} className={`flex items-center gap-[1.5vh] md:gap-3 p-[0.5vh] pr-[1vh] md:p-1 md:pr-2 rounded-[1.5vh] md:rounded-xl border-2 transition-all group ${q.correct_option === opt ? 'border-pink-500 bg-pink-500/10 shadow-[0_0_20px_rgba(236,72,153,0.1)]' : 'border-white/5 bg-white/5 hover:border-white/20'}`}>
                            <button
                                onClick={() => onUpdateQuestion(currentIdx, { correct_option: opt })}
                                className={`w-[4.5vh] h-[4.5vh] md:w-10 md:h-10 flex items-center justify-center rounded-[1vh] md:rounded-lg text-[1.8vh] md:text-base font-black transition-all shrink-0 ${q.correct_option === opt ? 'bg-pink-500 text-black scale-105' : 'bg-white/5 text-white/20 group-hover:bg-white/10'}`}
                            >
                                {opt}
                            </button>
                            <input
                                value={q[`option_${opt.toLowerCase()}`]}
                                onChange={(e) => onUpdateQuestion(currentIdx, { [`option_${opt.toLowerCase()}`]: e.target.value })}
                                className="w-full bg-transparent text-[1.4vh] md:text-sm font-bold focus:outline-none"
                                placeholder={`Respuesta ${opt}...`}
                            />
                            <button
                                onClick={() => onUpdateQuestion(currentIdx, { correct_option: opt })}
                                className={`flex items-center justify-center transition-all shrink-0 ${q.correct_option === opt ? 'text-pink-500' : 'text-white/10 hover:text-white/30'}`}
                                title="Marcar como correcta"
                            >
                                <CheckCircle2 size={22} className={`${q.correct_option === opt ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''} w-[2.5vh] h-[2.5vh] md:w-5 md:h-5`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Media & Herramientas */}
            <div className="lg:col-span-1 flex flex-col gap-[2vh] md:gap-4 lg:overflow-hidden lg:h-full">
                <div className="aspect-video lg:aspect-auto lg:flex-1 min-h-[20vh] md:min-h-[250px] bg-surface-lowest/40 rounded-[3vh] md:rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden relative group">
                    <div className="absolute top-[2vh] left-[2vh] md:top-4 md:left-4 z-20 flex gap-2">
                        <span className="text-[0.9vh] md:text-[9px] font-black text-cyan-400 tracking-widest bg-cyan-400/10 border border-cyan-400/20 px-[1.5vh] py-[0.8vh] md:px-3 md:py-1.5 rounded-full uppercase">VISTA PREVIA</span>
                    </div>
                    <div className="absolute top-[2vh] right-[2vh] md:top-4 md:right-4 z-20">
                        <button
                            onClick={() => {
                                const newQs = questions.map((item, i) => ({ ...item, is_cover: i === currentIdx }))
                                onSetQuestions(newQs)
                                toast.success('Esta imagen será la portada del quiz')
                            }}
                            className={`flex items-center gap-[1vh] md:gap-2 px-[1.5vh] md:px-3 py-[0.8vh] md:py-1.5 rounded-full border-2 transition-all backdrop-blur-md ${q.is_cover ? 'bg-pink-500/90 text-white border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:border-white/30'}`}
                            title="Usar como portada del quiz"
                        >
                            <Layout size={14} className="w-[1.5vh] h-[1.5vh] md:w-3.5 md:h-3.5" />
                            <span className="text-[0.9vh] md:text-[9px] font-black uppercase tracking-widest">{q.is_cover ? 'PORTADA ACTIVA' : 'USAR COMO PORTADA'}</span>
                        </button>
                    </div>
                    {q.image_url ? (
                        <img
                            src={q.image_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain p-[2vh] md:p-4 group-hover:scale-110 transition-transform duration-700"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://placehold.co/600x400/111/fff?text=Imagen+Invalida';
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-[2vh] md:gap-4 opacity-10">
                            <ImageIcon size={80} strokeWidth={1} className="w-[10vh] h-[10vh] md:w-20 md:h-20" />
                            <span className="text-[1.2vh] md:text-xs font-black tracking-widest uppercase">SIN IMAGEN</span>
                        </div>
                    )}
                </div>
                <div className="bg-white/5 p-[2vh] md:p-4 rounded-[2.5vh] md:rounded-2xl border border-white/5 flex flex-col gap-[1.5vh] md:gap-3">
                    <div className="flex items-center gap-[1.5vh] md:gap-4">
                        <div className="p-[1vh] md:p-2 bg-cyan-400/10 rounded-[1vh] md:rounded-xl text-cyan-400"><ImageIcon size={20} className="w-[2vh] h-[2vh] md:w-5 md:h-5" /></div>
                        <input
                            id="media-url-input"
                            className="flex-1 bg-transparent text-[1.2vh] md:text-sm font-mono text-cyan-400 outline-none placeholder:text-cyan-400/20"
                            value={q.image_url || ''}
                            onChange={e => onUpdateQuestion(currentIdx, { image_url: e.target.value })}
                            placeholder="Introduce URL de imagen..."
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-[1vh] md:gap-2">
                        <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${quiz?.title} ${q.text}`)}&tbm=isch`, '_blank')} className="flex items-center justify-center gap-[1vh] md:gap-2 py-[1.2vh] md:py-2.5 bg-white/5 rounded-[1.2vh] md:rounded-xl text-[0.9vh] md:text-[9px] font-black hover:bg-white/10 transition-all uppercase tracking-widest border border-white/5"><Search size={14} className="w-[1.5vh] h-[1.5vh] md:w-3.5 md:h-3.5" />Buscar</button>
                        <button
                            type="button"
                            onClick={async () => {
                                const input = document.getElementById('media-url-input');
                                input?.focus();

                                if (!navigator.clipboard || !navigator.clipboard.readText) {
                                    toast.error('Pegado no soportado. Usa Ctrl+V');
                                    return;
                                }

                                try {
                                    const text = await navigator.clipboard.readText();
                                    const cleanText = text?.trim();

                                    if (cleanText) {
                                        onUpdateQuestion(currentIdx, { image_url: cleanText, media_type: 'image' });
                                        toast.success('¡Contenido pegado!');
                                    } else {
                                        toast.error('El portapapeles está vacío');
                                    }
                                } catch (e) {
                                    console.error('Clipboard error:', e);
                                    toast.error('Bloqueado por el navegador. Usa Ctrl+V');
                                }
                            }}
                            className="flex items-center justify-center gap-[1vh] md:gap-2 py-[1.2vh] md:py-2.5 bg-cyan-500/10 text-cyan-400 rounded-[1.2vh] md:rounded-xl text-[0.9vh] md:text-[9px] font-black hover:bg-cyan-500/20 transition-all uppercase tracking-widest border border-cyan-500/20"
                        >
                            <LinkIcon size={14} className="w-[1.5vh] h-[1.5vh] md:w-3.5 md:h-3.5" />Pegar
                        </button>
                        <button onClick={() => onUpdateQuestion(currentIdx, { image_url: '', media_type: 'none' })} className="flex items-center justify-center gap-[1vh] md:gap-2 py-[1.2vh] md:py-2.5 bg-red-500/10 text-red-500 rounded-[1.2vh] md:rounded-xl text-[0.9vh] md:text-[9px] font-black hover:bg-red-500/20 transition-all uppercase tracking-widest border border-red-500/10"><Trash2 size={14} className="w-[1.5vh] h-[1.5vh] md:w-3.5 md:h-3.5" />Limpiar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionEditor;
