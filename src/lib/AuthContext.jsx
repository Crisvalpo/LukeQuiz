import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (data) {
            const now = new Date()
            const premiumUntil = data.premium_until ? new Date(data.premium_until) : null
            const isPremiumActive = data.is_premium || (premiumUntil && premiumUntil > now)

            setUser(prev => prev ? { ...prev, ...data, is_premium: isPremiumActive } : null)
        }
    }

    const refreshProfile = async () => {
        if (user?.id) {
            await fetchProfile(user.id)
        }
    }

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (currentUser) fetchProfile(currentUser.id)
            setLoading(false)
        })

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (currentUser) fetchProfile(currentUser.id)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    return (
        <AuthContext.Provider value={{ user, session, loading, refreshProfile }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
