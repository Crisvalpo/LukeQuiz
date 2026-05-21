CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  RETURN NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_game_status(
  p_game_id UUID,
  p_status TEXT,
  p_index_offset INT,
  p_current_status TEXT,
  p_current_index INT
)
RETURNS games AS $$
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
$$ LANGUAGE plpgsql;
