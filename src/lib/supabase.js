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

export const SUPABASE_SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'quiz'

// Fetch con timeout: ninguna petición puede quedar colgada para siempre.
// Si la red/servidor no responde, se aborta y la UI recibe un error manejable
// en vez de quedar en skeleton infinito. Storage y Edge Functions (subidas,
// TTS, IA) tienen un margen mayor.
const fetchWithTimeout = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || ''
  const isLong = url.includes('/storage/') || url.includes('/functions/')
  const ms = isLong ? 120000 : 15000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`Timeout ${ms}ms: ${url}`)), ms)

  // Respetar un signal externo si el llamador ya trae uno
  if (init.signal) {
    if (init.signal.aborted) controller.abort(init.signal.reason)
    else init.signal.addEventListener('abort', () => controller.abort(init.signal.reason), { once: true })
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: SUPABASE_SCHEMA },
  auth: { lock: noopLock },
  global: { fetch: fetchWithTimeout }
})
