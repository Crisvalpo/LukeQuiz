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
                <div className="glass rounded-2xl overflow-hidden shadow-2xl">

                    {/* Header */}
                    <div className="flex items-center justify-between p-10 border-b border-outline-variant/10">
                        <div>
                            <p className="text-[10px] text-primary tracking-[0.4em] uppercase font-black mb-3 opacity-40">Creative Workshop / Input</p>
                            <h2 className="text-4xl font-black italic tracking-tighter text-white">{title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-surface-highest/50 hover:bg-surface-highest rounded-full text-on-surface-variant hover:text-white transition-all flex items-center justify-center border border-white/5 absolute top-6 right-6"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-10">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
