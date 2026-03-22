-- Run in Supabase SQL Editor
-- Seeds Healthspan Elite protocols (3x, 4x, 5x, 6x per week variants)
-- Requires: protocols, protocol_days, protocol_day_activities tables

DO $elite$
DECLARE
  v_p  UUID;
  v_d  UUID;
BEGIN

-- ────────────────────────────────────────────────────────────────────────────
-- HEALTHSPAN ELITE — 3x / WEEK
-- ────────────────────────────────────────────────────────────────────────────
SELECT id INTO v_p FROM protocols WHERE name = 'Healthspan Elite 3x' LIMIT 1;
IF v_p IS NULL THEN
  INSERT INTO protocols (name, description, target_system,
    arx_frequency_per_week, carol_frequency_per_week, recovery_target_per_month,
    carol_ride_types, arx_exercises, notes)
  VALUES (
    'Healthspan Elite 3x',
    'Maximum evidence-based protocol — I''ve made my health a top priority and want to use every tool available. Time is not a constraint.',
    'performance',
    1, 2, 9,
    ARRAY['zone_2','norwegian_4x4'],
    ARRAY['full_body'],
    '3x sauna minimum. Contrast therapy available all three days — sauna always precedes cold. Cold as CNS primer Days 1 and 3. Vasper Day 2 blunts cortisol and extends HGH pulse between high-stimulus sessions. NXPro is prescribed, not optional.'
  ) RETURNING id INTO v_p;
END IF;
IF EXISTS (SELECT 1 FROM protocol_days WHERE protocol_id = v_p) THEN
  RAISE NOTICE 'Healthspan Elite 3x already seeded.';
