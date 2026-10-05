-- ============================================================
-- REPARACIÓN SQL LUKEQUIZ (Esquema: quiz)
-- Fecha: 2026-10-05
-- ============================================================

-- 1. CORRECCIÓN DEL CÁLCULO DE PUNTAJES (process_scores)
-- Fix: calificar explícitamente quiz.players y fijar search_path en 'quiz', 'public'
CREATE OR REPLACE FUNCTION quiz.process_scores(p_game_id uuid, p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'quiz', 'public'
AS $$
DECLARE
  v_correct TEXT;
  v_tempo INT;
  v_start TIMESTAMPTZ;
BEGIN
  SELECT q.correct_option INTO v_correct FROM quiz.questions q WHERE q.id = p_question_id;

  SELECT COALESCE(NULLIF((g.settings->>'tempo')::int, 0), 10), g.question_started_at
    INTO v_tempo, v_start
    FROM quiz.games g WHERE g.id = p_game_id;

  IF v_correct IS NULL OR v_start IS NULL THEN
    RETURN;
  END IF;

  -- Atómico e idempotente: solo respuestas aún no puntuadas de ESTA partida
  WITH claimed AS (
    UPDATE quiz.answers a
    SET scored = true
    WHERE a.question_id = p_question_id
      AND a.scored = false
      AND a.selected_option = v_correct
      AND a.player_id IN (SELECT p.id FROM quiz.players p WHERE p.game_id = p_game_id)
    RETURNING a.player_id, a.answered_at
  )
  UPDATE quiz.players p
  SET score = p.score + 1000 + ROUND(
        GREATEST(0, v_tempo - EXTRACT(EPOCH FROM (c.answered_at - v_start)))
        / v_tempo * 500
      )::int
  FROM claimed c
  WHERE p.id = c.player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION quiz.process_scores(uuid, uuid) TO anon, authenticated;

-- 2. FUNCIÓN DE TRANSICIÓN DE ESTADO (update_game_status)
CREATE OR REPLACE FUNCTION quiz.update_game_status(
  p_game_id UUID,
  p_status TEXT,
  p_index_offset INT,
  p_current_status TEXT,
  p_current_index INT
)
RETURNS quiz.games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'quiz', 'public'
AS $$
DECLARE
  v_game quiz.games;
BEGIN
  UPDATE quiz.games
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

GRANT EXECUTE ON FUNCTION quiz.update_game_status(UUID, TEXT, INT, TEXT, INT) TO anon, authenticated;

-- 3. CANJE SEGURO DE CÓDIGOS PROMO (redeem_promo_code)
CREATE OR REPLACE FUNCTION quiz.redeem_promo_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'quiz', 'public'
AS $$
DECLARE
  v_code_id UUID;
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Debes iniciar sesión');
  END IF;

  UPDATE quiz.promo_codes
  SET used_at = NOW(), used_by = v_user
  WHERE code = upper(trim(p_code)) AND used_at IS NULL
  RETURNING id INTO v_code_id;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Código inválido o ya utilizado');
  END IF;

  UPDATE quiz.profiles
  SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + interval '24 hours'
  WHERE id = v_user;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION quiz.redeem_promo_code(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION quiz.redeem_promo_code(TEXT) FROM anon;

-- 4. SEGURIDAD Y RESTRICCIÓN DE PRIVILEGIOS
-- Bloquear auto-asignación de premium por la API REST
REVOKE UPDATE (is_premium, premium_until) ON quiz.profiles FROM anon, authenticated;

-- promo_codes: solo el administrador puede listar o crear códigos directamente
DROP POLICY IF EXISTS p_promo_codes ON quiz.promo_codes;
DROP POLICY IF EXISTS promo_codes_admin_only ON quiz.promo_codes;
CREATE POLICY promo_codes_admin_only ON quiz.promo_codes
  FOR ALL
  USING (auth.jwt()->>'email' = 'cristianluke@gmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'cristianluke@gmail.com');

-- 5. ÍNDICES DE RENDIMIENTO PARA TIEMPO REAL
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON quiz.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_player ON quiz.answers(player_id);
CREATE INDEX IF NOT EXISTS idx_quiz_players_game ON quiz.players(game_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_order ON quiz.questions(quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_games_join_code ON quiz.games(join_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_answers_player_question_uniq ON quiz.answers(player_id, question_id);
