-- Seed protocol_days and protocol_day_activities for all 5 canonical protocols
-- Run in Supabase SQL Editor after protocol_rename.sql
-- Safe to re-run — deletes and re-inserts days for each protocol

DO $seed$
DECLARE
  v_id   UUID;
  v_day  UUID;
BEGIN

-- ─── LONGEVITY ────────────────────────────────────────────────────────────────
SELECT id INTO v_id FROM protocols WHERE name = 'Longevity' LIMIT 1;
IF v_id IS NOT NULL THEN
  DELETE FROM protocol_day_activities WHERE protocol_day_id IN (SELECT id FROM protocol_days WHERE protocol_id = v_id);
  DELETE FROM protocol_days WHERE protocol_id = v_id;

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,1,'Monday','Strength + Cardio','Primary training day. ARX strength followed by CAROL sprint intervals.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body',20,false),
  (v_day,3,'cardio','CAROL REHIT',8,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,2,'Tuesday','Active Recovery','Light movement and recovery modalities to support adaptation.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'cardio','Zone 2 Walk or Bike',30,false),
  (v_day,2,'recovery','Infrared Sauna',20,false),
  (v_day,3,'recovery','Cold Plunge',3,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,3,'Wednesday','Mobility + Recovery','Dedicated mobility work and NxPro session.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'mobility','Mobility Flow',20,false),
  (v_day,2,'recovery','NxPro / Red Light',20,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,4,'Thursday','Strength + Cardio','Second primary training day of the week.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body',20,false),
  (v_day,3,'cardio','CAROL Fat Burn',20,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,5,'Friday','Zone 2 Cardio','Longer aerobic session to build aerobic base.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'cardio','Zone 2 — 45 min',45,false),
  (v_day,2,'recovery','Sauna + Cold Contrast',25,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,6,'Saturday','Optional Add-Ons','Enhance the week with optional modalities.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'strength','Katalyst EMS',20,true),
  (v_day,2,'strength','Vasper',25,true),
  (v_day,3,'strength','Proteus 3D',15,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,7,'Sunday','Rest','Full rest day. Prioritize sleep and nutrition.');
  RAISE NOTICE 'Longevity seeded.';
END IF;

-- ─── BODY COMPOSITION ────────────────────────────────────────────────────────
SELECT id INTO v_id FROM protocols WHERE name = 'Body Composition' LIMIT 1;
IF v_id IS NOT NULL THEN
  DELETE FROM protocol_day_activities WHERE protocol_day_id IN (SELECT id FROM protocol_days WHERE protocol_id = v_id);
  DELETE FROM protocol_days WHERE protocol_id = v_id;

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,1,'Monday','Strength — Upper','Upper body ARX focus to drive muscle and metabolic demand.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Upper Body',20,false),
  (v_day,3,'cardio','CAROL REHIT',8,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,2,'Tuesday','Cardio + Fat Burn','CAROL Fat Burn session plus Zone 2 to maximize caloric output.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'cardio','CAROL Fat Burn 45',45,false),
  (v_day,2,'cardio','Zone 2 Walk',20,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,3,'Wednesday','Strength — Lower','Lower body ARX focus. Legs drive the most muscle and hormonal response.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Lower Body',20,false),
  (v_day,3,'strength','Katalyst EMS',20,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,4,'Thursday','Active Recovery','Sauna and light movement to support fat metabolism.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Infrared Sauna',30,false),
  (v_day,2,'recovery','Cold Plunge',3,false),
  (v_day,3,'cardio','Zone 2 Walk',20,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,5,'Friday','Strength + CAROL','Full body ARX and sprint combination to close the training week.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body',20,false),
  (v_day,3,'cardio','CAROL REHIT',8,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,6,'Saturday','Optional Training','Additional session for committed members.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'cardio','CAROL Fat Burn 30',30,true),
  (v_day,2,'strength','Vasper',25,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,7,'Sunday','Rest','Full rest. Body is rebuilding.');
  RAISE NOTICE 'Body Composition seeded.';
END IF;

-- ─── BONE DENSITY ────────────────────────────────────────────────────────────
SELECT id INTO v_id FROM protocols WHERE name = 'Bone Density' LIMIT 1;
IF v_id IS NOT NULL THEN
  DELETE FROM protocol_day_activities WHERE protocol_day_id IN (SELECT id FROM protocol_days WHERE protocol_id = v_id);
  DELETE FROM protocol_days WHERE protocol_id = v_id;

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,1,'Monday','ARX Loading','Heavy axial loading via ARX to stimulate bone remodeling.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body — Heavy',20,false),
  (v_day,3,'cardio','CAROL REHIT',8,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,2,'Wednesday','Impact + Vibration','Targeted loading and vibration to support bone density adaptation.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'cardio','Zone 2 — Weight Bearing',30,false),
  (v_day,2,'strength','Proteus 3D',15,false),
  (v_day,3,'recovery','NxPro / Red Light',20,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,4,'Friday','ARX Loading','Second heavy loading session of the week.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body — Heavy',20,false),
  (v_day,3,'recovery','Infrared Sauna',20,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,7,'Sunday','Rest','Full rest.');
  RAISE NOTICE 'Bone Density seeded.';
END IF;

-- ─── ATHLETIC PERFORMANCE ────────────────────────────────────────────────────
SELECT id INTO v_id FROM protocols WHERE name = 'Athletic Performance' LIMIT 1;
IF v_id IS NOT NULL THEN
  DELETE FROM protocol_day_activities WHERE protocol_day_id IN (SELECT id FROM protocol_days WHERE protocol_id = v_id);
  DELETE FROM protocol_days WHERE protocol_id = v_id;

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,1,'Monday','Power Day','Maximum strength output. Cold before ARX to prime CNS.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body — Max Effort',20,false),
  (v_day,3,'cardio','CAROL REHIT',8,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,2,'Tuesday','Speed + Cardio','CAROL sprint focus and Vasper for cardiovascular performance.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'cardio','CAROL REHIT',8,false),
  (v_day,2,'strength','Vasper',25,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,3,'Wednesday','Active Recovery','Mobility and light aerobic work between loading days.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'mobility','Mobility Flow',20,false),
  (v_day,2,'cardio','Zone 2',30,false),
  (v_day,3,'recovery','Cold Plunge',3,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,4,'Thursday','Strength — Lower','Lower body focus with Katalyst for neuromuscular activation.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Lower Body',20,false),
  (v_day,3,'strength','Katalyst EMS',20,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,6,'Saturday','Optional Power','Additional power session for high-frequency athletes.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'strength','ARX Upper Body',20,true),
  (v_day,2,'cardio','CAROL REHIT',8,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,5,'Friday','Rest / Mobility','Light movement or full rest before weekend session.');

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,7,'Sunday','Rest','Full rest.');
  RAISE NOTICE 'Athletic Performance seeded.';
END IF;

-- ─── HEALTHSPAN ELITE ────────────────────────────────────────────────────────
SELECT id INTO v_id FROM protocols WHERE name = 'Healthspan Elite' LIMIT 1;
IF v_id IS NOT NULL THEN
  DELETE FROM protocol_day_activities WHERE protocol_day_id IN (SELECT id FROM protocol_days WHERE protocol_id = v_id);
  DELETE FROM protocol_days WHERE protocol_id = v_id;

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,1,'Monday','Full System Day','The most complete training session of the week. All systems activated.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body',20,false),
  (v_day,3,'cardio','CAROL REHIT',8,false),
  (v_day,4,'strength','Katalyst EMS',20,false),
  (v_day,5,'recovery','NxPro / Red Light',20,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,2,'Tuesday','Cardio + Zone 2','Aerobic capacity and fat oxidation session.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'strength','Vasper',25,false),
  (v_day,2,'cardio','Zone 2 — 45 min',45,false),
  (v_day,3,'recovery','Infrared Sauna',20,true),
  (v_day,4,'recovery','Cold Plunge',3,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,3,'Wednesday','Strength + 3D','Second ARX day plus Proteus for rotational strength.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body',20,false),
  (v_day,3,'strength','Proteus 3D',15,false),
  (v_day,4,'recovery','NxPro / Red Light',20,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,4,'Thursday','Mobility + Recovery','Dedicated recovery and mobility to sustain training frequency.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'mobility','Mobility Flow',25,false),
  (v_day,2,'recovery','Infrared Sauna',30,false),
  (v_day,3,'recovery','Cold Plunge',3,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,5,'Friday','Full System Day','Second full system day. Mirrors Monday intensity.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'recovery','Cold Plunge',3,false),
  (v_day,2,'strength','ARX Full Body',20,false),
  (v_day,3,'cardio','CAROL REHIT',8,false),
  (v_day,4,'strength','Katalyst EMS',20,true),
  (v_day,5,'recovery','NxPro / Red Light',20,false);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,6,'Saturday','Optional Elite Session','For members training 6x/week.') RETURNING id INTO v_day;
  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional) VALUES
  (v_day,1,'strength','Vasper',25,true),
  (v_day,2,'cardio','Zone 2',30,true),
  (v_day,3,'recovery','NxPro / Red Light',20,true);

  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_id,7,'Sunday','Rest','Full rest. Non-negotiable at this training volume.');
  RAISE NOTICE 'Healthspan Elite seeded.';
END IF;

END $seed$;

-- Verify
SELECT p.name, count(pd.id) AS days_seeded
FROM protocols p
LEFT JOIN protocol_days pd ON pd.protocol_id = p.id
GROUP BY p.name ORDER BY p.name;
