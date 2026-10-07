import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, FileText, Mail, AlertCircle, ExternalLink } from 'lucide-react'

export default function Terms() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-slate-800 selection:text-white font-sans">
            {/* Barra Superior Corporativa */}
            <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-xs">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1 px-2.5 rounded-md hover:bg-slate-100"
                        >
                            <ArrowLeft size={16} /> Volver a la plataforma
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold tracking-tight text-slate-900">
                            LUKEQUIZ
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono">
                            lukeapp.cl
                        </span>
                    </div>
                </div>
            </header>

            {/* Documento Institucional */}
            <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
                <article className="bg-white border border-slate-200 rounded-xl shadow-xs p-8 md:p-14 space-y-8">
                    {/* Encabezado del Documento */}
                    <header className="border-b border-slate-200 pb-8 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <FileText size={16} /> Documento Legal Institucional
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                            Términos y Condiciones del Servicio
                        </h1>
                        <p className="text-xs text-slate-500">
                            Última actualización: 7 de Octubre de 2026 · Versión 2.1 · Plataforma web: <a href="https://quiz.lukeapp.cl" className="text-slate-700 underline font-mono">https://quiz.lukeapp.cl</a>
                        </p>
                    </header>

                    {/* Cláusula Destacada: Alojamiento de Imágenes y Derechos de Autor */}
                    <section className="bg-slate-50 border-l-4 border-slate-800 p-6 rounded-r-lg space-y-3">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wide">
                            <AlertCircle size={18} className="text-slate-700" />
                            Declaración sobre Propiedad Intelectual e Imágenes de Terceros
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700">
                            <strong>Las imágenes, fotografías y recursos multimedia vinculados a las preguntas o trivias creadas por los usuarios NO se alojan ni almacenan en los servidores propios de LukeQuiz ni de <span className="font-mono">lukeapp.cl</span>.</strong>
                        </p>
                        <p className="text-xs md:text-sm leading-relaxed text-slate-600">
                            La plataforma opera exclusivamente mediante hipervínculos referenciales a recursos disponibles públicamente en Internet. Dichos contenidos son propiedad exclusiva y legítima de sus respectivos autores o titulares de derechos de autor. LukeQuiz no reclama titularidad, patrocinio ni derechos comerciales sobre las imágenes vinculadas por terceros.
                        </p>
                        <div className="pt-1 text-xs text-slate-700 font-medium bg-white p-3 rounded border border-slate-200">
                            <strong>Política de retiro inmediato:</strong> Cualquier titular de derechos que requiera la desvinculación o remoción de un enlace multimedia puede solicitarlo formalmente escribiendo a <a href="mailto:contacto@lukeapp.cl" className="font-semibold text-slate-900 underline">contacto@lukeapp.cl</a>, procediéndose al retiro expedito del contenido en un plazo no mayor a 24 horas hábiles.
                        </div>
                    </section>

                    {/* Secciones Legales Numeradas */}
                    <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
                        <section className="space-y-2">
                            <h2 className="text-base font-bold text-slate-900">
                                1. Objeto y Alcance del Servicio
                            </h2>
                            <p>
                                LukeQuiz es una plataforma web desarrollada en Chile, diseñada para la creación, proyección y participación interactiva en trivias y cuestionarios en tiempo real con fines recreativos, educativos y comunitarios. El acceso y uso del sitio implica la aceptación plena de los presentes Términos y Condiciones.
                            </p>
                        </section>

                        <section className="space-y-2">
                            <h2 className="text-base font-bold text-slate-900">
                                2. Responsabilidad sobre el Contenido Generado por Usuarios
                            </h2>
                            <p>
                                Cada usuario registrado o anfitrión es el único y exclusivo responsable del texto de las preguntas, opciones de respuesta, títulos y enlaces incorporados a sus trivias. Queda estrictamente prohibido el uso de la plataforma para difundir material ilícito, difamatorio, que vulnere la privacidad de terceros o que incite al odio o a la discriminación. La administración se reserva la facultad de suspender o remover cualquier cuestionario que contravenga estas disposiciones.
                            </p>
                        </section>

                        <section className="space-y-2">
                            <h2 className="text-base font-bold text-slate-900">
                                3. Servicios Premium y Pases Diarios
                            </h2>
                            <p>
                                LukeQuiz pone a disposición de sus usuarios la opción de contratar un <strong>Pase Diario Premium</strong> con un valor de <strong>$1.000 CLP</strong> (mil pesos chilenos). Este servicio concede acceso durante un período continuo de 24 horas a utilidades complementarias, incluyendo síntesis de voz neuronal (TTS) y asistencia de inteligencia artificial para la formulación de cuestionarios.
                            </p>
                            <p className="text-xs text-slate-600">
                                La activación del pase se efectúa mediante verificación automatizada de transferencias electrónicas a través de los canales bancarios oficiales habilitados.
                            </p>
                        </section>

                        <section className="space-y-2">
                            <h2 className="text-base font-bold text-slate-900">
                                4. Limitación de Responsabilidad y Disponibilidad
                            </h2>
                            <p>
                                El servicio se proporciona "tal cual" y conforme a su disponibilidad técnica. Si bien se implementan medidas de alta disponibilidad, seguridad y resguardo de datos, LukeQuiz no garantiza la ausencia total de interrupciones imprevistas derivadas de servicios de terceros, conectividad de red o mantenimientos programados.
                            </p>
                        </section>

                        <section className="space-y-2">
                            <h2 className="text-base font-bold text-slate-900">
                                5. Procedimiento de Notificación y Contacto Oficial
                            </h2>
                            <p>
                                Para cualquier requerimiento de carácter legal, consultas corporativas, solicitudes de retiro de contenido multimedia o soporte general, el único canal oficial autorizado es:
                            </p>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 font-mono text-xs text-slate-800">
                                <div><span className="text-slate-500">Correo Electrónico Oficial:</span> <a href="mailto:contacto@lukeapp.cl" className="font-bold underline text-slate-900">contacto@lukeapp.cl</a></div>
                                <div><span className="text-slate-500">Ecosistema Digital:</span> lukeapp.cl</div>
                                <div><span className="text-slate-500">Jurisdicción:</span> República de Chile</div>
                            </div>
                        </section>

                        <section className="space-y-2">
                            <h2 className="text-base font-bold text-slate-900">
                                6. Modificaciones a los Términos
                            </h2>
                            <p>
                                LukeQuiz se reserva el derecho de actualizar o modificar los presentes Términos y Condiciones en cualquier momento para reflejar cambios legales o técnicos. La fecha de la última revisión se indicará siempre en el encabezado de este documento.
                            </p>
                        </section>
                    </div>

                    {/* Pie del Documento */}
                    <footer className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                        <div>
                            © 2026 LukeQuiz · Todos los derechos reservados · lukeapp.cl
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/about" className="hover:text-slate-800 underline">
                                Acerca de
                            </Link>
                            <a href="mailto:contacto@lukeapp.cl" className="hover:text-slate-800 underline">
                                contacto@lukeapp.cl
                            </a>
                        </div>
                    </footer>
                </article>
            </main>
        </div>
    )
}
