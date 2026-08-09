-- ============================================================
-- LukeQuiz — Integración con TikTok LIVE (2026-08-09)
-- Permite que los quizzes creados en quiz.lukeapp.cl puedan ser
-- transmitidos en vivo en el Game Show de TikTok LIVE.
-- Script Idempotente.
-- ============================================================

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_public_for_live BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS creator_handle VARCHAR(100) DEFAULT '@comunidad';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS times_featured_on_live INT NOT NULL DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS last_featured_at TIMESTAMPTZ;

-- Indice para acelerar la selección aleatoria de quizzes por categoría para TikTok LIVE
CREATE INDEX IF NOT EXISTS idx_quizzes_live_category ON quizzes(category, is_public_for_live);
