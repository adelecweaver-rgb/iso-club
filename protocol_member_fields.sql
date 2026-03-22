-- New member fields for protocol tab personalization
-- Run once in Supabase SQL Editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS contrast_therapy_preference TEXT DEFAULT 'no_preference';
  -- values: 'yes' | 'cold_before_only' | 'no_preference'
  -- 'cold_before_only' → suppresses optional contrast cold plunge items
  -- 'yes' / 'no_preference' → shows everything including optional contrast
