import React from 'react';

export default function LogoLukeQuiz({ className = "w-64 h-auto" }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 400 80"
            className={className}
        >
            <defs>
                <style>
                    {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@1,900&display=swap');
            .logo-font {
              font-family: 'Inter', sans-serif;
              font-weight: 900;
              font-style: italic;
              font-size: 60px;
              letter-spacing: -3px;
            }
          `}
                </style>
            </defs>

            <text x="10" y="60" className="logo-font">
                {/* Usando colores de marca específicos - Blanco y Rosa */}
                <tspan fill="#ffffff">Luke</tspan>
                <tspan fill="#ec4899">QUIZ</tspan>
            </text>
        </svg>
    );
}
