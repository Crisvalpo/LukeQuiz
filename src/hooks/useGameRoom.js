import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGameRoom(gameId) {
    const [game, setGame] = useState(null)
    const [players, setPlayers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!gameId) return

        async function init() {
            const { data: g } = await supabase.from('games').select('*, quizzes(*)').eq('id', gameId).single()
            if (g) setGame(g)

            const { data: p } = await supabase.from('players').select('*').eq('game_id', gameId).order('score', { ascending: false })
            if (p) setPlayers(p)

            setLoading(false)
        }

        init()

        const gameSub = supabase.channel(`game_${gameId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                payload => setGame(payload.new)
            )
            .subscribe()

        const playerSub = supabase.channel(`players_${gameId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
                () => {
                    // Refetch is safer for order/sync
                    supabase.from('players').select('*').eq('game_id', gameId).order('score', { ascending: false })
                        .then(({ data }) => { if (data) setPlayers(data) })
                }
            )
            .subscribe()

        return () => {
            gameSub.unsubscribe()
            playerSub.unsubscribe()
        }
    }, [gameId])

    return { game, setGame, players, loading }
}
