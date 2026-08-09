# 🚀 LukeQuiz - Plataforma de Quiz en Tiempo Real

¡El clon de Kahoot! con diseño premium y optimizaciones de backend ya está listo!

## 🛠️ Configuración de Supabase (CRÍTICO)

Para que la aplicación funcione correctamente y sea segura, debes configurar lo siguiente en tu proyecto de Supabase:

### 1. Ejecutar el SQL de las Tablas
Usa el SQL proporcionado al inicio del proyecto para crear las tablas básicas.

### 2. Habilitar Realtime
Ejecuta esto en el SQL Editor:
```sql
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;
```

### 3. Seguridad (RLS)
Activa RLS y añade políticas para permitir inserciones anónimas (simplificado para MVP):
```sql
alter table players enable row level security;
alter table answers enable row level security;

create policy "Permitir inserts a cualquiera" on players for insert with check (true);
create policy "Cualquiera puede leer jugadores de su juego" on players for select using (true);
create policy "Permitir inserts de respuestas" on answers for insert with check (true);
create policy "Cualquiera puede leer respuestas" on answers for select using (true);
-- Nota: En producción, limita 'select' por game_id o auth.
```

### 4. Función de Puntaje (RPC) y Seguridad — usar el SQL versionado
⚠️ La versión vigente de `process_scores` (idempotente vía `answers.scored`, puntúa con `games.settings->tempo`) y los fixes de seguridad (RPC `redeem_promo_code`, RLS de `promo_codes`, restricción única de respuesta por jugador/pregunta) están en **`supabase/2026-07-09_security_scoring_fixes.sql`**. Ejecutar ese script (es idempotente) en el SQL Editor; no usar versiones antiguas de `process_scores`.

Ver `AUDITORIA_2026-07-09.md` para el detalle de hallazgos y pendientes de seguridad.


## 🏗️ Mejoras Implementadas
- **Tailwind CSS + Glassmorphism**: Estilos optimizados y consistentes.
- **Custom Hooks**: Toda la lógica de Realtime centralizada en `useGameRoom`.
- **Timer Sincronizado**: El tiempo se calcula basado en el servidor (`question_started_at`), evitando lag local.
- **Notificaciones**: Uso de `sonner` para feedback visual (toasts).
- **Session Recovery**: Los jugadores pueden reconectarse si refrescan la pestaña.

## 🏎️ Cómo Ejecutar
1. `npm install --legacy-peer-deps` (⚠️ `vite-plugin-pwa@1.2.0` declara peer `vite ≤7` y el proyecto usa vite 8 — `npm ci` falla sin el flag)
2. `npm run dev`

### ☁️ Exposición con Cloudflare (Opcional)
Si necesitas probar la app desde dispositivos móviles fuera de tu red local:
1. Instala `cloudflared`.
2. Ejecuta: `cloudflared tunnel --url http://localhost:5173`
3. Usa la URL generada (`.trycloudflare.com`) para acceder desde cualquier lugar.

## 🚢 Deploy en producción (lukeserver)

- La app se sirve como contenedor Docker **`lukequiz`**: `Dockerfile` construye el build de Vite y lo sirve con **nginx** (`nginx.conf` con headers de seguridad y política de cache) en el puerto **3002**.
- Dominio: **https://quiz.lukeapp.me** (túnel Cloudflare → localhost:3002).
- Base de datos: **Supabase Cloud** (proyecto `czsjwqwjshkfguzzrbre`), no el Supabase self-hosted del server.
- Edge functions: `supabase functions deploy generate-quiz generate-tts` (verifican JWT + premium).
- Operación del server documentada en `C:\Github\Skill\luke-quiz\SKILL.md` y `C:\Github\Skill\luke-server\Skill.md`.
