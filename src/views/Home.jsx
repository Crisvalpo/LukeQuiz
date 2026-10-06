import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    Plus, Play, Settings, Trash2, PlusCircle,
    Search, Library, User, LogOut, Ticket,
    Crown, Monitor, HardDrive, Gamepad2,
    ChevronLeft, ChevronRight, Loader2
} from 'lucide-react'
import { generateJoinCode } from '../utils/helpers'
import { toast } from 'sonner'
import LogoLukeQuiz from '../components/LogoLukeQuiz'
import { useAuth } from '../lib/AuthContext'
import Modal from '../components/Modal'
import PremiumModal from '../components/PremiumModal'

const PAGE_SIZE = 12

export default function Home() {
    const { user, refreshProfile } = useAuth()
    const [activeGames, setActiveGames] = useState([])
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const [isBackgroundFetching, setIsBackgroundFetching] = useState(false)
    const [view, setView] = useState('library') // 'library' or 'mine'
    const [filterType, setFilterType] = useState('recent') // 'recent', 'popular', 'category'
    const [selectedCategory, setSelectedCategory] = useState('General')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const navigate = useNavigate()

    // Caché en memoria para transiciones instantáneas (SWR)
    const cacheRef = useRef(new Map())
    const fetchIdRef = useRef(0)

    // Lista de categorías (Misma que en EditQuiz)
    const CATEGORIES = ['General', 'Historia', 'Ciencia', 'Cine y TV', 'Deportes', 'Cultura Pop', 'Geografía', 'Música', 'Videojuegos']
    const isAdmin = user?.email === 'cristianluke@gmail.com'

    // Debounce de búsqueda para evitar peticiones en cada tecla
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim())
            setPage(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Carga de partidas activas
    useEffect(() => {
        fetchActiveGames()
    }, [user?.id])

    // Carga de quizzes con paginación
    useEffect(() => {
        fetchQuizzes()
    }, [view, debouncedSearch, user?.id, filterType, selectedCategory, page])

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    }, [totalCount])

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
        const unique = Array.from(new Map(combined.map(g => [g.id, g])).values())
        setActiveGames(unique)
    }

    const fetchQuizzes = async () => {
        const currentFetchId = ++fetchIdRef.current
        const cacheKey = `${view}_${filterType}_${selectedCategory}_${debouncedSearch}_p${page}_${user?.id || 'anon'}`

        // 1. Si está en caché, mostrar inmediatamente sin skeletons
        if (cacheRef.current.has(cacheKey)) {
            const cached = cacheRef.current.get(cacheKey)
            setQuizzes(cached.quizzes)
            setTotalCount(cached.totalCount)
            setLoading(false)
            setIsBackgroundFetching(true)
        } else {
            // Si no hay quizzes en pantalla, mostrar skeleton
            if (quizzes.length === 0) {
                setLoading(true)
            } else {
                setIsBackgroundFetching(true)
            }
        }

        try {
            let query = supabase
                .from('quizzes')
                .select('*, questions(id, image_url, is_cover), profiles:user_id(nickname)', { count: 'exact' })

            if (view === 'mine' && user) {
                query = query.eq('user_id', user.id)
            } else {
                query = query.eq('visibility', 'public')
            }

            if (debouncedSearch) {
                query = query.ilike('title', `%${debouncedSearch}%`)
            }

            if (filterType === 'category' && selectedCategory) {
                query = query.eq('category', selectedCategory)
            }

            if (filterType === 'popular') {
                query = query.order('plays_count', { ascending: false, nullsFirst: false })
            } else {
                query = query.order('created_at', { ascending: false })
            }

            const from = (page - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1
            const { data, count, error } = await query.range(from, to)

            // Evitar condición de carrera si el usuario cambió de filtro rápidamente
            if (currentFetchId !== fetchIdRef.current) return

            if (error) {
                console.error('Error al cargar quizzes:', error)
                toast.error('No se pudieron obtener las trivias')
            } else {
                const processed = (data || []).map(quiz => {
                    const coverQ = quiz.questions?.find(q => q.is_cover && q.image_url)
                    const firstImg = coverQ?.image_url || quiz.questions?.find(q => q.image_url)?.image_url || null
                    return { ...quiz, cover_image: firstImg }
                })

                setQuizzes(processed)
                const safeCount = typeof count === 'number' ? count : processed.length
                setTotalCount(safeCount)

                // Guardar en caché en memoria
                cacheRef.current.set(cacheKey, {
                    quizzes: processed,
                    totalCount: safeCount
                })
            }
        } catch (err) {
            console.error('Excepción al consultar quizzes:', err)
        } finally {
            if (currentFetchId === fetchIdRef.current) {
                setLoading(false)
                setIsBackgroundFetching(false)
            }
        }
    }

    const handleViewChange = (newView) => {
        if (newView === view) return
        setView(newView)
        setPage(1)
    }

    const handleFilterChange = (newFilter) => {
        if (newFilter === filterType) return
        setFilterType(newFilter)
        setPage(1)
    }

    const handleCategoryChange = (newCat) => {
        if (newCat === selectedCategory) return
        setSelectedCategory(newCat)
        setPage(1)
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
                cacheRef.current.clear() // Invalidar caché
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
        <div className="min-h-screen bg-[#240b49] selection:bg-primary/30 font-body relative overflow-hidden">
            {/* Doodle Wallpaper Background */}
            <div
                className="fixed inset-0 pointer-events-none bg-cover bg-center opacity-30 md:opacity-35"
                style={{ backgroundImage: `url('/bg-doodle.jpg')` }}
            />
            {/* Ambient Lighting & Kahoot-Style Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none bg-gradient-to-b from-[#240b49]/60 via-[#1a0836]/75 to-[#120428]/90">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-24 w-80 h-80 bg-secondary/15 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl" />
            </div>

            <div className="w-full h-screen flex flex-col px-4 md:px-10 pt-4 pb-4 relative z-10 max-w-[1700px] mx-auto">
                {/* Header Superior */}
                <header className="flex flex-col md:flex-row justify-between items-center mb-4 px-2 md:px-4 pt-2 gap-3 md:gap-0 shrink-0 relative z-20">
                    <div className="space-y-1 text-center md:text-left">
                        <LogoLukeQuiz className="w-56 md:w-72 h-auto mx-auto md:mx-0" />
                    </div>

                    <div className="flex items-center justify-center md:justify-end gap-2 md:gap-4 flex-nowrap">
                        {/* Modo TV + Modo Juego */}
                        <div className="flex items-center gap-2 h-11">
                            <button
                                onClick={() => navigate('/tv')}
                                title="Modo TV"
                                className="flex items-center justify-center h-full gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white px-3 md:px-4 rounded-xl font-display font-black text-[11px] tracking-wider transition-all group shadow-sm"
                            >
                                <Monitor size={17} className="text-secondary group-hover:scale-110 transition-transform shrink-0" />
                                <span className="hidden md:block">MODO TV</span>
                            </button>
                            <button
                                onClick={() => navigate('/join')}
                                title="Modo Juego"
                                className="flex items-center justify-center h-full gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white px-3 md:px-4 rounded-xl font-display font-black text-[11px] tracking-wider transition-all group shadow-sm"
                            >
                                <Gamepad2 size={17} className="text-primary group-hover:scale-110 transition-transform shrink-0" />
                                <span className="hidden md:block">MODO JUEGO</span>
                            </button>
                        </div>

                        {user ? (
                            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-1.5 pr-4 rounded-xl border border-white/15 group shadow-sm">
                                <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black border border-primary/30 uppercase relative text-sm">
                                    {user?.email?.[0]}
                                    {user?.is_premium && (
                                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center border border-[#240b49] animate-bounce shadow-md">
                                            <Ticket size={8} className="text-white" fill="white" />
                                        </div>
                                    )}
                                </div>
                                <div className="hidden sm:block">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[10px] font-black tracking-wider text-pink-300 uppercase leading-tight">Mi Cuenta</p>
                                        {user?.is_premium && <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md font-black border border-amber-500/30">PREMIUM</span>}
                                    </div>
                                    <p className="text-[12px] font-bold text-white/80 truncate max-w-[120px]">{user.email}</p>
                                </div>
                                <div className="flex gap-1 ml-1">
                                    {user?.email === 'cristianluke@gmail.com' && (
                                        <button
                                            onClick={() => navigate('/admin')}
                                            className="p-1.5 text-white/40 hover:text-primary transition-colors"
                                            title="Panel Admin"
                                        >
                                            <HardDrive size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="p-1.5 text-white/40 hover:text-amber-400 transition-colors"
                                        title="Canjear Código"
                                    >
                                        <Ticket size={16} />
                                    </button>
                                    <button onClick={handleLogout} className="p-1.5 text-white/40 hover:text-red-400 transition-colors" title="Cerrar Sesión">
                                        <LogOut size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => navigate('/login')}
                                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-display font-black text-xs tracking-wider transition-all border border-white/15 shadow-sm"
                            >
                                INICIAR SESIÓN
                            </button>
                        )}
                        <button
                            onClick={handleCreateQuiz}
                            className="bg-primary hover:bg-primary-hover active:scale-95 text-white px-5 py-2.5 rounded-xl font-display font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/30 group text-xs tracking-wider whitespace-nowrap"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                            <span className="hidden md:block uppercase">NUEVO</span>
                        </button>
                    </div>
                </header>

                {/* Contenedor Principal Unificado */}
                <div className="flex-1 w-full bg-[#180830]/70 backdrop-blur-2xl rounded-2xl shadow-2xl flex flex-col relative overflow-hidden border border-white/10">
                    {/* Barra de Navegación & Búsqueda */}
                    <nav className="flex flex-col lg:flex-row items-center justify-between px-6 lg:px-8 py-3.5 border-b border-white/10 relative z-30 gap-3 lg:gap-0 shrink-0">
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleViewChange('library')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all ${view === 'library' ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                            >
                                <Library size={16} /> BIBLIOTECA PÚBLICA
                            </button>
                            {user && (
                                <button
                                    onClick={() => handleViewChange('mine')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all ${view === 'mine' ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                                >
                                    <User size={16} /> MIS TRIVIAS
                                </button>
                            )}
                        </div>

                        {/* Buscador con indicador sutil de carga */}
                        <div className="relative w-full lg:w-96 group">
                            {isBackgroundFetching ? (
                                <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" size={16} />
                            ) : (
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors" size={16} />
                            )}
                            <input
                                type="text"
                                placeholder="Buscar temas, usuarios o trivias..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/10 focus:bg-white focus:text-slate-900 border border-white/15 focus:border-white rounded-xl py-2 pl-10 pr-4 text-xs font-bold tracking-wide text-white placeholder:text-white/40 focus:placeholder:text-slate-400 focus:outline-none transition-all shadow-inner"
                            />
                        </div>
                    </nav>

                    {/* Área de Contenido Principal */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 pt-5 pb-6">
                        {/* Partidas en curso (si existen) */}
                        {activeGames.length > 0 && (
                            <div className="mb-8 animate-in fade-in slide-in-from-top duration-500">
                                <h2 className="text-sm md:text-base font-black mb-3 flex items-center gap-2 text-pink-300 uppercase tracking-wider">
                                    <Play size={15} className="fill-current text-primary" /> Partidas en curso
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {activeGames.map(g => (
                                        <div key={g.id} className="bg-white/10 border border-white/15 rounded-xl p-4 flex flex-col gap-3 shadow-lg relative overflow-hidden group hover:border-primary/40 transition-all">
                                            <div className="flex justify-between items-start relative z-10">
                                                <div>
                                                    <div className="text-[10px] font-black tracking-widest text-pink-300 uppercase mb-0.5">CÓDIGO: {g.join_code}</div>
                                                    <h3 className="font-display font-black text-base leading-tight line-clamp-1 uppercase text-white">{g.quizzes?.title || 'Trivia'}</h3>
                                                    <div className="text-[11px] text-white/50 font-bold uppercase tracking-wider mt-0.5">Status: <span className="text-secondary">{g.status}</span></div>
                                                </div>
                                                <div className="p-2 bg-primary/20 rounded-lg text-primary border border-primary/30">
                                                    <Monitor size={16} />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 relative z-10">
                                                <button
                                                    onClick={() => resumeGame(g.id)}
                                                    className="flex-1 bg-primary text-white py-2 rounded-lg font-black text-xs tracking-wider uppercase hover:bg-primary-hover transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 active:scale-95"
                                                >
                                                    <Play size={13} fill="currentColor" /> Continuar
                                                </button>
                                                <button
                                                    onClick={() => finishGame(g.id)}
                                                    className="px-3 border border-white/15 hover:bg-white/10 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all text-white/60 hover:text-white"
                                                >
                                                    Finalizar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="h-[1px] w-full bg-white/10 mt-6" />
                            </div>
                        )}

                        {/* Filtros: Nuevos, Populares, Categorías */}
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom duration-300">
                            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex bg-white/10 rounded-xl p-1 border border-white/15 shrink-0 shadow-sm">
                                        <button
                                            onClick={() => handleFilterChange('recent')}
                                            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black tracking-wider uppercase transition-all ${filterType === 'recent' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/60 hover:text-white'}`}
                                        >
                                            Nuevos
                                        </button>
                                        <button
                                            onClick={() => handleFilterChange('popular')}
                                            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black tracking-wider uppercase transition-all flex items-center gap-1.5 ${filterType === 'popular' ? 'bg-orange-500 text-white shadow-sm' : 'text-white/60 hover:text-orange-300'}`}
                                        >
                                            🔥 Populares
                                        </button>
                                        <button
                                            onClick={() => handleFilterChange('category')}
                                            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black tracking-wider uppercase transition-all ${filterType === 'category' ? 'bg-primary text-white shadow-sm' : 'text-white/60 hover:text-pink-300'}`}
                                        >
                                            Categorías
                                        </button>
                                    </div>

                                    {/* Pills de Categorías */}
                                    {filterType === 'category' && (
                                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                            {CATEGORIES.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => handleCategoryChange(cat)}
                                                    className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase whitespace-nowrap transition-all border ${selectedCategory === cat ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white/10 border-white/15 text-white/70 hover:bg-white/15 hover:text-white'}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Contador de trivias totales */}
                                {!loading && totalCount > 0 && (
                                    <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest hidden sm:block">
                                        Total: <span className="text-white">{totalCount}</span> {totalCount === 1 ? 'trivia' : 'trivias'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Grid de Quizzes */}
                        {loading && quizzes.length === 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                                    <div key={i} className="h-64 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 transition-opacity duration-200 ${isBackgroundFetching ? 'opacity-70' : 'opacity-100'}`}>
                                    {quizzes.map(q => (
                                        <div
                                            key={q.id}
                                            className="group relative bg-white rounded-xl overflow-hidden shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col h-[270px] md:h-[280px] cursor-pointer border border-slate-100"
                                        >
                                            {/* Mitad Superior: Imagen y Tags */}
                                            <div className="relative h-[54%] w-full bg-slate-200 overflow-hidden">
                                                {q.cover_image ? (
                                                    <img src={q.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 flex items-center justify-center">
                                                        <span className="text-primary/60 font-black text-sm md:text-base tracking-widest">LUKEQUIZ</span>
                                                    </div>
                                                )}

                                                {/* Badge de Autor (Top Left) */}
                                                <div className="absolute top-2 left-2">
                                                    <span className="bg-white/95 text-slate-800 px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase shadow-sm border border-slate-200/60">
                                                        @{q.profiles?.nickname || 'Autor'}
                                                    </span>
                                                </div>

                                                {/* Tags de Stats (Bottom Right - estilo Kahoot) */}
                                                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                                    {(q.plays_count > 0 || filterType === 'popular') && (
                                                        <span className="bg-slate-900/85 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                            🔥 {q.plays_count || 0}
                                                        </span>
                                                    )}
                                                    <span className="bg-slate-900/85 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                        <span className="hidden md:inline">📄</span> {q.questions?.length || 0}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Mitad Inferior: Info y Controles */}
                                            <div className="flex-1 flex flex-col p-3.5 bg-white relative">
                                                <h3 className="text-xs md:text-sm font-black text-slate-900 leading-snug line-clamp-2 uppercase font-display group-hover:text-primary transition-colors">
                                                    {q.title}
                                                </h3>

                                                <div className="mt-auto flex justify-between items-center pt-2">
                                                    {/* Botón Principal INICIAR */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startNewGame(q.id) }}
                                                        disabled={!q.questions || q.questions.length === 0}
                                                        className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-black tracking-wider transition-all ${
                                                            !q.questions || q.questions.length === 0
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : 'bg-primary text-white hover:bg-primary-hover shadow-sm active:scale-95'
                                                        }`}
                                                    >
                                                        <Play size={12} fill="currentColor" /> <span className="hidden md:inline">INICIAR</span>
                                                    </button>

                                                    {/* Controles de Autor */}
                                                    {user && (q.user_id === user.id || isAdmin) && (
                                                        <div className="flex gap-1 ml-1.5">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); navigate(`/edit/${q.id}`) }}
                                                                className="p-1.5 bg-slate-100 rounded-lg text-slate-600 hover:text-primary hover:bg-primary/10 transition-all"
                                                                title="Configurar"
                                                            >
                                                                <Settings size={13} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); deleteQuiz(q.id, q.title) }}
                                                                className="p-1.5 bg-rose-50 rounded-lg text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {quizzes.length === 0 && !loading && (
                                        <div className="col-span-full h-full min-h-[300px] flex flex-col items-center justify-center gap-4 opacity-50">
                                            <div className="p-6 bg-white/10 rounded-full border border-white/15">
                                                <PlusCircle size={36} className="text-primary animate-pulse" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-base font-black uppercase tracking-widest text-white">No hay resultados</p>
                                                <p className="mt-1 text-xs text-white/50 font-bold tracking-wider uppercase">Intenta con otra búsqueda o cambia de categoría</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Barra de Paginación */}
                                {totalPages > 1 && !loading && (
                                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 px-6 backdrop-blur-md">
                                        <div className="text-xs text-white/50 font-medium">
                                            Página <span className="text-white font-bold">{page}</span> de <span className="text-white font-bold">{totalPages}</span>
                                            <span className="text-white/30 ml-2">({totalCount} trivias)</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1 || isBackgroundFetching}
                                                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                            >
                                                <ChevronLeft size={16} /> Anterior
                                            </button>

                                            <div className="flex items-center gap-1 px-1">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                                                    .map((p, idx, arr) => {
                                                        const prev = arr[idx - 1]
                                                        return (
                                                            <React.Fragment key={p}>
                                                                {prev && p - prev > 1 && (
                                                                    <span className="text-white/30 text-xs px-1 select-none">...</span>
                                                                )}
                                                                <button
                                                                    onClick={() => setPage(p)}
                                                                    disabled={isBackgroundFetching}
                                                                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                                                                        page === p
                                                                            ? 'bg-primary text-white shadow-md shadow-primary/30 scale-105'
                                                                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                                                                    }`}
                                                                >
                                                                    {p}
                                                                </button>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                            </div>

                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page >= totalPages || isBackgroundFetching}
                                                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                            >
                                                Siguiente <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
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
