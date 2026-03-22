-- Rename legacy protocols to the 5 canonical tier-based names
-- Run once in Supabase SQL Editor
-- Safe to run multiple times (UPDATE WHERE name = old_name is idempotent)

-- 1. Longevity Protocol → Longevity
UPDATE protocols
SET name        = 'Longevity',
    tier        = 'longevity',
    description = 'Balanced training for long-term health and energy across all systems.',
    days_per_week = 5
WHERE name = 'Longevity Protocol';

-- 2. Metabolic Reset → Body Composition
UPDATE protocols
SET name        = 'Body Composition',
    tier        = 'body_composition',
    description = 'Higher-volume training designed to shift body composition and build muscle.',
    days_per_week = 4
WHERE name = 'Metabolic Reset';

-- 3. Cardio Focus → Bone Density
--    (Cardio Focus is retired; slot replaced by Bone Density)
UPDATE protocols
SET name        = 'Bone Density',
    tier        = 'bone_density',
    description = 'Targeted loading protocols to improve skeletal strength and bone mineral density.',
    target_system = 'muscle',
    days_per_week = 3
WHERE name = 'Cardio Focus';

-- 4. Exercise Performance → Athletic Performance
UPDATE protocols
SET name        = 'Athletic Performance',
    tier        = 'athletic_performance',
    description = 'Higher-intensity training built to improve strength, power, and performance.',
    days_per_week = 4
WHERE name = 'Exercise Performance';

-- 5. Strength Foundation → Healthspan Elite
UPDATE protocols
SET name        = 'Healthspan Elite',
    tier        = 'healthspan_elite',
    description = 'Premium full-system protocol for committed members. Requires 3–6 sessions per week.',
    days_per_week = 5
WHERE name = 'Strength Foundation';

-- 6. Recovery Phase — keep but rename cleanly
UPDATE protocols
SET name        = 'Recovery',
    tier        = 'longevity',
    description = 'Active recovery for injury, overtraining, or deload phases.',
    days_per_week = 3
WHERE name = 'Recovery Phase';

-- Verify
SELECT name, tier, days_per_week, description FROM protocols ORDER BY tier, name;
