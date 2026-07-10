-- ============================================================
-- LukeQuiz — Correcciones de seguridad y puntaje (2026-07-09)
-- Ejecutar en el SQL Editor de Supabase (proyecto czsjwqwjshkfguzzrbre)
-- Todo el script es idempotente: se puede ejecutar más de una vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PUNTAJE IDEMPOTENTE
-- Problema: process_scores podía ejecutarse 2+ veces por pregunta
-- (Host y Screen compiten, timers con race conditions) duplicando puntos.
-- Solución: cada respuesta se "reclama" una sola vez (columna scored).
-- ------------------------------------------------------------
ALTER TABLE answers ADD COLUMN IF NOT EXISTS scored BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION process_scores(p_game_id UUID, p_question_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct TEXT;
  v_tempo INT;
  v_start TIMESTAMPTZ;
BEGIN
  SELECT q.correct_option INTO v_correct FROM questions q WHERE q.id = p_question_id;

  -- El juego usa settings->tempo como tiempo real de pregunta (no time_limit)
  SELECT COALESCE(NULLIF((g.settings->>'tempo')::int, 0), 10), g.question_started_at
    INTO v_tempo, v_start
    FROM games g WHERE g.id = p_game_id;

  IF v_correct IS NULL OR v_start IS NULL THEN
    RETURN; -- guard: sin pregunta o sin inicio registrado
  END IF;

  -- Atómico e idempotente: solo respuestas aún no puntuadas de ESTA partida
  WITH claimed AS (
    UPDATE answers a
    SET scored = true
    WHERE a.question_id = p_question_id
      AND a.scored = false
      AND a.selected_option = v_correct
      AND a.player_id IN (SELECT p.id FROM players p WHERE p.game_id = p_game_id)
    RETURNING a.player_id, a.answered_at
  )
  UPDATE players p
  SET score = p.score + 1000 + ROUND(
        GREATEST(0, v_tempo - EXTRACT(EPOCH FROM (c.answered_at - v_start)))
        / v_tempo * 500
      )::int
  FROM claimed c
  WHERE p.id = c.player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION process_scores(UUID, UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. TRANSICIÓN DE ESTADO (SECURITY DEFINER para funcionar con RLS estricto)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_game_status(
  p_game_id UUID,
  p_status TEXT,
  p_index_offset INT,
  p_current_status TEXT,
  p_current_index INT
)
RETURNS games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games;
BEGIN
  UPDATE games
  SET
    status = p_status,
    current_question_index = current_question_index + p_index_offset,
    question_started_at = CASE WHEN p_status = 'question' THEN NOW() ELSE question_started_at END
  WHERE id = p_game_id
    AND status = p_current_status
    AND current_question_index = p_current_index
  RETURNING * INTO v_game;

  RETURN v_game;
END;
$$;

GRANT EXECUTE ON FUNCTION update_game_status(UUID, TEXT, INT, TEXT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE
AS $$ SELECT NOW(); $$;

GRANT EXECUTE ON FUNCTION get_server_time() TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. CANJE SEGURO DE CÓDIGOS PROMO (elimina el canje del lado del cliente)
-- Antes cualquier usuario podía: leer todos los códigos, o directamente
-- actualizar su propio premium_until sin código.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_promo_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id UUID;
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Debes iniciar sesión');
  END IF;

  -- Reclamo atómico: solo un usuario puede canjear cada código
  UPDATE promo_codes
  SET used_at = NOW(), used_by = v_user
  WHERE code = upper(trim(p_code)) AND used_at IS NULL
  RETURNING id INTO v_code_id;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Código inválido o ya utilizado');
  END IF;

  -- Extiende 24h desde ahora (o desde el vencimiento actual si aún está activo)
  UPDATE profiles
  SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + interval '24 hours'
  WHERE id = v_user;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_promo_code(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION redeem_promo_code(TEXT) FROM anon;

-- ------------------------------------------------------------
-- 4. HARDENING RLS
-- ⚠️ Aplicar DESPUÉS de verificar que el RPC redeem_promo_code funciona,
-- porque bloquea el flujo legado del cliente.
-- ------------------------------------------------------------

-- 4a. promo_codes: solo el admin los ve/gestiona; el canje va por RPC
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promo_codes_admin_all ON promo_codes;
CREATE POLICY promo_codes_admin_all ON promo_codes
  FOR ALL
  USING (auth.jwt()->>'email' = 'cristianluke@gmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'cristianluke@gmail.com');
-- NOTA: revisa con  select * from pg_policies where tablename='promo_codes';
-- y elimina cualquier política antigua más permisiva (DROP POLICY "nombre" ON promo_codes;)

-- 4b. profiles: nadie puede auto-asignarse premium por la API REST
REVOKE UPDATE (is_premium, premium_until) ON profiles FROM authenticated, anon;

-- 4c. Evitar respuestas duplicadas del mismo jugador a la misma pregunta
CREATE UNIQUE INDEX IF NOT EXISTS answers_player_question_uniq
  ON answers(player_id, question_id);

-- ------------------------------------------------------------
-- 5. ÍNDICES (por si faltan; IF NOT EXISTS los hace seguros)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_player ON answers(player_id);
CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_order ON questions(quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_games_join_code ON games(join_code);

-- ------------------------------------------------------------
-- PENDIENTE (revisar manualmente, no automatizable sin ver tus políticas):
-- 1. games: hoy cualquier cliente anon puede UPDATE (master_screen_id,
--    is_autopilot, settings, status). Un atacante podría sabotear partidas
--    ajenas. Sugerencia: mover esos updates a RPCs con validación, o al menos
--    limitar las columnas actualizables por anon.
-- 2. profiles: verifica que el SELECT público no exponga la columna email
--    (Admin.jsx la usa; cualquier usuario podría leerla también).
-- 3. quizzes con visibility='private': confirma que existe política que
--    impida SELECT a no-dueños (el filtro actual es solo del cliente).
-- ============================================================
