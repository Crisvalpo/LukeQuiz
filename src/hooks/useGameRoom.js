import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGameRoom(gameId) {
    const [game, setGame] = useState(null)
    const [players, setPlayers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!gameId) {
            setLoading(false)
            return
        }

        async function init() {
            try {
                const { data: g, error: gError } = await supabase
                    .from('games')
                    .select('*, quizzes(*)')
                    .eq('id', gameId)
                    .single()

                if (gError) throw gError
                if (g) setGame(g)

                const { data: p } = await supabase
                    .from('players')
                    .select('*')
                    .eq('game_id', gameId)
                    .order('score', { ascending: false })

                if (p) setPlayers(p)
            } catch (error) {
                console.error('Error initializing game room:', error)
            } finally {
                setLoading(false)
            }
        }

        init()

        const gameSub = supabase.channel(`game_room_${gameId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${gameId}`
            }, payload => {
                setGame(prev => ({ ...prev, ...payload.new }))
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'players',
                filter: `game_id=eq.${gameId}`
            }, () => {
                supabase.from('players')
                    .select('*')
                    .eq('game_id', gameId)
                    .order('score', { ascending: false })
                    .then(({ data }) => { if (data) setPlayers(data) })
            })
            .subscribe()

        return () => {
            supabase.removeChannel(gameSub)
        }
    }, [gameId])

    return { game, setGame, players, loading }
}
