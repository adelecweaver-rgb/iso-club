-- Run in Supabase SQL Editor
-- Adds onboarding intake routing fields to the users table

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS days_available_per_week   INT,
  ADD COLUMN IF NOT EXISTS contrast_therapy_pref     TEXT,  -- 'yes' | 'cold_plunge_only' | 'no_preference'
  ADD COLUMN IF NOT EXISTS protocol_tier_suggestion  TEXT,  -- 'standard' | 'bone_density' | 'longevity' | 'healthspan_elite'
  ADD COLUMN IF NOT EXISTS coach_routing_note         TEXT;
