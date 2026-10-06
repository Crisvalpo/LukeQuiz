import React from 'react';

export default function LogoLukeQuiz({ className = "" }) {
  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Subtítulo superior */}
      <span className="text-[8px] sm:text-xs font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-pink-500/70 mb-1 animate-pulse text-center">
        Haz de tus preguntas un juego
      </span>

      {/* Contenedor Principal del Logo */}
      <div className="relative flex items-baseline justify-center group cursor-pointer w-full">
        
        {/* Halo de luz ambiental de fondo */}
        <div className="absolute -inset-2 bg-gradient-to-r from-pink-500/10 via-purple-500/20 to-pink-500/20 blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Texto "Luke" */}
        <span 
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900 }}
          className="text-3xl sm:text-5xl md:text-6xl italic tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)] antialiased"
        >
          Luke
        </span>

        {/* Texto "QUIZ" */}
        <span 
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900 }}
          className="text-3xl sm:text-5xl md:text-6xl italic tracking-tight text-[#ff2a85] drop-shadow-[0_0_15px_rgba(255,42,133,0.5)] antialiased"
        >
          QUIZ
        </span>

        {/* Signo de Interrogación Neón Animado */}
        <div className="relative inline-flex items-center ml-1 transform origin-bottom transition-transform duration-300 group-hover:scale-110">
          <span 
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900 }}
            className="luke-neon-question text-3xl sm:text-5xl md:text-6xl italic text-[#ff2a85] inline-block antialiased"
          >
            ?
          </span>

          {/* Partículas flotantes alrededor del signo */}
          <span className="sparkle sparkle-1" />
          <span className="sparkle sparkle-2" />
          <span className="sparkle sparkle-3" />
        </div>
      </div>
    </div>
  );
}
