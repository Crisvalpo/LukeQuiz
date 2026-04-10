import React from 'react'
import { X, Activity } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4">
            {/* Overlay */}
            <div className="absolute inset-0 bg-surface/90 backdrop-blur-2xl animate-fade" onClick={onClose} />

            {/* Modal Container */}
            <div className="w-full max-w-2xl relative z-10 animate-scale-in">
                <div className="glass rounded-[4rem] border border-white/10 overflow-hidden shadow-[0_0_100px_rgba(143,245,255,0.05)] relative">
                    {/* Scanning Line Effect */}
                    <div className="absolute inset-0 pointer-events-none opacity-20">
                        <div className="absolute top-0 left-0 right-0 h-[100px] bg-gradient-to-b from-primary/20 to-transparent animate-scan" />
                    </div>

                    {/* Header */}
                    <div className="px-12 pt-14 pb-8 flex justify-between items-start relative z-10">
                        <div className="flex gap-6">
                            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                                <Activity size={28} />
                            </div>
                            <div>
                                <p className="text-[10px] font-display font-black text-primary tracking-[0.5em] uppercase mb-2 opacity-60">Paso Requerido</p>
                                <h2 className="text-5xl font-display font-black tracking-tighter uppercase italic leading-none">{title}</h2>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-surface-high hover:bg-white/10 rounded-xl text-on-surface-variant transition-all hover:rotate-90 flex items-center justify-center border border-white/5 mt-1"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-12 pb-14 pt-4 relative z-10">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
