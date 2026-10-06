import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, AlertTriangle, Copyright, Scale, Mail, CheckCircle } from 'lucide-react'

export default function Terms() {
    return (
        <div className="min-h-screen bg-[#0d0221] text-white selection:bg-pink-500 selection:text-white relative overflow-hidden flex flex-col">
            {/* Fondo con brillo ambiental */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Barra superior de navegación */}
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

            {/* Contenedor central */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 md:py-16">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-widest mb-4">
                        <Scale size={14} /> Legal & Condiciones
                    </div>
                    <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight text-white uppercase mb-3">
                        Términos de Servicio
                    </h1>
                    <p className="text-white/60 text-sm md:text-base max-w-2xl mx-auto">
                        Última actualización: Octubre 2026 · Conoce las condiciones de uso, políticas de contenido y derechos de autor en LukeQuiz.
                    </p>
                </div>

                {/* Tarjeta destacada de AVISO SOBRE IMÁGENES Y DERECHOS DE AUTOR */}
                <div className="mb-10 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-amber-500/15 via-red-500/10 to-transparent border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl shrink-0 mt-1">
                            <AlertTriangle size={28} />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-lg md:text-xl font-black text-amber-200 uppercase tracking-wide flex items-center gap-2">
                                <Copyright size={20} /> Aviso Crítico sobre Imágenes y Propiedad Intelectual
                            </h2>
                            <p className="text-white/90 text-sm md:text-base leading-relaxed">
                                <strong>Las imágenes y recursos multimedia asociados a las preguntas o trivias creadas por los usuarios NO se alojan ni almacenan en los servidores propios de LukeQuiz (<span className="text-cyan-300 font-mono">lukeapp.cl</span>).</strong>
                            </p>
                            <p className="text-white/80 text-xs md:text-sm leading-relaxed">
                                Dichas imágenes corresponden a enlaces referenciales o externos y son propiedad exclusiva de sus respectivos autores o titulares de derechos de autor. LukeQuiz no reclama propiedad intelectual ni comercializa con las imágenes enlazadas por terceros.
                            </p>
                            <p className="text-amber-100 text-xs md:text-sm bg-amber-500/20 p-3 rounded-xl border border-amber-500/30 font-medium">
                                <strong>Política de retiro inmediato:</strong> Si usted es el legítimo titular de los derechos de cualquier material enlazado y solicita su retiro o desvinculación, comuníquese con nosotros y el recurso será retirado de forma expedita e inmediata.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Secciones detalladas */}
                <div className="space-y-8 text-white/80 text-sm leading-relaxed">
                    {/* Sección 1 */}
                    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-3">
                        <div className="flex items-center gap-3 text-pink-400 font-black text-base uppercase tracking-wider">
                            <Shield size={18} /> 1. Aceptación de los Términos
                        </div>
                        <p>
                            Al acceder, navegar o utilizar <span className="text-white font-bold">LukeQuiz</span> en <span className="text-cyan-400 font-mono">https://quiz.lukeapp.cl</span>, declaras que tienes al menos 13 años de edad y aceptas cumplir íntegramente con estos Términos de Servicio. Si no estás de acuerdo con alguna disposición, debes abstenerte de utilizar la plataforma.
                        </p>
                    </section>

                    {/* Sección 2 */}
                    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-3">
                        <div className="flex items-center gap-3 text-cyan-400 font-black text-base uppercase tracking-wider">
                            <CheckCircle size={18} /> 2. Uso de la Plataforma y Contenido de Usuarios
                        </div>
                        <p>
                            LukeQuiz es un servicio interactivo de trivias para entretenimiento, educación y actividades grupales. Los usuarios son los únicos responsables de las preguntas, textos y enlaces que añadan a sus trivias.
                        </p>
                        <p>
                            Queda expresamente prohibido publicar contenido que sea difamatorio, obsceno, discriminatorio, que incite al odio, viole la privacidad o infrinja derechos de terceros. Nos reservamos el derecho de suspender o eliminar cualquier trivia que viole estas directrices.
                        </p>
                    </section>

                    {/* Sección 3 */}
                    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-3">
                        <div className="flex items-center gap-3 text-amber-400 font-black text-base uppercase tracking-wider">
                            <Scale size={18} /> 3. Pases Premium y Pagos
                        </div>
                        <p>
                            LukeQuiz ofrece la posibilidad de adquirir un <strong>Pase Diario Premium</strong> por <strong>$1.000 CLP</strong> mediante transferencia electrónica bancaria en Chile. Este pase concede acceso a funcionalidades avanzadas (como generación ilimitada con Inteligencia Artificial y síntesis de voz neuronal TTS) durante una vigencia de 24 horas continuas desde el momento de su activación.
                        </p>
                        <p>
                            La activación se realiza de manera automatizada al comprobar el número de operación bancario emitido por las entidades bancarias chilenas compatibles.
                        </p>
                    </section>

                    {/* Sección 4 */}
                    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-3">
                        <div className="flex items-center gap-3 text-purple-400 font-black text-base uppercase tracking-wider">
                            <Mail size={18} /> 4. Procedimiento de Notificación y Contacto (DMCA / Retiro)
                        </div>
                        <p>
                            Para enviar cualquier consulta legal, reclamo de derechos de autor o solicitud de retiro de enlaces a imágenes, puedes contactarnos directamente a través de:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-white pl-2">
                            <li>Correo electrónico de contacto: <a href="mailto:cristianluke@gmail.com" className="text-cyan-400 underline font-mono">cristianluke@gmail.com</a></li>
                            <li>Canal oficial: <a href="mailto:contacto@lukeapp.cl" className="text-cyan-400 underline font-mono">contacto@lukeapp.cl</a></li>
                            <li>Dominio principal: <span className="text-pink-400 font-mono">quiz.lukeapp.cl</span></li>
                        </ul>
                    </section>
                </div>

                {/* Footer de la página */}
                <div className="mt-12 text-center text-xs text-white/40">
                    <p>© 2026 LukeQuiz · Todos los derechos reservados · lukeapp.cl</p>
                </div>
            </main>
        </div>
    )
}