ELSE
  -- DAY 1
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description)
  VALUES (v_p,1,'Day 1','ARX + Full Stack',
    'Your primary strength day. Cold exposure primes your CNS before ARX, Zone 2 cardio extends the aerobic stimulus, infrared sauna drives recovery and cardiovascular adaptation, and NXPro locks in mobility as a non-negotiable pillar.')
  RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,'3–4 minutes before ARX to prime the CNS.','Cold exposure before resistance training increases power output, mental focus, and nervous system activation.', ARRAY['Enter slowly, control breathing','Stay 3–4 full minutes','Exit and begin ARX within 5 minutes'],false),
  (v_d,2,'strength','ARX Full Body',20,'Full-body adaptive resistance to muscular failure.','One set per exercise to complete failure. Maximum stimulus in minimum time.', ARRAY['Leg press → Row → Chest press','Push maximally throughout full ROM','Set ends when no movement is possible'],false),
  (v_d,3,'cardio','CAROL Zone 2',30,'30-minute steady-state cardio at conversational pace.','Zone 2 builds mitochondrial density and fat oxidation without adding recovery burden.', ARRAY['Set resistance for comfortable conversation pace','Maintain throughout — if breathless, reduce intensity'],false),
  (v_d,4,'strength','Proteus 3D',15,'Optional 3D resistance targeting core, single-leg stability, arm farm, shoulder stability, sports-specific.','Proteus trains rotational and lateral strength — the planes conventional equipment ignores.', ARRAY['Slow controlled movements','Feel resistance through full range','Exhale on exertion'],true),
  (v_d,5,'recovery','Infrared Sauna',25,'25 minutes post-training.','Infrared sauna accelerates muscle repair, increases circulation, and drives heat-shock protein production. Laukkanen data links regular sauna to 40% reduced CVD mortality.', ARRAY['Enter at 150°F','Breathe deeply','Hydrate immediately after'],false),
  (v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional — contrast after sauna.','Contrast therapy stimulates lymphatic system, reduces inflammation, and produces a neurological mood and clarity boost.', ARRAY['Move directly from sauna to cold','Control breathing — slow exhale','3–4 minutes'],true),
  (v_d,7,'recovery','Compression Boots',20,'Compression recovery.','Accelerates venous return, reduces muscle soreness, and clears metabolic waste.', ARRAY['Elevate legs fully','Relax for full session'],false),
  (v_d,8,'coaching','NXPro Session',45,'Prescribed NXPro session — 30 or 60 minutes.','NXPro is a primary training pillar at this tier, not an add-on. Mobility as a longevity category (Attia on fall prevention and joint health).', ARRAY['Book in advance','Communicate current soreness or limitations'],false);

  -- DAY 2
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description)
  VALUES (v_p,2,'Day 2','Sauna + Deep Recovery',
    'Active recovery day. Vasper blunts cortisol and extends the HGH pulse from Day 1, extending adaptation between high-stimulus sessions. Sauna and compression complete the recovery stack.')
  RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Vasper',20,'Compression cooling combined with light exercise.','Vasper produces up to 1300% more growth hormone than conventional exercise, extending the HGH pulse between training days and blunting cortisol.', ARRAY['Compression cuffs on arms and legs','Comfortable cycling pace throughout','Stay hydrated'],false),
  (v_d,2,'recovery','Infrared Sauna',25,'25 minutes infrared sauna.','Heat exposure on recovery days deepens muscle repair and maintains the sauna dose for cardiovascular benefit.', ARRAY['Enter at 150°F','Fully relax — no phone if possible','Drink water immediately after'],false),
  (v_d,3,'recovery','Cold Plunge (contrast)',4,'Optional — contrast after sauna.','Contrast therapy on recovery days reduces systemic inflammation and accelerates readiness for Day 3.', ARRAY['Sauna → cold plunge','3–4 minutes','Exit energised'],true),
  (v_d,4,'recovery','Compression Boots',20,'Compression recovery.','Venous return and waste clearance.', ARRAY['Full elevation','Relax for full session'],false),
  (v_d,5,'coaching','NXPro Session',45,'Prescribed NXPro — 30 or 60 minutes.','Mobility work on recovery days compounds the structural benefits without adding high-intensity load.', ARRAY['Book in advance'],false);

  -- DAY 3
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description)
  VALUES (v_p,3,'Day 3','Katalyst + HIIT + Sauna',
    'Your highest-intensity cardiovascular day. Cold primes the CNS, Katalyst recruits maximum muscle fibers, the Norwegian 4x4 builds aerobic power at elite levels, and the full sauna + contrast stack drives peak adaptation.')
  RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,'3–4 minutes before Katalyst.','CNS primer before electrical muscle stimulation maximises fibre recruitment.', ARRAY['3–4 minutes','Begin Katalyst within 5 minutes'],false),
  (v_d,2,'strength','Katalyst EMS',20,'Full-body electrical muscle stimulation.','Katalyst recruits up to 90% of muscle fibres simultaneously — the equivalent of a 90-minute conventional session in 20 minutes.', ARRAY['Slow controlled movements throughout','Communicate intensity with staff','Expect 2–3 day soreness — that is correct'],false),
  (v_d,3,'cardio','CAROL Norwegian 4x4',35,'Four 4-minute intervals at 85–95% max HR.','The most researched HIIT protocol for VO2 max improvement and longevity. Largest VO2 max gains of any training method.', ARRAY['5 min warm-up','4 × 4 min at 85–95% effort','3 min recovery between intervals','5 min cool-down'],false),
  (v_d,4,'strength','Proteus 3D',15,'Optional.','Sports-specific 3D stability work.', ARRAY['Slow and controlled'],true),
  (v_d,5,'recovery','Infrared Sauna',25,'25 minutes post-training.','Post-HIIT sauna dramatically increases plasma volume, directly improving future cardiovascular performance.', ARRAY['Enter at 150°F','Full relaxation','Hydrate'],false),
  (v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional — contrast after sauna.','Contrast therapy post-HIIT reduces inflammation and elevates mood and clarity for hours.', ARRAY['Sauna → cold','3–4 minutes'],true),
  (v_d,7,'recovery','Compression Boots',20,'Compression recovery.',NULL, ARRAY['Full elevation'],false);
END IF;


-- ────────────────────────────────────────────────────────────────────────────
-- HEALTHSPAN ELITE — 4x / WEEK
-- ────────────────────────────────────────────────────────────────────────────
SELECT id INTO v_p FROM protocols WHERE name = 'Healthspan Elite 4x' LIMIT 1;
IF v_p IS NULL THEN
  INSERT INTO protocols (name, description, target_system,
    arx_frequency_per_week, carol_frequency_per_week, recovery_target_per_month,
    carol_ride_types, arx_exercises, notes)
  VALUES (
    'Healthspan Elite 4x',
    'Maximum evidence-based protocol — I''ve made my health a top priority and want to use every tool available. Time is not a constraint.',
    'performance',
    1, 3, 12,
    ARRAY['zone_2','norwegian_4x4'],
    ARRAY['full_body'],
    'Achieves Laukkanen 4x/week sauna dose linked to 40% CVD mortality reduction. Contrast therapy all 4 days. Cold as CNS primer Days 1 and 3. NXPro on 3 days as a primary training pillar.'
  ) RETURNING id INTO v_p;
END IF;
IF EXISTS (SELECT 1 FROM protocol_days WHERE protocol_id = v_p) THEN
  RAISE NOTICE 'Healthspan Elite 4x already seeded.';
ELSE
  -- DAY 1
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description)
  VALUES (v_p,1,'Day 1','ARX + Full Stack','Strength anchor day. Cold → ARX → Zone 2 → Sauna + contrast stack. NXPro prescribed.')
  RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,'3–4 min CNS primer.',NULL,ARRAY['3–4 minutes','Start ARX within 5 min'],false),
  (v_d,2,'strength','ARX Full Body',20,'Full-body to failure.',NULL,ARRAY['Leg press → Row → Chest press','Maximum effort'],false),
  (v_d,3,'cardio','CAROL Zone 2',30,'30-min Zone 2.',NULL,ARRAY['Conversational pace throughout'],false),
  (v_d,4,'strength','Proteus 3D',15,'Optional.',NULL,ARRAY['Slow and controlled'],true),
  (v_d,5,'recovery','Infrared Sauna',25,'25-min infrared.',NULL,ARRAY['150°F','Hydrate after'],false),
  (v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional contrast.',NULL,ARRAY['Sauna → cold','3–4 min'],true),
  (v_d,7,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),
  (v_d,8,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  -- DAY 2
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description)
  VALUES (v_p,2,'Day 2','Sauna + Passive Recovery','Vasper + sauna + contrast + NXPro. HGH pulse extension between training days.')
  RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Vasper',20,NULL,NULL,ARRAY['Compression cuffs on','Comfortable pace'],false),
  (v_d,2,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F','Hydrate'],false),
  (v_d,3,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold','3–4 min'],true),
  (v_d,4,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),
  (v_d,5,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  -- DAY 3
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description)
  VALUES (v_p,3,'Day 3','Katalyst + HIIT + Sauna','Highest-intensity day. Cold → Katalyst → Norwegian 4x4 → Sauna + contrast.')
  RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,'CNS primer.',NULL,ARRAY['3–4 minutes'],false),
  (v_d,2,'strength','Katalyst EMS',20,NULL,NULL,ARRAY['Slow movements','Communicate intensity'],false),
  (v_d,3,'cardio','CAROL Norwegian 4x4',35,NULL,NULL,ARRAY['5 min warm-up','4×4 min at 85–95%','3 min recovery between'],false),
  (v_d,4,'strength','Proteus 3D',15,'Optional.',NULL,ARRAY['Slow and controlled'],true),
  (v_d,5,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F','Hydrate'],false),
  (v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),
  (v_d,7,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false);

  -- DAY 4
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description)
  VALUES (v_p,4,'Day 4','Zone 2 + Sauna + Mobility','Aerobic base day. Optional cold opener, 40-min Zone 2, full sauna + contrast stack, NXPro mobility.')
  RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge (optional)',4,'Optional before cardio.',NULL,ARRAY['Optional CNS primer before Zone 2'],true),
  (v_d,2,'cardio','CAROL Zone 2',40,'40-min aerobic base.',NULL,ARRAY['True conversational pace','40 min — do not cut short'],false),
  (v_d,3,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F','Hydrate'],false),
  (v_d,4,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),
  (v_d,5,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),
  (v_d,6,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);
END IF;


-- ────────────────────────────────────────────────────────────────────────────
-- HEALTHSPAN ELITE — 5x / WEEK
-- ────────────────────────────────────────────────────────────────────────────
SELECT id INTO v_p FROM protocols WHERE name = 'Healthspan Elite 5x' LIMIT 1;
IF v_p IS NULL THEN
  INSERT INTO protocols (name, description, target_system,
    arx_frequency_per_week, carol_frequency_per_week, recovery_target_per_month,
    carol_ride_types, arx_exercises, notes)
  VALUES (
    'Healthspan Elite 5x',
    'Maximum evidence-based protocol — I''ve made my health a top priority and want to use every tool available. Time is not a constraint.',
    'performance',
    1, 4, 15,
    ARRAY['zone_2','norwegian_4x4','fat_burn_60'],
    ARRAY['full_body'],
    '5x sauna exceeds Laukkanen 4x threshold every week. Contrast therapy available every day. Cold as CNS primer Days 1 and 3. NXPro on 4 of 5 days treats mobility as a primary longevity category.'
  ) RETURNING id INTO v_p;
END IF;
IF EXISTS (SELECT 1 FROM protocol_days WHERE protocol_id = v_p) THEN
  RAISE NOTICE 'Healthspan Elite 5x already seeded.';
ELSE
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,1,'Day 1','ARX + Full Stack','Cold → ARX → Zone 2 (25 min) → Sauna + contrast + Compression + NXPro.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,NULL,NULL,ARRAY['3–4 min CNS primer'],false),(v_d,2,'strength','ARX Full Body',20,NULL,NULL,ARRAY['Full-body to failure'],false),(v_d,3,'cardio','CAROL Zone 2',25,NULL,NULL,ARRAY['Conversational pace'],false),(v_d,4,'strength','Proteus 3D',15,'Optional.',NULL,ARRAY['Slow and controlled'],true),(v_d,5,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,7,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,8,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,2,'Day 2','Sauna + Recovery','Vasper → Sauna + contrast → Compression + NXPro.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Vasper',20,NULL,NULL,ARRAY['Compression cuffs on'],false),(v_d,2,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,3,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,4,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,5,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,3,'Day 3','Katalyst + HIIT + Sauna','Cold → Katalyst → Norwegian 4x4 → Sauna + contrast + Compression.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,NULL,NULL,ARRAY['CNS primer'],false),(v_d,2,'strength','Katalyst EMS',20,NULL,NULL,ARRAY['Slow movements'],false),(v_d,3,'cardio','CAROL Norwegian 4x4',35,NULL,NULL,ARRAY['4×4 at 85–95%'],false),(v_d,4,'strength','Proteus 3D',15,'Optional.',NULL,ARRAY['Slow and controlled'],true),(v_d,5,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,7,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,4,'Day 4','Zone 2 + Sauna + Mobility','Optional cold opener → 40-min Zone 2 → Sauna + contrast + Compression + NXPro.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge (optional)',4,'Optional.',NULL,ARRAY['Optional before Zone 2'],true),(v_d,2,'cardio','CAROL Zone 2',40,NULL,NULL,ARRAY['Conversational pace','40 min'],false),(v_d,3,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,4,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,5,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,6,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,5,'Day 5','Fat Burn + Sauna + Mobility','Optional cold opener → 60-min Fat Burn → Sauna + contrast + Compression + NXPro.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge (optional)',4,'Optional.',NULL,ARRAY['Optional before cardio'],true),(v_d,2,'cardio','CAROL Fat Burn 60',60,NULL,NULL,ARRAY['Comfortable sustained effort','60 min'],false),(v_d,3,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,4,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,5,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,6,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);
END IF;


-- ────────────────────────────────────────────────────────────────────────────
-- HEALTHSPAN ELITE — 6x / WEEK
-- ────────────────────────────────────────────────────────────────────────────
SELECT id INTO v_p FROM protocols WHERE name = 'Healthspan Elite 6x' LIMIT 1;
IF v_p IS NULL THEN
  INSERT INTO protocols (name, description, target_system,
    arx_frequency_per_week, carol_frequency_per_week, recovery_target_per_month,
    carol_ride_types, arx_exercises, notes)
  VALUES (
    'Healthspan Elite 6x',
    'Maximum evidence-based protocol — I''ve made my health a top priority and want to use every tool available. Time is not a constraint.',
    'performance',
    1, 5, 18,
    ARRAY['zone_2','norwegian_4x4','fat_burn_60'],
    ARRAY['full_body'],
    'Maximum evidence-based weekly dose. 6x sauna at the ceiling of Laukkanen data. Contrast therapy every single day. Cold as CNS primer Days 1 and 3 only. ARX and Katalyst once weekly each — non-negotiable even at this tier.'
  ) RETURNING id INTO v_p;
END IF;
IF EXISTS (SELECT 1 FROM protocol_days WHERE protocol_id = v_p) THEN
  RAISE NOTICE 'Healthspan Elite 6x already seeded.';
ELSE
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,1,'Day 1','ARX + Full Stack','Cold → ARX → Zone 2 (25 min) → Sauna + contrast + Compression + NXPro.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,NULL,NULL,ARRAY['CNS primer'],false),(v_d,2,'strength','ARX Full Body',20,NULL,NULL,ARRAY['Full-body to failure'],false),(v_d,3,'cardio','CAROL Zone 2',25,NULL,NULL,ARRAY['Conversational pace'],false),(v_d,4,'strength','Proteus 3D',15,'Optional.',NULL,ARRAY['Slow and controlled'],true),(v_d,5,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,7,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,8,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,2,'Day 2','Sauna + Deep Recovery','Vasper → Sauna + contrast + Compression + NXPro.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Vasper',20,NULL,NULL,ARRAY['Compression cuffs on'],false),(v_d,2,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,3,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,4,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,5,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,3,'Day 3','Katalyst + HIIT + Sauna','Cold → Katalyst → Norwegian 4x4 → Sauna + contrast + Compression.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge',4,NULL,NULL,ARRAY['CNS primer'],false),(v_d,2,'strength','Katalyst EMS',20,NULL,NULL,ARRAY['Slow movements'],false),(v_d,3,'cardio','CAROL Norwegian 4x4',35,NULL,NULL,ARRAY['4×4 at 85–95%'],false),(v_d,4,'strength','Proteus 3D',15,'Optional.',NULL,ARRAY['Slow and controlled'],true),(v_d,5,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,6,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,7,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,4,'Day 4','Zone 2 + Sauna + Mobility','Optional cold → 40-min Zone 2 → Sauna + contrast + Compression + NXPro.') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge (optional)',4,'Optional.',NULL,ARRAY['Optional before Zone 2'],true),(v_d,2,'cardio','CAROL Zone 2',40,NULL,NULL,ARRAY['Conversational pace'],false),(v_d,3,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,4,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,5,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,6,'coaching','NXPro Session',45,'Prescribed.',NULL,ARRAY['Book in advance'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,5,'Day 5','Fat Burn + Proteus + Sauna','Optional cold → Fat Burn 60 → Proteus (optional) → Sauna + contrast + Compression + NXPro (30 min).') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Cold Plunge (optional)',4,'Optional.',NULL,ARRAY['Optional before cardio'],true),(v_d,2,'cardio','CAROL Fat Burn 60',60,NULL,NULL,ARRAY['Sustained effort'],false),(v_d,3,'strength','Proteus 3D',15,'Optional.',NULL,ARRAY['Slow and controlled'],true),(v_d,4,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,5,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,6,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,7,'coaching','NXPro Session',30,'Prescribed — 30 min.',NULL,ARRAY['Book in advance'],false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES (v_p,6,'Day 6','Vasper + Sauna + Full Mobility','Vasper → Zone 2 (20 min) → Sauna + contrast + Compression + NXPro (60 min full mobility).') RETURNING id INTO v_d;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional) VALUES
  (v_d,1,'recovery','Vasper',20,NULL,NULL,ARRAY['Compression cuffs on','Easy pace'],false),(v_d,2,'cardio','CAROL Zone 2',20,NULL,NULL,ARRAY['Conversational pace','20 min'],false),(v_d,3,'recovery','Infrared Sauna',25,NULL,NULL,ARRAY['150°F'],false),(v_d,4,'recovery','Cold Plunge (contrast)',4,'Optional.',NULL,ARRAY['Sauna → cold'],true),(v_d,5,'recovery','Compression Boots',20,NULL,NULL,ARRAY['Full elevation'],false),(v_d,6,'coaching','NXPro Session',60,'Prescribed — 60 min full mobility.',NULL,ARRAY['Book in advance — full session'],false);
END IF;

RAISE NOTICE 'Healthspan Elite protocols seeded successfully (3x, 4x, 5x, 6x).';
END $elite$;
