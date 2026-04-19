import React, { useState, useEffect } from 'react';
import { Tv, Loader2, Cast } from 'lucide-react';
import { toast } from 'sonner';

/**
 * CastButton - Utiliza la Presentation API nativa del navegador
 * para proyectar la URL de la pantalla (TV) en un dispositivo externo.
 * @param {string} props.url - La URL específica a proyectar (opcional)
 * @param {string} props.gameId - Si se pasa gameId, construye la URL automática de /screen/id
 */
export default function CastButton({ url, gameId, className = "" }) {
    const [isSupported, setIsSupported] = useState(false);
    const [isCasting, setIsCasting] = useState(false);

    useEffect(() => {
        if (window.navigator && window.navigator.presentation) {
            setIsSupported(true);
        }
    }, []);

    const handleCast = async () => {
        if (!isSupported) {
            toast.error('Casting no soportado en este navegador');
            return;
        }

        // Validación de contexto seguro (HTTPS)
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            toast.error('La transmisión requiere una conexión segura (HTTPS)');
            return;
        }

        const presentationUrl = url || `${window.location.origin}/screen/${gameId}`;
        console.log('Intentando proyectar URL:', presentationUrl);

        try {
            setIsCasting(true);
            const presentationRequest = new PresentationRequest([presentationUrl]);

            // Monitor de disponibilidad
            presentationRequest.getAvailability().then(availability => {
                if (!availability.value) {
                    toast.info('No se detectaron pantallas. Asegúrate de que tu TV esté en la misma red.', {
                        duration: 5000,
                        action: {
                            label: 'Ver URL',
                            onClick: () => {
                                window.open(presentationUrl, '_blank');
                                toast('Puedes abrir esta URL manualmente en el navegador de tu TV.');
                            }
                        }
                    });
                }
            }).catch(e => console.log('Availability error:', e));

            const connection = await presentationRequest.start();

            connection.onconnect = () => {
                toast.success('Conectado a la pantalla externa');
                setIsCasting(false);
            };

            connection.onclose = () => {
                toast.info('Conexión cerrada');
                setIsCasting(false);
            };

        } catch (error) {
            console.error('Cast Error:', error);
            setIsCasting(false);

            if (error.name === 'NotAllowedError') return;

            if (error.name === 'NotFoundError') {
                toast.error('No se encontró ninguna pantalla compatible.', {
                    description: 'Tip: Abre la URL de la pantalla directamente en el navegador de tu TV.',
                    duration: 6000,
                    action: {
                        label: 'Copiar URL',
                        onClick: () => {
                            navigator.clipboard.writeText(presentationUrl);
                            toast.success('URL copiada al portapapeles');
                        }
                    }
                });
            } else {
                toast.error('Error al proyectar: ' + error.message);
            }
        }
    };

    if (!isSupported) return null;

    return (
        <button
            onClick={handleCast}
            disabled={isCasting}
            className={`flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-95 group ${className}`}
            title="Transmitir a TV / Pantalla"
        >
            {isCasting ? (
                <Loader2 size={18} className="animate-spin text-primary" />
            ) : (
                <Cast size={18} className="text-primary group-hover:scale-110 transition-transform" />
            )}
            <span className="text-[1.2vh] font-black uppercase tracking-widest text-white/70">
                {isCasting ? 'Conectando...' : 'Transmitir'}
            </span>
        </button>
    );
}
