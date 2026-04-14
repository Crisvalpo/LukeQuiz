import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Play, Settings, Trash2, PlusCircle, Search, Library, User, LogOut, Ticket, Crown, Monitor } from 'lucide-react'
import { generateJoinCode } from '../utils/helpers'
import { toast } from 'sonner'
import LogoLukeQuiz from '../components/LogoLukeQuiz'
import { useAuth } from '../lib/AuthContext'
import Modal from '../components/Modal'
import PremiumModal from '../components/PremiumModal'

export default function Home() {
    const { user, refreshProfile } = useAuth()
    const [activeGames, setActiveGames] = useState([])
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState('library') // 'library' or 'mine'
    const [searchQuery, setSearchQuery] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuizzes()
        if (user) fetchActiveGames()
    }, [view, searchQuery, user])

    const fetchActiveGames = async () => {
        if (!user) return
        const { data } = await supabase
            .from('games')
            .select('*, quizzes(title)')
            .eq('user_id', user.id)
            .neq('status', 'finished')
            .order('created_at', { ascending: false })

        if (data) setActiveGames(data)
    }

    const fetchQuizzes = async () => {
        setLoading(true)
        let query = supabase
            .from('quizzes')
            .select('*, questions(id, image_url, is_cover), profiles:user_id(nickname)')

        if (view === 'mine' && user) {
            query = query.eq('user_id', user.id)
        } else {
            query = query.eq('visibility', 'public')
        }

        if (searchQuery) {
            query = query.ilike('title', `%${searchQuery}%`)
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })

        if (error) {
            toast.error('Error de Carga: No se pudo obtener los datos')
        } else {
            const processed = (data || []).map(quiz => {
                const coverQ = quiz.questions?.find(q => q.is_cover && q.image_url)
                const firstImg = coverQ?.image_url || quiz.questions?.find(q => q.image_url)?.image_url || null
                return { ...quiz, cover_image: firstImg }
            })
            setQuizzes(processed)
        }
        setLoading(false)
    }

    const startNewGame = async (quizId) => {
        if (!user) {
            toast.error('Debes iniciar sesión para comenzar una partida')
            return
        }
        const promise = new Promise(async (resolve, reject) => {
            const code = generateJoinCode()
            const { data: game, error } = await supabase
                .from('games')
                .insert({
                    quiz_id: quizId,
                    join_code: code,
                    status: 'waiting',
                    current_question_index: 0,
                    user_id: user.id
                })
                .select()
                .single()

            if (error) reject(error)
            else resolve(game)
        })

        toast.promise(promise, {
            loading: 'Iniciando partida...',
            success: (game) => {
                fetchActiveGames()
                window.open(`/screen/${game.id}`, '_blank')
                navigate(`/host/${game.id}`)
                return '¡Partida Iniciada!'
            },
            error: 'Error al iniciar el juego'
        })
    }

    const finishGame = async (gameId) => {
        const { error } = await supabase
            .from('games')
            .update({ status: 'finished' })
            .eq('id', gameId)

        if (!error) {
            toast.success('Partida finalizada')
            fetchActiveGames()
        }
    }

    const resumeGame = (gameId) => {
        window.open(`/screen/${gameId}`, '_blank')
        navigate(`/host/${gameId}`)
    }

    const deleteQuiz = async (id, title) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la trivia "${title}"?`)) return

        const promise = new Promise(async (resolve, reject) => {
            try {
                const { error: qError } = await supabase.from('quizzes').delete().eq('id', id)
                if (qError) throw qError
                resolve()
            } catch (err) {
                reject(err)
            }
        })

        toast.promise(promise, {
            loading: 'Eliminando...',
            success: () => {
                fetchQuizzes()
                return 'Juego eliminado'
            },
            error: (err) => `Error: ${err.message}`
        })
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const handleCreateQuiz = () => {
        if (!user) {
            navigate('/login')
            return
        }
        navigate('/edit/new')
    }

    return (
        <div className="min-h-screen bg-surface selection:bg-primary/30 font-body relative overflow-hidden">
            {/* Background Glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-1/4 -right-12 w-1/3 h-1/3 bg-primary rounded-full blur-3xl" />
            </div>

            <div className="w-full h-screen flex flex-col px-6 md:px-12 pt-4 md:pt-6 pb-4 md:pb-6 relative z-10 max-w-[1700px] mx-auto">
                <header className="flex justify-between items-center mb-6 px-8 pt-2 md:pt-4 shrink-0 relative z-20">
                    <div className="space-y-4 text-left">
                        <p className="text-[12px] font-display font-black tracking-[0.4em] text-primary/40 uppercase">Haz de tus preguntas un Juego</p>
                        <LogoLukeQuiz className="w-80 h-auto -ml-3" />
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/tv')}
                            className="flex items-center gap-3 bg-white/5 border border-primary/20 hover:bg-primary/5 text-primary px-6 py-4 rounded-xl font-display font-black text-[10px] tracking-[0.2em] transition-all group"
                        >
                            <Monitor size={18} className="group-hover:scale-110 transition-transform" />
                            MODO TV
                        </button>

                        {user ? (
                            <div className="flex items-center gap-4 bg-white/5 p-2 pr-6 rounded-2xl border border-white/10 group">
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-black border border-primary/20 uppercase relative">
                                    {user.email[0]}
                                    {user.is_premium && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-surface animate-bounce shadow-lg shadow-amber-500/50">
                                            < Ticket size={10} className="text-white" fill="white" />
                                        </div>
                                    )}
                                </div>
                                <div className="hidden md:block">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black tracking-widest text-primary uppercase leading-tight">Mi Cuenta</p>
                                        {user.is_premium && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-black border border-amber-500/20">PREMIUM</span>}
                                    </div>
                                    <p className="text-[12px] font-bold text-white/60 truncate max-w-[120px]">{user.email}</p>
                                </div>
                                <div className="flex gap-1 ml-2">
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="p-2 text-white/20 hover:text-amber-500 transition-colors"
                                        title="Canjear Código"
                                    >
                                        <Ticket size={18} />
                                    </button>
                                    <button onClick={handleLogout} className="p-2 text-white/20 hover:text-red-500 transition-colors" title="Cerrar Sesión">
                                        <LogOut size={18} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => navigate('/login')}
                                className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-display font-black text-[12px] tracking-widest transition-all border border-white/10"
                            >
                                INICIAR SESIÓN
                            </button>
                        )}
                        <button
                            onClick={handleCreateQuiz}
                            className="bg-primary hover:bg-primary-hover text-white px-10 py-5 rounded-2xl font-display font-black flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20 group"
                        >
                            <Plus size={24} className="group-hover:rotate-90 transition-transform" />
                            <span className="tracking-widest text-[14px]">NUEVO</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 w-full bg-surface-lowest/40 backdrop-blur-3xl rounded-3xl shadow-2xl flex flex-col relative overflow-hidden border border-white/10">
                    <nav className="flex items-center justify-between px-12 py-6 border-b border-white/5 relative z-30">
                        <div className="flex gap-10">
                            <button
                                onClick={() => setView('library')}
                                className={`flex items-center gap-3 text-[12px] font-black tracking-[0.3em] uppercase transition-all ${view === 'library' ? 'text-primary' : 'text-white/30 hover:text-white/60'}`}
                            >
                                <Library size={18} /> BIBLIOTECA PÚBLICA
                            </button>
                            {user && (
                                <button
                                    onClick={() => setView('mine')}
                                    className={`flex items-center gap-3 text-[12px] font-black tracking-[0.3em] uppercase transition-all ${view === 'mine' ? 'text-primary' : 'text-white/30 hover:text-white/60'}`}
                                >
                                    <User size={18} /> MIS TRIVIAS
                                </button>
                            )}
                        </div>

                        <div className="relative w-96 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="BUSCAR TEMAS, USUARIOS O TRIVIAS..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-6 text-[10px] font-black tracking-[0.2em] uppercase focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                            />
                        </div>
                    </nav>

                    <div className="flex-1 min-h-0 bg-black/40 shadow-inner flex flex-col overflow-hidden relative group/inner">
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 md:px-16 pt-8 pb-8">
                            <div className="lg:px-2">
                                {/* Active Games Section */}
                                {activeGames.length > 0 && (
                                    <div className="mb-12 animate-in fade-in slide-in-from-top duration-700">
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary uppercase tracking-[0.2em] text-[12px]">
                                            <Play size={16} className="fill-current" /> Partidas en curso
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {activeGames.map(g => (
                                                <div key={g.id} className="bg-white/5 border border-primary/20 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
                                                    <div className="flex justify-between items-start relative z-10">
                                                        <div>
                                                            <div className="text-[9px] font-black tracking-[0.3em] text-primary uppercase mb-1">CÓDIGO: {g.join_code}</div>
                                                            <h3 className="font-display font-black text-lg leading-tight line-clamp-1 uppercase">{g.quizzes?.title || 'Trivia'}</h3>
                                                            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Status: <span className="text-primary">{g.status}</span></div>
                                                        </div>
                                                        <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                                                            <Monitor size={18} />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 relative z-10">
                                                        <button
                                                            onClick={() => resumeGame(g.id)}
                                                            className="flex-1 bg-primary text-white py-3 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-primary-hover transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                                                        >
                                                            <Play size={14} fill="currentColor" /> Continuar
                                                        </button>
                                                        <button
                                                            onClick={() => finishGame(g.id)}
                                                            className="px-4 border border-white/10 hover:bg-white/5 py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all text-white/40 hover:text-white"
                                                        >
                                                            Finalizar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/5 to-transparent mt-12" />
                                    </div>
                                )}

                                {loading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                            <div key={i} className="h-[16rem] bg-white/5 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {quizzes.map(q => (
                                            <div key={q.id} className="group relative bg-surface-lowest/40 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-500 hover:shadow-xl flex flex-col h-[16rem]">
                                                {q.cover_image && (
                                                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none z-0">
                                                        <img src={q.cover_image} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}

                                                <div className="relative z-20 flex-1 flex flex-col p-6">
                                                    <div className="flex justify-between items-start mb-4 relative z-30">
                                                        <span className="bg-white/5 px-3 py-1 rounded-full text-[8px] font-black tracking-[0.2em] text-white/40 border border-white/10 uppercase">
                                                            @{q.profiles?.nickname || 'Autor'}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            {user && q.user_id === user.id && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); navigate(`/edit/${q.id}`) }}
                                                                        className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5 cursor-pointer"
                                                                        title="Configurar"
                                                                    >
                                                                        <Settings size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); deleteQuiz(q.id, q.title) }}
                                                                        className="p-2 bg-red-500/5 rounded-lg text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all border border-red-500/5 cursor-pointer"
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 flex flex-col justify-center">
                                                        <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:text-primary transition-colors line-clamp-2 leading-tight uppercase font-display">{q.title}</h3>
                                                        <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase opacity-60">
                                                            {q.questions?.length || 0} PREGUNTAS
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-6 pt-0 relative z-30 mt-auto">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startNewGame(q.id) }}
                                                        disabled={!q.questions || q.questions.length === 0}
                                                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all text-[10px] font-black tracking-[0.3em] cursor-pointer ${!q.questions || q.questions.length === 0
                                                            ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                                                            : 'bg-white/10 hover:bg-primary hover:text-white border border-white/10 hover:border-transparent active:scale-[0.98]'
                                                            }`}
                                                    >
                                                        <Play size={14} fill="currentColor" className={!q.questions || q.questions.length === 0 ? 'opacity-20' : ''} />
                                                        {(!q.questions || q.questions.length === 0) ? 'SIN PREGUNTAS' : 'INICIAR JUEGO'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {quizzes.length === 0 && !loading && (
                                            <div className="col-span-full h-full min-h-[400px] flex flex-col items-center justify-center gap-8 opacity-40">
                                                <div className="p-8 bg-white/5 rounded-full border border-white/10">
                                                    <PlusCircle size={48} className="text-primary animate-pulse" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xl font-black uppercase tracking-[0.5em] text-white">No hay resultados</p>
                                                    <p className="mt-4 text-[10px] text-white/40 font-bold tracking-[0.2em] uppercase">Intenta con otra búsqueda o cambia de pestaña</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PremiumModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    )
}
