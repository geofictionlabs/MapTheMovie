CREATE TABLE IF NOT EXISTS trivia_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genre TEXT NOT NULL,
  difficulty INT NOT NULL CHECK (difficulty IN (1,2,3,4)),
  coordinate_digit INT NOT NULL CHECK (coordinate_digit BETWEEN 0 AND 9),
  movie_title TEXT NOT NULL,
  movie_year INT,
  movie_emoji TEXT,
  question_text TEXT NOT NULL,
  correct_answer INT NOT NULL,
  extraction_note TEXT,
  hint_text TEXT,
  placeholder TEXT DEFAULT 'e.g. 4',
  is_active BOOLEAN DEFAULT TRUE,
  times_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trivia_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trivia_pool_select" ON trivia_pool
  FOR SELECT USING (true);

CREATE INDEX idx_trivia_pool_genre_difficulty_digit
  ON trivia_pool(genre, difficulty, coordinate_digit)
  WHERE is_active = TRUE;

ALTER TABLE hunt_sessions
  ADD COLUMN IF NOT EXISTS answered_question_ids UUID[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION get_questions_for_hunt(
  p_digits INT[],
  p_genre TEXT,
  p_difficulty INT,
  p_exclude_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  coordinate_digit INT,
  movie_title TEXT,
  movie_year INT,
  movie_emoji TEXT,
  question_text TEXT,
  extraction_note TEXT,
  hint_text TEXT,
  placeholder TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (tp.coordinate_digit)
    tp.id,
    tp.coordinate_digit,
    tp.movie_title,
    tp.movie_year,
    tp.movie_emoji,
    tp.question_text,
    tp.extraction_note,
    tp.hint_text,
    tp.placeholder
  FROM trivia_pool tp
  WHERE tp.coordinate_digit = ANY(p_digits)
    AND tp.genre = p_genre
    AND tp.difficulty = p_difficulty
    AND tp.is_active = TRUE
    AND NOT (tp.id = ANY(COALESCE(p_exclude_ids, '{}'::UUID[])))
  ORDER BY tp.coordinate_digit, RANDOM();
END;
$$;

GRANT EXECUTE ON FUNCTION get_questions_for_hunt TO anon, authenticated;
