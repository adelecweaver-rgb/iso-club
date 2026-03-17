-- Run this entire file in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Step 1: Protocol library table (the 6 standard protocols)
CREATE TABLE IF NOT EXISTS protocols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target_system TEXT, -- 'muscle', 'cardio', 'metabolic', 'recovery', 'performance'
  arx_frequency_per_week INT,
  carol_frequency_per_week INT,
  recovery_target_per_month INT,
  carol_ride_types TEXT[],
  arx_exercises TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Member assignment table (links members to protocols)
CREATE TABLE IF NOT EXISTS member_protocols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES users(id),
  protocol_id UUID REFERENCES protocols(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused'
  coach_notes TEXT
);

-- Step 3: Seed the 6 standard protocols
-- (Skip if records already exist to avoid duplicates)
INSERT INTO protocols (name, description, target_system, arx_frequency_per_week, carol_frequency_per_week, recovery_target_per_month, carol_ride_types, arx_exercises, notes)
SELECT * FROM (VALUES
  (
    'Strength Foundation',
    'Build foundational strength across all major muscle groups',
    'muscle', 2, 2, 4,
    ARRAY['REHIT'],
    ARRAY['leg_press','chest_press','row'],
    'Focus on progressive overload. Track peak force concentric.'
  ),
  (
    'Metabolic Reset',
    'Improve metabolic health and body composition',
    'metabolic', 2, 3, 6,
    ARRAY['REHIT','FAT_BURN_30','FAT_BURN_45'],
    ARRAY['leg_press','chest_press','row'],
    'Combine ARX with Fat Burn CAROL. Cold plunge before lifting only.'
  ),
  (
    'Cardio Focus',
    'Improve cardiovascular fitness and VO2 max',
    'cardio', 1, 3, 4,
    ARRAY['REHIT','FAT_BURN_45','FAT_BURN_60'],
    ARRAY['leg_press','row'],
    'Prioritize CAROL consistency. Track MANP trend.'
  ),
  (
    'Longevity Protocol',
    'Comprehensive healthspan optimization across all systems',
    'muscle', 3, 3, 8,
    ARRAY['REHIT','FAT_BURN_30','FAT_BURN_60'],
    ARRAY['leg_press','chest_press','row','lat_pulldown'],
    'Full body approach. All five systems targeted weekly.'
  ),
  (
    'Recovery Phase',
    'Active recovery for injury or overtraining',
    'recovery', 1, 2, 8,
    ARRAY['FAT_BURN_30'],
    ARRAY['leg_press'],
    'Low intensity. Prioritize sleep and recovery modalities.'
  ),
  (
    'Exercise Performance',
    'Athletic performance and power development',
    'muscle', 3, 2, 4,
    ARRAY['REHIT'],
    ARRAY['leg_press','chest_press','row','bicep_curl'],
    'Focus on peak power output. Track sprint power trend.'
  )
) AS v(name, description, target_system, arx_frequency_per_week, carol_frequency_per_week, recovery_target_per_month, carol_ride_types, arx_exercises, notes)
WHERE NOT EXISTS (SELECT 1 FROM protocols WHERE protocols.name = v.name);
