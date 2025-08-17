-- Create reviews table for daily and weekly reflections
CREATE TABLE IF NOT EXISTS reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('daily','weekly')),
  anchor_date date NOT NULL,
  productivity_rating integer DEFAULT 0,
  achieved_goal boolean,
  achieved_goal_reason text,
  satisfied boolean,
  satisfied_reason text,
  improvements text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_type_anchor_date_idx
  ON reviews (type, anchor_date);


