/**
 * Utilidades para cálculo y formato de tiempo restante del Pase Premium
 */

export function getRemainingPremiumTime(premiumUntil) {
    if (!premiumUntil) return null
    const diff = new Date(premiumUntil).getTime() - Date.now()
    if (diff <= 0) return null

    const totalMinutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const days = Math.floor(hours / 24)

    if (days > 0) {
        const remainingHours = hours % 24
        return `${days}d ${remainingHours}h`
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
}

export function getDetailedRemainingTime(premiumUntil) {
    if (!premiumUntil) return null
    const diff = new Date(premiumUntil).getTime() - Date.now()
    if (diff <= 0) return 'Expirado'

    const totalMinutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const days = Math.floor(hours / 24)

    if (days > 0) {
        const remainingHours = hours % 24
        return `${days} día${days > 1 ? 's' : ''} y ${remainingHours} hora${remainingHours !== 1 ? 's' : ''}`
    }
    if (hours > 0) {
        return `${hours} hora${hours !== 1 ? 's' : ''} y ${minutes} minuto${minutes !== 1 ? 's' : ''}`
    }
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`
}

export function formatPremiumExpiration(premiumUntil) {
    if (!premiumUntil) return null
    try {
        const date = new Date(premiumUntil)
        return date.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) + ' hrs'
    } catch {
        return null
    }
}
