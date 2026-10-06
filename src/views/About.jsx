import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, Tv, Smartphone, Volume2, ShieldAlert, Heart, Users, Zap } from 'lucide-react'

export default function About() {
    return (
        <div className="min-h-screen bg-[#0d0221] text-white selection:bg-pink-500 selection:text-white relative overflow-hidden flex flex-col">
            {/* Luces y ambiente gamer */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[130px] pointer-events-none" />
            <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[130px] pointer-events-none" />

            {/* Barra superior */}
            <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
                <Link
                    to="/"
                    className="flex items-center gap-2 text-white/70 hover:text-white text-xs md:text-sm font-black tracking-wider uppercase transition-colors"
                >
                    <ArrowLeft size={18} /> Volver a LukeQuiz
                </Link>
                <div className="flex items-center gap-2">
                    <span className="font-display font-black text-lg tracking-tight bg-gradient-to-r from-pink-500 to-cyan-400 bg-clip-text text-transparent">
                        LUKE QUIZ
                    </span>
                    <span className="text-[10px] bg-white/10 text-white/60 font-mono px-2 py-0.5 rounded-full">
                        lukeapp.cl
                    </span>
                </div>
            </header>

            {/* Contenido principal */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 md:py-16">
                {/* Hero */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-xs font-black uppercase tracking-widest mb-4">
                        <Sparkles size={14} /> La experiencia de trivia interactiva
                    </div>
                    <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight text-white uppercase mb-4">
                        Acerca de LukeQuiz
                    </h1>
                    <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Haz de tus preguntas un juego en vivo. Una plataforma interactiva diseñada para transformar cualquier clase, carrete, evento o transmisión en un auténtico concurso de televisión.
                    </p>
                </div>

                {/* Grid de Características */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 hover:border-pink-500/30 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                            <Tv size={24} />
                        </div>
                        <h3 className="font-black text-base uppercase text-white">Modo Pantalla TV</h3>
                        <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                            Proyecta la sala de espera con burbujas dinámicas, contador en tiempo real, efectos de sonido y podio animado para el público.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 hover:border-cyan-500/30 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                            <Smartphone size={24} />
                        </div>
                        <h3 className="font-black text-base uppercase text-white">Sin Instalar Apps</h3>
                        <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                            Los jugadores se unen desde el navegador de su teléfono con un código PIN de 4 dígitos o escaneando un código QR.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 hover:border-purple-500/30 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                            <Volume2 size={24} />
                        </div>
                        <h3 className="font-black text-base uppercase text-white">Voz IA y Audio Sync</h3>
                        <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                            Generación inteligente de trivias por temática, voces neuronales sincronizadas y biblioteca comunitaria de trivias.
                        </p>
                    </div>
                </div>

                {/* Tarjeta de Aviso Legal de Imágenes */}
                <div className="mb-12 p-6 md:p-8 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 font-black text-sm md:text-base uppercase tracking-wider">
                        <ShieldAlert size={20} /> Propiedad Intelectual y Fuentes Multimedia
                    </div>
                    <p className="text-white/80 text-xs md:text-sm leading-relaxed">
                        En LukeQuiz promovemos el respeto absoluto por los derechos de autor. <strong>Las imágenes mostradas en las preguntas creadas por los usuarios no se encuentran alojadas ni se almacenan en los servidores de LukeQuiz (<span className="text-cyan-300 font-mono">lukeapp.cl</span>).</strong>
                    </p>
                    <p className="text-white/70 text-xs leading-relaxed">
                        Corresponden a enlaces externos o sugerencias automáticas de repositorios públicos y de la web. Los derechos morales y patrimoniales corresponden exclusivamente a sus respectivos autores. Si detectas alguna imagen que requiera ser desvinculada o retirada, ponte en contacto con nosotros para su remoción inmediata.
                    </p>
                </div>

                {/* Ecosistema lukeapp.cl y Contacto */}
                <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-black uppercase text-pink-400 tracking-wider mb-1">
                            <Heart size={14} className="fill-current" /> Creado en Chile
                        </div>
                        <h3 className="text-xl font-black text-white uppercase">
                            Parte del ecosistema lukeapp.cl
                        </h3>
                        <p className="text-xs text-white/60 mt-1 max-w-md">
                            Desarrollado de forma independiente con foco en velocidad, diseño vibrante y diversión multijugador.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <Link
                            to="/terms"
                            className="text-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black tracking-wider uppercase transition-colors"
                        >
                            Términos de Uso
                        </Link>
                        <a
                            href="mailto:cristianluke@gmail.com"
                            className="text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-500 text-white text-xs font-black tracking-wider uppercase shadow-lg shadow-pink-500/20 hover:opacity-90 transition-opacity"
                        >
                            Contacto
                        </a>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-xs text-white/40">
                    <p>© 2026 LukeQuiz · https://quiz.lukeapp.cl</p>
                </div>
            </main>
        </div>
    )
}
