-- Protocol extensions: tier, science_rationale, days_per_week, cold_plunge
-- Run once in Supabase SQL Editor

-- 1. Extend protocols table
ALTER TABLE IF EXISTS protocols
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'longevity',
  -- tier values: 'longevity' | 'bone_density' | 'body_composition' | 'athletic_performance' | 'healthspan_elite'
  ADD COLUMN IF NOT EXISTS science_rationale TEXT,
  ADD COLUMN IF NOT EXISTS days_per_week INT;
  -- days_per_week: 1–6 (all tiers); Healthspan Elite requires 3–6

-- 2. Extend protocol_day_activities with cold_plunge rule
ALTER TABLE IF EXISTS protocol_day_activities
  ADD COLUMN IF NOT EXISTS cold_plunge TEXT DEFAULT NULL;
  -- cold_plunge values:
  --   'recommended'       — before ARX or Katalyst (CNS primer)
  --   'optional_contrast' — after sauna on non-ARX/Katalyst days
  --   'optional_cardio'   — before Vasper or cardio-only sessions
  --   'never'             — after ARX or Katalyst (blunts hypertrophic adaptation)
  --   NULL                — not applicable / no guidance

-- 3. Back-fill tier on existing seeded protocols
UPDATE protocols SET tier = 'athletic_performance', days_per_week = 3 WHERE name = 'Strength Foundation'    AND tier IS NULL;
UPDATE protocols SET tier = 'body_composition',     days_per_week = 4 WHERE name = 'Metabolic Reset'        AND tier IS NULL;
UPDATE protocols SET tier = 'longevity',            days_per_week = 4 WHERE name = 'Cardio Focus'           AND tier IS NULL;
UPDATE protocols SET tier = 'longevity',            days_per_week = 5 WHERE name = 'Longevity Protocol'     AND tier IS NULL;
UPDATE protocols SET tier = 'longevity',            days_per_week = 3 WHERE name = 'Recovery Phase'         AND tier IS NULL;
UPDATE protocols SET tier = 'athletic_performance', days_per_week = 4 WHERE name = 'Exercise Performance'   AND tier IS NULL;
