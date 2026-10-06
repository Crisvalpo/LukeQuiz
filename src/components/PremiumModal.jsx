import React, { useState } from 'react'
import {
    Crown, MessageSquare, Copy, CheckCircle2,
    Ticket, CreditCard, ExternalLink, Sparkles,
    Lock, Volume2, Clock, Check, RefreshCcw, Zap, AlertCircle
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Modal from './Modal'

export default function PremiumModal({ isOpen, onClose }) {
    const { user, session, refreshProfile } = useAuth()
    const [operationNumber, setOperationNumber] = useState('')
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifyError, setVerifyError] = useState(null)
    const [activeTab, setActiveTab] = useState('auto') // 'auto' | 'code'

    const [promoCode, setPromoCode] = useState('')
    const [isRedeeming, setIsRedeeming] = useState(false)
    const [copiedField, setCopiedField] = useState(null)
    const [allCopied, setAllCopied] = useState(false)

    const bankDetails = {
        bank: "BancoEstado",
        accountType: "CuentaRUT (Vista)",
        rut: "15.717.681-1",
        accountNumber: "15717681",
        name: "Cristian Luke",
        email: "pagos@lukeapp.cl",
        amount: "$1.000 CLP"
    }

    const whatsappNumber = "56935264052"
    const whatsappMessage = encodeURIComponent("¡Hola! Te envío mi comprobante de transferencia ($1.000 CLP) para activar mi Pase Diario Premium en LukeQuiz.")
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`

    const handleCopyField = (label, value) => {
        navigator.clipboard.writeText(value)
        setCopiedField(label)
        toast.success(`${label} copiado al portapapeles`)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const handleCopyAll = () => {
        const fullText = [
            `Banco: ${bankDetails.bank}`,
            `Tipo de Cuenta: ${bankDetails.accountType}`,
            `N° Cuenta: ${bankDetails.accountNumber}`,
            `RUT: ${bankDetails.rut}`,
            `Nombre: ${bankDetails.name}`,
            `Email: ${bankDetails.email}`,
            `Monto: ${bankDetails.amount}`
        ].join('\n')

        navigator.clipboard.writeText(fullText)
        setAllCopied(true)
        toast.success('¡Todos los datos de transferencia copiados!', {
            icon: '📋',
            duration: 2500
        })
        setTimeout(() => setAllCopied(false), 2500)
    }

    const handleVerifyTransfer = async () => {
        const cleanOp = operationNumber.trim().replace(/\D/g, '')
        if (!cleanOp || cleanOp.length < 5) {
            toast.error('Por favor ingresa los 5 a 10 dígitos de tu N° de Operación o Transferencia')
            return
        }

        if (!session?.access_token) {
            toast.error('Debes iniciar sesión para activar tu pase')
            return
        }

        setIsVerifying(true)
        setVerifyError(null)

        try {
            const resp = await fetch('/api/verify-transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ operationNumber: cleanOp })
            })

            const data = await resp.json()

            if (!resp.ok || !data.ok) {
                if (data.notFound) {
                    setVerifyError({
                        title: 'Comprobante aún no recibido',
                        message: data.message || 'Si acabas de hacer la transferencia, espera unos 20-30 segundos para que el banco emita el aviso y vuelve a presionar Verificar.'
                    })
                } else {
                    toast.error(data.error || 'No se pudo verificar la transferencia')
                }
                return
            }

            // Éxito total
            try {
                confetti({
                    particleCount: 90,
                    spread: 70,
                    origin: { y: 0.6 }
                })
            } catch {
                // Confetti opcional si falla
            }

            toast.success(data.message || '¡Pase Premium activado exitosamente!', {
                icon: <Crown className="text-amber-400" size={20} />,
                duration: 5000
            })

            await refreshProfile()
            setTimeout(() => {
                onClose()
            }, 1800)
        } catch (err) {
            console.error('Error verifying transfer:', err)
            toast.error('Error al conectar con el servidor: ' + (err.message || 'Revisa tu conexión'))
        } finally {
            setIsVerifying(false)
        }
    }

    const handleRedeemCode = async () => {
        if (!promoCode?.trim()) {
            toast.error('Por favor ingresa un código de activación')
            return
        }
        setIsRedeeming(true)

        try {
            const cleanCode = promoCode.toUpperCase().trim()

            // 1. Vía RPC segura en el servidor
            const { data, error } = await supabase.rpc('redeem_promo_code', {
                p_code: cleanCode
            })

            let result
            if (error && (error.code === 'PGRST202' || /redeem_promo_code/i.test(error.message || ''))) {
                // Fallback legado si la función aún no existe
                result = await legacyRedeem(cleanCode)
            } else if (error) {
                throw error
            } else {
                result = data?.ok
                    ? { ok: true }
                    : { ok: false, message: data?.message || 'Código inválido o ya utilizado' }
            }

            if (!result.ok) {
                toast.error(result.message || 'Código inválido')
                return
            }

            try {
                confetti({
                    particleCount: 80,
                    spread: 60,
                    origin: { y: 0.6 }
                })
            } catch {}

            toast.success('¡Pase Premium de 24 horas activado!', {
                icon: <Crown className="text-amber-400" size={20} />,
                duration: 4000
            })

            await refreshProfile()
            onClose()
        } catch (error) {
            console.error('Error redeeming code:', error)
            toast.error('Error al procesar el código: ' + (error?.message || 'Revisa tu conexión'))
        } finally {
            setIsRedeeming(false)
        }
    }

    const legacyRedeem = async (cleanCode) => {
        const { data: codeData, error: searchError } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', cleanCode)
            .is('used_at', null)
            .single()

        if (searchError || !codeData) return { ok: false, message: 'Código inválido o ya utilizado' }

        const newPremiumUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ premium_until: newPremiumUntil.toISOString() })
            .eq('id', user.id)
        if (updateError) throw updateError

        await supabase
            .from('promo_codes')
            .update({ used_at: new Date().toISOString(), used_by: user.id })
            .eq('id', codeData.id)

        return { ok: true }
    }

    const benefits = [
        {
            icon: <Sparkles className="text-amber-400" size={20} />,
            title: "Generador Mágico IA",
            desc: "Crea trivias completas de hasta 20 preguntas en segundos con Gemini.",
            badge: "ILIMITADO"
        },
        {
            icon: <Volume2 className="text-cyan-400" size={20} />,
            title: "Voz Neuronal del Host",
            desc: "Presentador virtual con voz ultra-realista que narra cada pregunta.",
            badge: "VOZ EN VIVO"
        },
        {
            icon: <Lock className="text-pink-400" size={20} />,
            title: "Trivias y Salas Privadas",
            desc: "Oculta tus juegos con PIN exclusivo para eventos corporativos o privados.",
            badge: "EXCLUSIVO"
        },
        {
            icon: <Clock className="text-emerald-400" size={20} />,
            title: "24 Horas de Acceso Total",
            desc: "Todas las herramientas desbloqueadas sin restricciones por todo el día.",
            badge: "$1.000 CLP"
        }
    ]

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Pase Diario Premium">
            <div className="space-y-6">

                {/* Banner Informativo Superior */}
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/15 to-purple-500/15 border border-amber-500/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                            <Crown size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-sm md:text-base font-black text-white italic tracking-tight">
                                Desbloquea todas las funciones profesionales por 24 hrs
                            </h3>
                            <p className="text-[11px] md:text-xs text-white/70 font-medium">
                                Por solo <strong className="text-amber-300 font-black">$1.000 CLP</strong> tienes acceso ilimitado a IA, generación de voz y trivias privadas.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sección: Beneficios */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
                            Beneficios incluidos en tu pase:
                        </p>
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            Todo desbloqueado
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {benefits.map((b, i) => (
                            <div
                                key={i}
                                className="bg-white/5 hover:bg-white/[0.08] p-3.5 rounded-xl border border-white/5 transition-all flex items-start gap-3 group"
                            >
                                <div className="p-2 rounded-lg bg-surface-lowest/60 border border-white/5 shrink-0 group-hover:scale-110 transition-transform">
                                    {b.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <h4 className="text-xs font-black text-white tracking-wide truncate">
                                            {b.title}
                                        </h4>
                                        <span className="text-[8px] font-black text-white/40 tracking-wider bg-white/5 px-1.5 py-0.5 rounded uppercase shrink-0">
                                            {b.badge}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-white/60 leading-relaxed font-medium">
                                        {b.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PASO 1: Datos de Transferencia */}
                <div className="bg-amber-500/[0.08] rounded-2xl border border-amber-500/25 overflow-hidden shadow-xl">
                    <div className="bg-amber-500/20 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <CreditCard size={18} className="text-amber-400" />
                            <h3 className="text-xs font-black text-amber-300 uppercase tracking-widest">
                                Paso 1: Transfiere $1.000 CLP
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={handleCopyAll}
                            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-black uppercase tracking-wider rounded-lg border border-amber-500/30 transition-all active:scale-95 cursor-pointer"
                            title="Copiar todos los datos de transferencia juntos"
                        >
                            {allCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            {allCopied ? '¡Copiados!' : 'Copiar todo'}
                        </button>
                    </div>

                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {/* Banco */}
                            <div
                                onClick={() => handleCopyField('Banco', bankDetails.bank)}
                                className="bg-black/30 p-2.5 rounded-xl border border-white/5 hover:border-amber-500/40 cursor-pointer group transition-all"
                            >
                                <span className="text-[8px] text-white/40 font-black uppercase tracking-widest block mb-0.5">Banco</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">{bankDetails.bank}</span>
                                    {copiedField === 'Banco' ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} className="text-white/20 group-hover:text-white/60" />}
                                </div>
                            </div>

                            {/* Tipo Cuenta */}
                            <div
                                onClick={() => handleCopyField('Tipo de Cuenta', bankDetails.accountType)}
                                className="bg-black/30 p-2.5 rounded-xl border border-white/5 hover:border-amber-500/40 cursor-pointer group transition-all"
                            >
                                <span className="text-[8px] text-white/40 font-black uppercase tracking-widest block mb-0.5">Tipo Cuenta</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">{bankDetails.accountType}</span>
                                    {copiedField === 'Tipo de Cuenta' ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} className="text-white/20 group-hover:text-white/60" />}
                                </div>
                            </div>

                            {/* RUT */}
                            <div
                                onClick={() => handleCopyField('RUT', bankDetails.rut)}
                                className="bg-black/30 p-2.5 rounded-xl border border-white/5 hover:border-amber-500/40 cursor-pointer group transition-all"
                            >
                                <span className="text-[8px] text-white/40 font-black uppercase tracking-widest block mb-0.5">RUT</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">{bankDetails.rut}</span>
                                    {copiedField === 'RUT' ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} className="text-white/20 group-hover:text-white/60" />}
                                </div>
                            </div>

                            {/* Nombre */}
                            <div
                                onClick={() => handleCopyField('Nombre', bankDetails.name)}
                                className="bg-black/30 p-2.5 rounded-xl border border-white/5 hover:border-amber-500/40 cursor-pointer group transition-all"
                            >
                                <span className="text-[8px] text-white/40 font-black uppercase tracking-widest block mb-0.5">Nombre</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">{bankDetails.name}</span>
                                    {copiedField === 'Nombre' ? <Check size={12} className="text-emerald-400" /> : <Copy size={11} className="text-white/20 group-hover:text-white/60" />}
                                </div>
                            </div>

                            {/* Email */}
                            <div
                                onClick={() => handleCopyField('Email', bankDetails.email)}
                                className="bg-black/30 p-2.5 rounded-xl border border-white/5 hover:border-amber-500/40 cursor-pointer group transition-all col-span-1 sm:col-span-1"
                            >
                                <span className="text-[8px] text-white/40 font-black uppercase tracking-widest block mb-0.5">Email Destino</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors truncate">{bankDetails.email}</span>
                                    {copiedField === 'Email' ? <Check size={12} className="text-emerald-400 shrink-0 ml-1" /> : <Copy size={11} className="text-white/20 group-hover:text-white/60 shrink-0 ml-1" />}
                                </div>
                            </div>

                            {/* Monto */}
                            <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30 flex flex-col justify-center">
                                <span className="text-[8px] text-amber-300/70 font-black uppercase tracking-widest block mb-0.5">Monto Exacto</span>
                                <span className="text-base font-black text-amber-400 leading-none">{bankDetails.amount}</span>
                            </div>
                        </div>

                        <p className="text-[10px] text-white/50 text-center font-medium">
                            💡 Al transferir, ingresa <strong className="text-amber-300 font-bold">pagos@lukeapp.cl</strong> (o tu propio correo) para recibir el comprobante.
                        </p>
                    </div>
                </div>

                {/* PESTAÑAS DE ACTIVACIÓN */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('auto')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'auto'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Zap size={14} className={activeTab === 'auto' ? 'text-amber-300' : ''} />
                        <span>Activación Instantánea</span>
                        <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-black">NUEVO</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('code')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'code'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Ticket size={14} />
                        <span>Tengo un Código</span>
                    </button>
                </div>

                {/* CONTENIDO SEGÚN PESTAÑA */}
                {activeTab === 'auto' ? (
                    /* PASO 2: Verificación Automática */
                    <div className="bg-surface-lowest/70 rounded-2xl border border-emerald-500/30 p-4 space-y-3.5 shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-white uppercase tracking-widest">
                                        Paso 2: Ingresa tu N° de Operación o Transferencia
                                    </h3>
                                    <p className="text-[10px] text-white/60">
                                        Compatible con cualquier banco (BancoEstado, Falabella, Santander, BCI, etc.). Lo encuentras en el comprobante o correo.
                                    </p>
                                </div>
                            </div>
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 hidden sm:inline-block">
                                Multi-Banco
                            </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="EJ: 8004439 O 843206254221"
                                value={operationNumber}
                                onChange={(e) => {
                                    setOperationNumber(e.target.value.replace(/[^0-9]/g, ''))
                                    if (verifyError) setVerifyError(null)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleVerifyTransfer()
                                    }
                                }}
                                className="flex-1 bg-black/40 border border-emerald-500/20 rounded-xl px-4 py-3.5 text-white font-black tracking-[0.2em] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all placeholder:text-white/20 text-xs"
                            />
                            <button
                                type="button"
                                onClick={handleVerifyTransfer}
                                disabled={isVerifying || !operationNumber?.trim()}
                                className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-black tracking-widest text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shrink-0 uppercase cursor-pointer"
                            >
                                {isVerifying ? (
                                    <>
                                        <RefreshCcw className="animate-spin" size={16} />
                                        <span>Verificando Banco...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap size={16} className="text-amber-300" />
                                        <span>Verificar y Activar</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Mensaje de espera si aún no llega */}
                        {verifyError && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5">
                                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-[11px] text-amber-200">
                                    <strong className="font-black block text-amber-300 mb-0.5">{verifyError.title}</strong>
                                    {verifyError.message}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* PASO ALTERNATIVO: Canje con código promocional */
                    <div className="bg-surface-lowest/50 rounded-2xl border border-primary/30 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Ticket size={16} className="text-primary" />
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">
                                Canjear Código de Acceso
                            </h3>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                                type="text"
                                placeholder="PEGA AQUÍ TU CÓDIGO (EJ: LUKE-XYZ)"
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleRedeemCode()
                                    }
                                }}
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-black tracking-[0.2em] focus:border-primary outline-none transition-all placeholder:text-white/20 text-xs uppercase"
                            />
                            <button
                                type="button"
                                onClick={handleRedeemCode}
                                disabled={isRedeeming || !promoCode?.trim()}
                                className="px-6 py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black tracking-widest text-xs shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shrink-0 uppercase cursor-pointer"
                            >
                                {isRedeeming ? <RefreshCcw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                <span>{isRedeeming ? 'Validando...' : 'Canjear'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* SOPORTE Y WHATSAPP SECUNDARIO */}
                <div className="flex items-center justify-between text-[11px] text-white/50 px-1">
                    <span>¿Algún inconveniente con tu pago?</span>
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[#25D366] hover:underline font-bold transition-colors"
                    >
                        <MessageSquare size={13} />
                        <span>Soporte por WhatsApp</span>
                        <ExternalLink size={11} />
                    </a>
                </div>

            </div>
        </Modal>
    )
}
