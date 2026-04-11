import React from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade" onClick={onClose} />

            {/* Modal Container */}
            <div className="w-full max-w-2xl relative z-10 animate-scale-in">
                <div className="bg-surface-container border border-white/8 rounded-2xl shadow-2xl overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-10 py-8 border-b border-white/5">
                        <div>
                            <p className="text-[10px] text-primary/60 tracking-[0.3em] uppercase font-medium mb-2">Nueva sesión</p>
                            <h2 className="text-2xl font-semibold text-white">{title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center justify-center"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-10 py-8">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
