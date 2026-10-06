import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    Plus, Play, Settings, Trash2, PlusCircle,
    Search, Library, User, LogOut, Ticket,
    Crown, Monitor, HardDrive, Gamepad2
} from 'lucide-react'
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
    const [filterType, setFilterType] = useState('recent') // 'recent', 'popular', 'category'
    const [selectedCategory, setSelectedCategory] = useState('General')
    const [searchQuery, setSearchQuery] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const navigate = useNavigate()

    // Lista de categorías (Misma que en EditQuiz)
    const CATEGORIES = ['General', 'Historia', 'Ciencia', 'Cine y TV', 'Deportes', 'Cultura Pop', 'Geografía', 'Música', 'Videojuegos']

    const isAdmin = user?.email === 'cristianluke@gmail.com'

    useEffect(() => {
        fetchQuizzes()
        fetchActiveGames()
    }, [view, searchQuery, user?.id, filterType, selectedCategory])

    const fetchActiveGames = async () => {
        let guestGames = []
        try {
            const saved = localStorage.getItem('guest_games')
            if (saved) guestGames = JSON.parse(saved)
        } catch (e) { console.error('Error loading guest games', e) }

        const { data: serverGames } = user ? await supabase
            .from('games')
            .select('*, quizzes(title)')
            .eq('user_id', user.id)
            .neq('status', 'finished')
            .order('created_at', { ascending: false }) : { data: [] }

        // Fetch guest games from server to ensure they still exist and are active
        let finalGuestGames = []
        if (guestGames.length > 0) {
            const { data: guestData } = await supabase
                .from('games')
                .select('*, quizzes(title)')
                .in('id', guestGames)
                .neq('status', 'finished')
            if (guestData) finalGuestGames = guestData
        }

        const combined = [...(serverGames || []), ...finalGuestGames]
        // Deduplicate and filter
        const unique = Array.from(new Map(combined.map(g => [g.id, g])).values())
        setActiveGames(unique)
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

        if (filterType === 'category' && selectedCategory) {
            query = query.eq('category', selectedCategory)
        }

        if (filterType === 'popular') {
            query = query.order('plays_count', { ascending: false, nullsFirst: false })
        } else {
            query = query.order('created_at', { ascending: false })
        }

        const { data, error } = await query.limit(30)

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
        const promise = new Promise(async (resolve, reject) => {
            const code = generateJoinCode()
            const { data: game, error } = await supabase
                .from('games')
                .insert({
                    quiz_id: quizId,
                    join_code: code,
                    status: 'waiting',
                    current_question_index: 0,
                    user_id: user?.id || null
                })
                .select()
                .single()

            if (error) reject(error)
            else {
                if (!user) {
                    const saved = localStorage.getItem('guest_games')
                    const current = saved ? JSON.parse(saved) : []
                    localStorage.setItem('guest_games', JSON.stringify([...current, game.id]))
                }
                resolve(game)
            }
        })

        toast.promise(promise, {
            loading: 'Iniciando partida...',
            success: (game) => {
                fetchActiveGames()
                navigate(`/screen/${game.id}`)
                return '¡Partida Iniciada!'
            },
            error: (err) => err?.code === '42501'
                ? 'Este quiz está pendiente de revisión de contenido (guárdalo de nuevo en el editor)'
                : 'Error al iniciar el juego'
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
        navigate(`/screen/${gameId}`)
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

            <div className="w-full h-screen flex flex-col px-[4vw] md:px-12 pt-[2vh] md:pt-6 pb-[2vh] md:pb-6 relative z-10 max-w-[1700px] mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-center mb-[4vh] md:mb-6 px-[2vw] md:px-8 pt-[2vh] md:pt-4 gap-[2vh] md:gap-0 shrink-0 relative z-20">
                    <div className="space-y-[1vh] md:space-y-4 text-center md:text-left">
                        <LogoLukeQuiz className="w-[60vw] md:w-80 h-auto md:-ml-3 mx-auto md:mx-0" />
                    </div>

                    <div className="flex items-center justify-center md:justify-end gap-[1vh] md:gap-4 lg:gap-6 flex-nowrap">
                        {/* MODO TV + MODO JUEGO: solo íconos en mobile, ícono+texto en desktop */}
                        <div className="flex items-center gap-[0.8vh] md:gap-2 h-[7vh] md:h-[64px]">
                            <button
                                onClick={() => navigate('/tv')}
                                title="Modo TV"
                                className="flex items-center justify-center h-full gap-[1vh] md:gap-2 bg-white/5 border border-primary/20 hover:bg-primary/5 text-primary px-[1.5vh] md:px-4 rounded-[1.5vh] md:rounded-xl font-display font-black text-[1.2vh] md:text-[10px] tracking-[0.2em] transition-all group"
                            >
                                <Monitor size={18} className="group-hover:scale-110 transition-transform shrink-0" />
                                <span className="hidden md:block">MODO TV</span>
                            </button>
                            <button
                                onClick={() => navigate('/join')}
                                title="Modo Juego"
                                className="flex items-center justify-center h-full gap-[1vh] md:gap-2 bg-white/5 border border-secondary/20 hover:bg-secondary/5 text-secondary px-[1.5vh] md:px-4 rounded-[1.5vh] md:rounded-xl font-display font-black text-[1.2vh] md:text-[10px] tracking-[0.2em] transition-all group"
                            >
                                <Gamepad2 size={18} className="group-hover:scale-110 transition-transform shrink-0" />
                                <span className="hidden md:block">MODO JUEGO</span>
                            </button>
                        </div>

                        {user ? (
                            <div className="flex items-center gap-[2vw] md:gap-4 bg-white/5 p-[1vh] md:p-2 pr-[2vh] md:pr-6 rounded-[2vh] md:rounded-2xl border border-white/10 group">
                                <div className="w-[5vh] h-[5vh] md:w-12 md:h-12 rounded-[1.2vh] md:rounded-xl bg-primary/20 flex items-center justify-center text-primary font-black border border-primary/20 uppercase relative text-[2vh] md:text-base">
                                    {user?.email?.[0]}
                                    {user?.is_premium && (
                                        <div className="absolute -top-1 -right-1 w-[2vh] h-[2vh] md:w-5 md:h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-surface animate-bounce shadow-lg shadow-amber-500/50">
                                            <Ticket size={10} className="text-white" fill="white" />
                                        </div>
                                    )}
                                </div>
                                <div className="hidden sm:block">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[1.2vh] md:text-[10px] font-black tracking-widest text-primary uppercase leading-tight">Mi Cuenta</p>
                                        {user?.is_premium && <span className="text-[1vh] md:text-[8px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-black border border-amber-500/20">PREMIUM</span>}
                                    </div>
                                    <p className="text-[1.4vh] md:text-[12px] font-bold text-white/60 truncate max-w-[100px] md:max-w-[120px]">{user.email}</p>
                                </div>
                                <div className="flex gap-[0.5vh] md:gap-1 ml-2">
                                    {user?.email === 'cristianluke@gmail.com' && (
                                        <button
                                            onClick={() => navigate('/admin')}
                                            className="p-[1vh] md:p-2 text-white/20 hover:text-primary transition-colors"
                                            title="Panel Admin"
                                        >
                                            <HardDrive size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="p-[1vh] md:p-2 text-white/20 hover:text-amber-500 transition-colors"
                                        title="Canjear Código"
                                    >
                                        <Ticket size={18} />
                                    </button>
                                    <button onClick={handleLogout} className="p-[1vh] md:p-2 text-white/20 hover:text-red-500 transition-colors" title="Cerrar Sesión">
                                        <LogOut size={18} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => navigate('/login')}
                                className="bg-white/5 hover:bg-white/10 text-white px-[3vh] md:px-8 py-[1.5vh] md:py-4 rounded-[1.5vh] md:rounded-xl font-display font-black text-[1.4vh] md:text-[12px] tracking-widest transition-all border border-white/10"
                            >
                                INICIAR SESIÓN
                            </button>
                        )}
                        <button
                            onClick={handleCreateQuiz}
                            className="bg-primary hover:bg-primary-hover text-white p-[1.5vh] md:px-6 lg:px-10 md:py-4 lg:py-5 rounded-[1.5vh] md:rounded-2xl font-display font-black flex items-center justify-center gap-[1.5vh] md:gap-3 lg:gap-4 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20 group text-[1.5vh] md:text-[14px] whitespace-nowrap"
                        >
                            <Plus size={24} className="group-hover:rotate-90 transition-transform w-[3vh] h-[3vh] md:w-5 md:h-5 lg:w-6 lg:h-6" />
                            <span className="hidden md:block tracking-widest uppercase text-[1.2vh] md:text-[12px] lg:text-[14px]">NUEVO</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 w-full bg-surface-lowest/40 backdrop-blur-3xl rounded-[3vh] md:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden border border-white/10">
                    <nav className="flex flex-col lg:flex-row items-center justify-between px-[4vh] lg:px-12 py-[3vh] lg:py-6 border-b border-white/5 relative z-30 gap-[2vh] lg:gap-0">
                        <div className="flex gap-[4vh] md:gap-10">
                            <button
                                onClick={() => setView('library')}
                                className={`flex items-center gap-[1.5vh] md:gap-3 text-[1.4vh] md:text-[12px] font-black tracking-[0.3em] uppercase transition-all ${view === 'library' ? 'text-primary' : 'text-white/30 hover:text-white/60'}`}
                            >
                                <Library size={18} /> BIBLIOTECA PÚBLICA
                            </button>
                            {user && (
                                <button
                                    onClick={() => setView('mine')}
                                    className={`flex items-center gap-[1.5vh] md:gap-3 text-[1.4vh] md:text-[12px] font-black tracking-[0.3em] uppercase transition-all ${view === 'mine' ? 'text-primary' : 'text-white/30 hover:text-white/60'}`}
                                >
                                    <User size={18} /> MIS TRIVIAS
                                </button>
                            )}
                        </div>

                        <div className="relative w-full lg:w-96 group">
                            <Search className="absolute left-[2vh] lg:left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="BUSCAR TEMAS, USUARIOS O TRIVIAS..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-[1.5vh] md:rounded-xl py-[1.5vh] md:py-3 pl-[6vh] lg:pl-12 pr-[2vh] lg:pr-6 text-[1.2vh] md:text-[10px] font-black tracking-[0.2em] uppercase focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                            />
                        </div>
                    </nav>

                    <div className="flex-1 min-h-0 bg-surface-lowest/60 backdrop-blur-xl border-t border-white/10 rounded-t-[3vh] md:rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden relative group/inner mx-[2vw] md:mx-4">
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-[2vh] md:px-12 pt-[4vh] md:pt-10 pb-[4vh] md:pb-8">
                            <div className="lg:px-2">
                                {/* Active Games Section */}
                                {activeGames.length > 0 && (
                                    <div className="mb-[6vh] md:mb-12 animate-in fade-in slide-in-from-top duration-700">
                                        <h2 className="text-[1.8vh] md:text-xl font-bold mb-[2vh] md:mb-4 flex items-center gap-[1vh] md:gap-2 text-primary uppercase tracking-[0.2em]">
                                            <Play size={16} className="fill-current" /> Partidas en curso
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[3vh] md:gap-6">
                                            {activeGames.map(g => (
                                                <div key={g.id} className="bg-white/5 border border-primary/20 rounded-[2vh] md:rounded-2xl p-[3vh] md:p-6 flex flex-col gap-[2vh] md:gap-5 shadow-2xl relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-[15vh] h-[15vh] md:w-32 md:h-32 bg-primary/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
                                                    <div className="flex justify-between items-start relative z-10">
                                                        <div>
                                                            <div className="text-[1vh] md:text-[9px] font-black tracking-[0.3em] text-primary uppercase mb-1">CÓDIGO: {g.join_code}</div>
                                                            <h3 className="font-display font-black text-[2.2vh] md:text-lg leading-tight line-clamp-1 uppercase">{g.quizzes?.title || 'Trivia'}</h3>
                                                            <div className="text-[1.2vh] md:text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Status: <span className="text-primary">{g.status}</span></div>
                                                        </div>
                                                        <div className="p-[1.5vh] md:p-3 bg-primary/10 rounded-[1vh] md:rounded-xl text-primary border border-primary/20">
                                                            <Monitor size={18} />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-[1.5vh] md:gap-3 relative z-10">
                                                        <button
                                                            onClick={() => resumeGame(g.id)}
                                                            className="flex-1 bg-primary text-white py-[1.8vh] md:py-3 rounded-[1vh] md:rounded-xl font-black text-[1.4vh] md:text-[10px] tracking-widest uppercase hover:bg-primary-hover transition-all flex items-center justify-center gap-[1vh] md:gap-2 shadow-lg shadow-primary/20 text-center"
                                                        >
                                                            <Play size={14} fill="currentColor" /> Continuar
                                                        </button>
                                                        <button
                                                            onClick={() => finishGame(g.id)}
                                                            className="px-[2vh] md:px-4 border border-white/10 hover:bg-white/5 py-[1.8vh] md:py-3 rounded-[1vh] md:rounded-xl text-[1.2vh] md:text-[9px] font-black tracking-widest uppercase transition-all text-white/40 hover:text-white"
                                                        >
                                                            Finalizar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/5 to-transparent mt-[6vh] md:mt-12" />
                                    </div>
                                )}

                                {/* Pestañas de Filtro (Recientes, Populares, Categorías) */}
                                <div className="mb-[4vh] md:mb-8 animate-in fade-in slide-in-from-bottom duration-500">
                                    <div className="flex flex-col md:flex-row gap-[2vh] md:gap-4 items-start md:items-center">
                                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 shrink-0">
                                            <button
                                                onClick={() => setFilterType('recent')}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${filterType === 'recent' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                                            >
                                                Nuevos
                                            </button>
                                            <button
                                                onClick={() => setFilterType('popular')}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1 ${filterType === 'popular' ? 'bg-orange-500/20 text-orange-400 shadow-sm border border-orange-500/20' : 'text-white/40 hover:text-orange-400/50'}`}
                                            >
                                                🔥 Populares
                                            </button>
                                            <button
                                                onClick={() => setFilterType('category')}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${filterType === 'category' ? 'bg-primary/20 text-primary shadow-sm border border-primary/20' : 'text-white/40 hover:text-primary/80'}`}
                                            >
                                                Categorías
                                            </button>
                                        </div>

                                        {/* Pills de Categorías (se muestran solo si el filtro es 'category') */}
                                        {filterType === 'category' && (
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar w-full pb-2 md:pb-0 mask-edges-right">
                                                {CATEGORIES.map(cat => (
                                                    <button
                                                        key={cat}
                                                        onClick={() => setSelectedCategory(cat)}
                                                        className={`px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase whitespace-nowrap transition-all border ${selectedCategory === cat ? 'bg-primary text-white border-primary' : 'bg-transparent border-white/10 text-white/40 hover:border-white/30 hover:text-white'}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[4vh] md:gap-8">
                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                            <div key={i} className="h-[25vh] md:h-[16rem] bg-white/5 rounded-[2vh] md:rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[2vh] md:gap-6">
                                        {quizzes.map(q => (
                                            <div key={q.id} className="group relative bg-white rounded-[1.5vh] md:rounded-2xl overflow-hidden shadow-lg hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-[28vh] md:h-[18rem] cursor-pointer border border-white/5">
                                                
                                                {/* Mitad Superior: Imagen y Tags */}
                                                <div className="relative h-[55%] w-full bg-slate-200 overflow-hidden">
                                                    {q.cover_image ? (
                                                        <img src={q.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                                            <span className="text-primary/50 font-black text-[2vh] md:text-xl tracking-widest">LUKEQUIZ</span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Badge de Autor (Top Left) */}
                                                    <div className="absolute top-2 left-2">
                                                        <span className="bg-white/95 text-slate-800 px-2 py-1 rounded-[0.8vh] md:rounded-md text-[1vh] md:text-[9px] font-black tracking-widest uppercase shadow-sm">
                                                            @{q.profiles?.nickname || 'Autor'}
                                                        </span>
                                                    </div>

                                                    {/* Tags de Stats (Bottom Right - estilo Kahoot) */}
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                                        {(q.plays_count > 0 || filterType === 'popular') && (
                                                            <span className="bg-black/80 backdrop-blur-sm text-white text-[1vh] md:text-[10px] font-black px-2 py-1 rounded-[0.8vh] md:rounded-md flex items-center gap-1">
                                                                🔥 {q.plays_count || 0}
                                                            </span>
                                                        )}
                                                        <span className="bg-black/80 backdrop-blur-sm text-white text-[1vh] md:text-[10px] font-black px-2 py-1 rounded-[0.8vh] md:rounded-md flex items-center gap-1">
                                                            <span className="hidden md:inline">📄</span> {q.questions?.length || 0}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Mitad Inferior: Info y Controles */}
                                                <div className="flex-1 flex flex-col p-[1.5vh] md:p-4 bg-white relative">
                                                    <h3 className="text-[1.8vh] md:text-[15px] font-black text-slate-800 leading-tight line-clamp-2 uppercase font-display group-hover:text-primary transition-colors">
                                                        {q.title}
                                                    </h3>
                                                    
                                                    <div className="mt-auto flex justify-between items-center pt-[1vh] md:pt-2">
                                                        {/* Botón Principal */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startNewGame(q.id) }}
                                                            disabled={!q.questions || q.questions.length === 0}
                                                            className={`flex-1 py-[1vh] md:py-2.5 rounded-[1vh] md:rounded-lg flex items-center justify-center gap-2 text-[1.2vh] md:text-[10px] font-black tracking-widest transition-all ${!q.questions || q.questions.length === 0
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : 'bg-primary text-white hover:bg-primary-hover shadow-md active:scale-95'
                                                                }`}
                                                        >
                                                            <Play size={12} fill="currentColor" /> <span className="hidden md:inline">INICIAR</span>
                                                        </button>

                                                        {/* Controles de Autor */}
                                                        {user && (q.user_id === user.id || isAdmin) && (
                                                            <div className="flex gap-1 ml-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); navigate(`/edit/${q.id}`) }}
                                                                    className="p-[1vh] md:p-2 bg-slate-100 rounded-[1vh] md:rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-all"
                                                                    title="Configurar"
                                                                >
                                                                    <Settings size={14} className="w-[1.5vh] h-[1.5vh] md:w-[14px] md:h-[14px]" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); deleteQuiz(q.id, q.title) }}
                                                                    className="p-[1vh] md:p-2 bg-red-50 rounded-[1vh] md:rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={14} className="w-[1.5vh] h-[1.5vh] md:w-[14px] md:h-[14px]" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {quizzes.length === 0 && !loading && (
                                            <div className="col-span-full h-full min-h-[40vh] md:min-h-[400px] flex flex-col items-center justify-center gap-[4vh] md:gap-8 opacity-40">
                                                <div className="p-[4vh] md:p-8 bg-white/5 rounded-full border border-white/10">
                                                    <PlusCircle size={48} className="text-primary animate-pulse w-[8vh] h-[8vh] md:w-12 md:h-12" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[2.5vh] md:text-xl font-black uppercase tracking-[0.5em] text-white">No hay resultados</p>
                                                    <p className="mt-[2vh] md:mt-4 text-[1.2vh] md:text-[10px] text-white/40 font-bold tracking-[0.2em] uppercase">Intenta con otra búsqueda o cambia de pestaña</p>
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
