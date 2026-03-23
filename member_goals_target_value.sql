-- Run in Supabase SQL Editor
-- Adds target_value to member_goals for AI-suggested measurable targets
ALTER TABLE member_goals
  ADD COLUMN IF NOT EXISTS target_value NUMERIC;
