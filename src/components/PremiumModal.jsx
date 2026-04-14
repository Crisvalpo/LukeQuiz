import React, { useState } from 'react'
import {
    X, Crown, MessageSquare, Copy, CheckCircle2,
    Ticket, CreditCard, ExternalLink, Sparkles,
    Shield as ShieldIcon, RefreshCcw, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Modal from './Modal'

export default function PremiumModal({ isOpen, onClose }) {
    const { user, refreshProfile } = useAuth()
    const [promoCode, setPromoCode] = useState('')
    const [isRedeeming, setIsRedeeming] = useState(false)
    const [copied, setCopied] = useState(false)

    const bankDetails = {
        name: "Cristian Luke",
        rut: "15.717.681-1",
        accountType: "Cuenta Rut",
        amount: "$1.000 CLP"
    }

    const whatsappNumber = "56935264052"
    const whatsappMessage = encodeURIComponent("Te envio mi comprobante de transferencia para mi pase diario")
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        toast.success('Copiado al portapapeles')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleRedeemCode = async () => {
        if (!promoCode) return
        setIsRedeeming(true)

        try {
            const { data: codeData, error: searchError } = await supabase
                .from('promo_codes')
                .select('*')
                .eq('code', promoCode.toUpperCase().trim())
                .is('used_at', null)
                .single()

            if (searchError || !codeData) {
                toast.error('Código inválido o ya utilizado')
                setIsRedeeming(false)
                return
            }

            // Actualizar perfil
            const now = new Date()
            const newPremiumUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000)

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ premium_until: newPremiumUntil.toISOString() })
                .eq('id', user.id)

            if (updateError) throw updateError

            // Marcar código como usado
            await supabase
                .from('promo_codes')
                .update({
                    used_at: new Date().toISOString(),
                    used_by: user.id
                })
                .eq('id', codeData.id)

            toast.success('¡Pase de 24 horas activado!', {
                icon: <Crown className="text-amber-500" />
            })

            await refreshProfile()
            onClose()
        } catch (error) {
            console.error('Error redeeming code:', error)
            toast.error('Error al procesar el código')
        } finally {
            setIsRedeeming(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Pase Diario Premium">
            <div className="space-y-8">
                {/* Benefits Section */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: <Sparkles className="text-amber-500" size={16} />, title: "IA", desc: "Ilimitado" },
                        { icon: <ShieldIcon className="text-amber-500" size={16} />, title: "Privado", desc: "Exclusivo" },
                        { icon: <Search className="text-amber-500" size={16} />, title: "Biblioteca", desc: "Completo" }
                    ].map((b, i) => (
                        <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5 text-center space-y-1">
                            <div className="flex justify-center">{b.icon}</div>
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">{b.title}</p>
                            <p className="text-xs font-bold text-white leading-tight">{b.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Payment Instructions */}
                <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 overflow-hidden">
                    <div className="bg-amber-500/20 p-3 flex items-center gap-3">
                        <CreditCard size={18} className="text-amber-500" />
                        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Paso 1: Transferencia Bancaria</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div onClick={() => handleCopy(bankDetails.name)} className="cursor-pointer group">
                                <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Nombre</p>
                                <p className="text-sm font-black text-white group-hover:text-amber-500 transition-colors">{bankDetails.name}</p>
                            </div>
                            <div onClick={() => handleCopy(bankDetails.rut)} className="cursor-pointer group">
                                <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">RUT</p>
                                <p className="text-sm font-black text-white group-hover:text-amber-500 transition-colors">{bankDetails.rut}</p>
                            </div>
                            <div className="group">
                                <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Tipo Cuenta</p>
                                <p className="text-sm font-black text-white">{bankDetails.accountType}</p>
                            </div>
                            <div className="group text-right">
                                <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Monto</p>
                                <p className="text-xl font-black text-amber-400">{bankDetails.amount}</p>
                            </div>
                        </div>

                        <div className="pt-2 flex flex-col items-center gap-2">
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-lg font-black tracking-widest text-[10px] transition-all hover:scale-[1.01] shadow-lg shadow-[#25D366]/10"
                            >
                                <MessageSquare size={16} />
                                ENVIAR COMPROBANTE
                                <ExternalLink size={12} />
                            </a>
                            <p className="text-[9px] text-white/20 text-center italic">Recibirás tu código tras enviar el comprobante.</p>
                        </div>
                    </div>
                </div>

                {/* Redemption Section */}
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <div className="bg-white/10 p-3 flex items-center gap-3">
                        <Ticket size={18} className="text-primary" />
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Paso 2: Activar Pase</h3>
                    </div>
                    <div className="p-4 flex gap-3">
                        <input
                            type="text"
                            placeholder="CÓDIGO"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            className="flex-1 bg-surface-lowest/50 border-2 border-white/5 rounded-lg px-4 py-3 text-white font-black tracking-[0.2em] focus:border-primary/50 outline-none transition-all placeholder:text-white/10 text-xs"
                        />
                        <button
                            onClick={handleRedeemCode}
                            disabled={isRedeeming}
                            className={`px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-black tracking-widest text-[10px] shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
                        >
                            {isRedeeming ? <RefreshCcw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                            {isRedeeming ? '...' : 'CANJEAR'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
