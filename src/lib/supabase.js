import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials missing! Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

// Lock no-op: desactiva el Navigator LockManager de gotrue-js.
// El lock "sb-...-auth-token" quedaba retenido para siempre (deadlock conocido,
// agravado con varias pestañas Host/Screen/Join abiertas) y getSession() nunca
// resolvía → la app quedaba en pantalla negra.
const noopLock = async (_name, _acquireTimeout, fn) => await fn()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: noopLock }
})
