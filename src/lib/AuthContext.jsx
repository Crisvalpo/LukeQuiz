import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (authUser) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()

        if (data) {
            const now = new Date()
            const premiumUntil = data.premium_until ? new Date(data.premium_until) : null
            const isPremiumActive = data.is_premium || (premiumUntil && premiumUntil > now)
            // Always merge with the authUser passed in, never rely on stale prev state
            setUser({ ...authUser, ...data, is_premium: isPremiumActive })
        } else {
            // Profile may not exist yet (new user), keep the base auth user
            setUser(authUser)
        }
    }

    const refreshProfile = async () => {
        if (user?.id) {
            await fetchProfile(user)
        }
    }

    useEffect(() => {
        // Check active sessions on mount
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session)
            const currentUser = session?.user ?? null
            if (currentUser) {
                await fetchProfile(currentUser)
            } else {
                setUser(null)
            }
            setLoading(false)
        })

        // Listen for auth state changes (login, logout, token refresh, OAuth callback)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
            const currentUser = session?.user ?? null
            if (currentUser) {
                await fetchProfile(currentUser)
            } else {
                setUser(null)
            }
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
