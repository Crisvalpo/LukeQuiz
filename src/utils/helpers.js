export const generateJoinCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

export const EMOJIS = ['🔥', '😎', '🚀', '🐸', '🐧', '👾', '🦊', '🐵', '🐼', '🦁', '🦄', '💃', '👩‍🎤', '🧜‍♀️', '👸', '👩‍🚀', '🦋', '🌸', '💖', '⭐']

export const calculateScore = (timeLeft, totalTime, isCorrect) => {
    if (!isCorrect) return 0
    const bonus = (timeLeft / totalTime) * 500
    return Math.round(1000 + bonus)
}
