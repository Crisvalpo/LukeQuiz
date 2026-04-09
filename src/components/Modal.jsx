import React from 'react'

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="glass-card w-full max-w-md relative z-10 animate-fade p-8">
                <h2 className="text-2xl font-bold mb-6">{title}</h2>
                {children}
            </div>
        </div>
    )
}
