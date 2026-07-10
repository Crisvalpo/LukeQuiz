import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (authUser) => {
        // maybeSingle: evita error cuando el perfil aún no existe (usuario nuevo)
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle()

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
        // Failsafe: si getSession se cuelga (p. ej. lock de auth atascado),
        // nunca dejar la app bloqueada en loading
        const failsafe = setTimeout(() => setLoading(false), 4000)

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

        return () => {
            clearTimeout(failsafe)
            subscription.unsubscribe()
        }
    }, [])

    return (
        <AuthContext.Provider value={{ user, session, loading, refreshProfile }}>
            {/* Renderizar SIEMPRE: bloquear toda la app en `loading` dejaba
                pantalla negra si la sesión tardaba. Las rutas protegidas ya
                manejan `loading` por su cuenta (ProtectedRoute). */}
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
