-- Run in Supabase SQL Editor
-- Adds measurable target fields and metadata to member_goals for AI-suggested goals
ALTER TABLE member_goals
  ADD COLUMN IF NOT EXISTS target_value NUMERIC,
  ADD COLUMN IF NOT EXISTS target_unit TEXT,
  ADD COLUMN IF NOT EXISTS target_label TEXT,
  ADD COLUMN IF NOT EXISTS current_value NUMERIC,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'coach';
