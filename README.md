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

### 4. Función de Puntaje (RPC) - Recomendado
Para manejar grandes volúmenes de jugadores, instala esta función en el SQL Editor:
```sql
CREATE OR REPLACE FUNCTION process_scores(p_game_id UUID, p_question_id UUID)
RETURNS void AS $$
DECLARE
  current_correct_option TEXT;
  current_time_limit INT;
  game_start_at TIMESTAMP;
BEGIN
  SELECT correct_option, time_limit INTO current_correct_option, current_time_limit
  FROM questions WHERE id = p_question_id;

  SELECT question_started_at INTO game_start_at
  FROM games WHERE id = p_game_id;

  UPDATE players
  SET score = score + (
    1000 + ROUND(GREATEST(0, (current_time_limit - EXTRACT(EPOCH FROM (a.answered_at - game_start_at)))) / current_time_limit * 500)
  )
  FROM answers a
  WHERE a.player_id = players.id
    AND a.question_id = p_question_id
    AND a.selected_option = current_correct_option;
END;
$$ LANGUAGE plpgsql;
```

## 🏗️ Mejoras Implementadas
- **Tailwind CSS + Glassmorphism**: Estilos optimizados y consistentes.
- **Custom Hooks**: Toda la lógica de Realtime centralizada en `useGameRoom`.
- **Timer Sincronizado**: El tiempo se calcula basado en el servidor (`question_started_at`), evitando lag local.
- **Notificaciones**: Uso de `sonner` para feedback visual (toasts).
- **Session Recovery**: Los jugadores pueden reconectarse si refrescan la pestaña.

## 🏎️ Cómo Ejecutar
1. `npm install`
2. `npm run dev`

### ☁️ Exposición con Cloudflare (Opcional)
Si necesitas probar la app desde dispositivos móviles fuera de tu red local:
1. Instala `cloudflared`.
2. Ejecuta: `cloudflared tunnel --url http://localhost:5173`
3. Usa la URL generada (`.trycloudflare.com`) para acceder desde cualquier lugar.
