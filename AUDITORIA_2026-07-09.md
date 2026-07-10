# Auditoría LukeQuiz — 2026-07-09

Alcance: código fuente completo, seguridad (Supabase/RLS/edge functions), rendimiento y configuración de deploy. Base de datos: Supabase Cloud (proyecto `czsjwqwjshkfguzzrbre`), no el Supabase self-hosted del server.

## Correcciones ya aplicadas al código

**Puntajes duplicados (crítico).** `process_scores` podía ejecutarse dos o más veces por pregunta: en `Host.jsx` no había guard de concurrencia y los timers (reloj, autopilot, "todos respondieron") disparaban `handleNext` con closures viejas cada segundo hasta que el estado cambiara. Cada ejecución extra volvía a sumar puntos. Se agregó guard `isUpdating` y el patrón `handleNextRef` (igual que en Screen.jsx), y el SQL nuevo hace `process_scores` idempotente a nivel de base de datos (columna `answers.scored`), que es la protección real cuando Host y Screen compiten.

**Contador de respuestas incorrecto en Host (alto).** La suscripción realtime a `answers` no tenía filtro (se refrescaba con CUALQUIER respuesta de CUALQUIER partida) y `fetchCounts` quedaba capturado con el índice de pregunta viejo, pudiendo avanzar la pregunta prematuramente. Ahora filtra por la pregunta actual vía refs y resetea el contador al cambiar de pregunta.

**Crash en reconexión de jugador (alto).** En `Join.jsx`, al recuperar sesión durante una pregunta, `fetchQuestion` leía `player.id` de un estado aún null → el jugador reconectado no recuperaba su estado de respuesta. Ahora recibe el id como parámetro. También se evita la resuscripción del canal realtime en cada actualización de puntaje (deps por `player.id`, no por el objeto).

**PIN reutilizado rompe el ingreso (medio).** `Join.jsx` y `TVEntry.jsx` usaban `.single()` sobre `join_code`: si un código se repetía en una partida terminada, la consulta fallaba. Ahora buscan la partida activa más reciente (`neq('status','finished')` + `order` + `maybeSingle`).

**Canje premium del lado del cliente (crítico).** `PremiumModal.jsx` actualizaba `profiles.premium_until` directamente desde el navegador: cualquier usuario con la anon key podía darse premium sin código, y leer/enumerar los códigos promo. Ahora canjea vía RPC `redeem_promo_code` (SECURITY DEFINER, atómico), con fallback al flujo viejo mientras no instales el SQL.

**Edge functions sin verificación (crítico).** `generate-quiz` y `generate-tts` no validaban usuario ni premium: cualquiera con la anon key (visible en el bundle) podía quemar tu cuota de Gemini y de Google TTS. Ambas verifican ahora JWT + premium en el servidor, con límites de tamaño de entrada (count ≤ 20, texto TTS ≤ 500 chars). **Requiere redesplegar:** `supabase functions deploy generate-quiz generate-tts`.

**Menores.** `AuthContext` y perfil nuevo: `.maybeSingle()` evita el error silencioso 406. Import sin uso eliminado en Host.

## Pendiente de tu parte

1. **Ejecutar `supabase/2026-07-09_security_scoring_fixes.sql`** en el SQL Editor de Supabase. Incluye: puntaje idempotente, `redeem_promo_code`, RLS de `promo_codes` (solo admin), revocación de UPDATE sobre `is_premium`/`premium_until`, restricción única de una respuesta por jugador/pregunta e índices. El script es idempotente.
2. **Redesplegar las dos edge functions** (paso 6 arriba).
3. **Ejecutar la auditoría del server**: `cmd /c "ssh luke-ssh bash -s < C:\Github\Skill\luke-server\server-audit.sh > C:\Github\Skill\luke-server\server-audit-output.txt 2>&1"` y avisarme para revisarla.

## Hallazgos que requieren decisión (no aplicados)

**Tabla `games` abierta a escritura anónima.** Screen/Host anónimos actualizan `master_screen_id`, `is_autopilot`, `settings` y `status` directamente; con la anon key un atacante puede sabotear partidas ajenas (cambiar el master, finalizar partidas). Solución correcta: mover esos updates a RPCs con validación (p. ej. exigir el `join_code` o un token de sesión de partida). Es un cambio de diseño; lo puedo implementar cuando quieras.

**Emails expuestos.** `Admin.jsx` lee `profiles.email` vía la API pública; si el SELECT de `profiles` es abierto, cualquier usuario puede listar emails de otros. Revisa la política RLS de `profiles` (idealmente exponer solo `nickname` públicamente).

**Quizzes privados.** El filtro `visibility='public'` es solo del cliente; confirma que exista política RLS que impida SELECT de quizzes privados a no-dueños.

**Admin por email hardcodeado.** `cristianluke@gmail.com` está en 3 archivos y en el cliente. Funciona (la política SQL nueva lo respalda para promo_codes), pero a futuro conviene un flag `profiles.is_admin` gestionado por RLS.

**Códigos promo débiles.** `Math.random()` de 6 caracteres es adivinable por fuerza bruta si no hay rate limit. Con el RPC + RLS ya no son enumerables; considera generar códigos de 8+ caracteres con `crypto`.

**`npm ci` falla limpio.** `vite-plugin-pwa@1.2.0` declara peer `vite ≤7` y el proyecto usa vite 8; instala solo con `--legacy-peer-deps`. Vigila la actualización de vite-plugin-pwa que soporte vite 8 y fija eso en el pipeline de deploy.

**Fórmula de puntaje.** El SQL del README usaba `questions.time_limit`, pero el juego real usa `games.settings->tempo`. El SQL nuevo puntúa con `tempo` (lo que ve el jugador en pantalla). El `process_scores` "arreglado" que está en producción no está versionado en el repo — con el SQL nuevo queda versionado.

**Lint.** Quedan ~18 errores de estilo preexistentes (vars sin uso, funciones usadas antes de declararse, `no-async-promise-executor`). No afectan el build; limpieza opcional.

## Deploy (nginx/Docker)

`nginx.conf` está bien: headers de seguridad, cache inmutable para assets con hash, no-cache para `sw.js`/manifest/HTML (la causa de la "pantalla azul" ya cubierta). Sugerencia menor: agregar `add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;`. HSTS lo maneja Cloudflare.
