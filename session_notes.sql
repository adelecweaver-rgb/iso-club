-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS session_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id),
  coach_id UUID REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add vitality_age tracking to healthspan_scores
ALTER TABLE healthspan_scores
  ADD COLUMN IF NOT EXISTS vitality_age INT,
  ADD COLUMN IF NOT EXISTS chronological_age INT;
