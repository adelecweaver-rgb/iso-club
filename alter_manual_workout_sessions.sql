-- Run in Supabase SQL Editor
ALTER TABLE manual_workout_sessions
  ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_type TEXT;
