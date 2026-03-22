-- Run in Supabase SQL Editor
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS secondary_goals TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS health_conditions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS injury_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS days_available INT,
  ADD COLUMN IF NOT EXISTS contrast_therapy_preference TEXT,
  ADD COLUMN IF NOT EXISTS motivation_style TEXT,
  ADD COLUMN IF NOT EXISTS age_range TEXT;

-- Existing active members who pre-date this column should be 'active'
UPDATE users
  SET status = 'active'
  WHERE role = 'member'
    AND is_active = true
    AND status IS NULL;
