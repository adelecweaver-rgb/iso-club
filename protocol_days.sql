-- Run in Supabase SQL Editor
-- Step 1: Create tables
CREATE TABLE IF NOT EXISTS protocol_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID REFERENCES protocols(id),
  day_of_week INT,
  day_name TEXT,
  day_theme TEXT,
  day_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protocol_day_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_day_id UUID REFERENCES protocol_days(id),
  activity_order INT,
  activity_type TEXT,
  activity_name TEXT,
  duration_minutes INT,
  description TEXT,
  why_it_matters TEXT,
  steps TEXT[],
  is_bookable BOOLEAN DEFAULT false,
  booking_url TEXT,
  is_optional BOOLEAN DEFAULT false,
  alternative_activity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Seed Longevity Protocol (skip if already seeded)
DO $seed$
DECLARE
  v_lp UUID;
  v_day UUID;
BEGIN
  SELECT id INTO v_lp FROM protocols WHERE name = 'Longevity Protocol' LIMIT 1;
  IF v_lp IS NULL THEN RAISE NOTICE 'Longevity Protocol not found — seed protocols first.'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM protocol_days WHERE protocol_id = v_lp) THEN RAISE NOTICE 'Already seeded.'; RETURN; END IF;

  -- MONDAY
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_lp,1,'Monday','Strength Day','Today is your most important training day of the week. You will build muscle, spike your metabolism, and train your cardiovascular system — all in under 45 minutes. This combination of cold exposure, strength training, sprint intervals, and 3D resistance is the most efficient way to improve every longevity marker we track.')
  RETURNING id INTO v_day;

  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps) VALUES
  (v_day,1,'recovery','Cold Plunge',3,'Start with 3 minutes in the cold plunge before your strength training.','Cold exposure before training activates your nervous system, increases alertness, and primes your body for peak performance. Research shows cold exposure before resistance training increases power output and mental focus.',
   ARRAY['Enter cold plunge slowly — do not jump in','Control your breathing — slow exhale through the mouth','Stay for 3 full minutes','Exit and dry off — do not warm up artificially','Begin ARX within 5 minutes while nervous system is activated']),
  (v_day,2,'strength','ARX Full Body',20,'Three exercises — leg press, row, and chest press. One set each taken to complete muscular failure using adaptive resistance.','ARX adaptive resistance matches your exact strength curve throughout every rep, making every second of effort count. One set to failure with ARX produces the same muscle stimulus as 45 minutes of conventional training. This is the most time-efficient strength training available.',
   ARRAY['Leg press first — largest muscle group, sets hormonal response for whole session','Push maximally through entire range of motion — the machine matches your effort','When you cannot move the weight at all, the set is complete','Rest 2 minutes between exercises','Row second — upper back and biceps','Chest press third — chest, shoulders, triceps','Each set should feel impossible at the end — that is the goal']),
  (v_day,3,'cardio','CAROL REHIT',8,'Two 20-second all-out sprint intervals separated by a 2-minute recovery period.','CAROL REHIT is the most researched high-intensity protocol in existence. Two 20-second maximal sprints trigger the same cardiovascular adaptations as 45 minutes of jogging — in 8 minutes total. This is not about burning calories. It is about training your heart, lungs, and mitochondria to operate at a higher level.',
   ARRAY['Warm up at easy pace for 2 minutes','Sprint 1 — go absolutely all out for 20 seconds. Maximum effort.','Recover at easy pace for 2 minutes — keep pedaling','Sprint 2 — everything you have for 20 seconds','Cool down for 3 minutes at easy pace','Your legs should feel like they cannot continue during each sprint — that is correct']),
  (v_day,4,'strength','Proteus 3D Core',15,'Three-dimensional resistance training targeting your core and rotational strength.','Conventional core training works in one plane of motion. Proteus trains your core through rotation, extension, and lateral movement simultaneously — the way your body actually moves in real life. A strong 3D core protects your spine, improves posture, and transfers directly to every other movement you do.',
   ARRAY['Start with rotational movements — slow and controlled','Feel the resistance through your entire range of motion','Do not rush — Proteus rewards control over speed','Focus on breathing — exhale on exertion','Your core should feel fully engaged throughout — if not, slow down']);

  -- TUESDAY
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_lp,2,'Tuesday','Active Recovery','Yesterday you created significant stimulus in your muscles and cardiovascular system. Today is when your body actually builds the adaptations. Active recovery accelerates this process — it is not a rest day, it is a building day.')
  RETURNING id INTO v_day;

  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps) VALUES
  (v_day,1,'recovery','Vasper',30,'Compression cooling system combining exercise with cooling technology.','Vasper combines light exercise with cooling compression to dramatically amplify growth hormone response. Studies show Vasper produces up to 1300% more growth hormone than conventional exercise. Growth hormone is your primary recovery and anti-aging hormone.',
   ARRAY['Put on compression cuffs — arms and legs','Begin light cycling at comfortable pace','The cooling sensation is normal — embrace it','Maintain conversational pace throughout — this is not intense','Stay hydrated — drink water during session','You should feel refreshed not exhausted when finished']),
  (v_day,2,'recovery','Infrared Sauna',20,'20 minutes in the infrared sauna following Vasper.','Infrared sauna penetrates deeper than conventional heat — it reaches your muscles and joints directly. This accelerates muscle repair, increases circulation, and triggers heat shock proteins that protect your cells from damage. Research links regular sauna use to dramatically reduced cardiovascular disease risk.',
   ARRAY['Enter sauna at 150°F','Sit or lie comfortably — focus on breathing deeply','You will sweat significantly — this is beneficial','Stay for the full 20 minutes if comfortable','Drink 16oz of water immediately after','Do not shower with cold water immediately — let your body cool naturally']);

  -- WEDNESDAY
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_lp,3,'Wednesday','Power + Coaching','Wednesday combines your most challenging cardiovascular protocol with personal coaching and full recovery. The Norwegian 4x4 is used by elite athletes worldwide to build aerobic power. Paired with your NxPro session with Dustin, this is your highest-value day of the week.')
  RETURNING id INTO v_day;

  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_bookable,booking_url) VALUES
  (v_day,1,'cardio','CAROL Norwegian 4x4',35,'Four 4-minute high intensity intervals at 85-95% of maximum heart rate separated by 3-minute recovery periods.','The Norwegian 4x4 protocol is backed by more longevity research than almost any other exercise protocol. It produces the largest improvements in VO2 max of any training method — and VO2 max is the single strongest predictor of longevity in medical research.',
   ARRAY['Warm up at easy pace for 5 minutes','Interval 1 — push to 85-95% of max effort for 4 minutes. You should be able to say only a few words.','Recover at easy pace for 3 minutes — keep pedaling','Interval 2 — same effort for 4 minutes','Recover 3 minutes','Interval 3 — 4 minutes at high effort','Recover 3 minutes','Interval 4 — final push for 4 minutes — give everything','Cool down for 5 minutes at easy pace'],
  false,null),
  (v_day,2,'coaching','NxPro Session with Dustin',60,'Private one-on-one coaching session with Dustin using the NxPro system.','Your weekly session with Dustin is where everything comes together. Dustin reviews your data from the week, adjusts your protocol based on your progress, and works with you directly using NxPro.',
   ARRAY['Come with any questions about your progress or how you have been feeling','Dustin will review your week''s data before you arrive','Be ready to discuss your energy levels, sleep, and nutrition','This session drives the most meaningful adaptations in your program'],
  true,'https://theiso.club/book'),
  (v_day,3,'recovery','Infrared Sauna',20,'20 minutes of infrared sauna following your training.','Heat exposure after high intensity cardio dramatically accelerates recovery and increases plasma volume — which directly improves your cardiovascular performance in future sessions.',
   ARRAY['Enter at 150°F','Breathe deeply and let your body fully relax','Focus on releasing tension from the intervals','Stay hydrated'],
  false,null),
  (v_day,4,'recovery','Cold Plunge',3,'Finish with 3 minutes of cold exposure.','Contrast therapy — moving from heat to cold — powerfully stimulates your lymphatic system, reduces inflammation, and creates a neurological response that improves mood and mental clarity for hours afterward.',
   ARRAY['Move directly from sauna to cold plunge','Enter slowly and control your breathing','Stay for 3 full minutes','Exit feeling alert and energized'],
  false,null);

  -- THURSDAY
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_lp,4,'Thursday','Aerobic Base','Thursday builds your aerobic base — the foundation that makes everything else work better. Zone 2 training teaches your body to burn fat efficiently and builds the mitochondrial density that underlies all longevity markers. Paired with full recovery, your body is rebuilding and strengthening for Friday.')
  RETURNING id INTO v_day;

  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional,alternative_activity) VALUES
  (v_day,1,'cardio','CAROL Zone 2 Free Ride',45,'A steady, comfortable ride at conversational pace — you should be able to hold a full conversation throughout.','Zone 2 training is having a moment in longevity science. It builds mitochondrial density, improves fat oxidation, and creates the aerobic base that supports all your high-intensity work.',
   ARRAY['Set resistance to a comfortable level — this should feel easy','Maintain a pace where you can speak in full sentences','If you cannot speak comfortably you are going too hard — back off','45 minutes at true Zone 2 is more valuable than 20 minutes too hard','Use this time to decompress — no performance pressure today'],
  true,'Outdoor walk for 45 minutes at comfortable pace — same Zone 2 principles apply'),
  (v_day,2,'recovery','Infrared Sauna',20,'20 minutes of infrared sauna.','Regular sauna use is one of the most research-backed longevity interventions available. A landmark Finnish study found that those who used sauna 4-7 times per week had 40% lower cardiovascular mortality.',
   ARRAY['Enter at 150°F','Relax fully — no phone, no email','Focus on breathing deeply','This is your recovery and reflection time'],
  false,null),
  (v_day,3,'recovery','Cold Plunge',3,'3 minutes of cold exposure to complete your contrast therapy cycle.','Finishing with cold after sauna creates a powerful hormetic stress response. Regular cold exposure increases norepinephrine by up to 300%, improving mood, focus, and metabolic rate.',
   ARRAY['Move from sauna to cold plunge','Control your breathing — slow exhale','3 full minutes','Exit feeling clear and energized'],
  false,null);

  -- FRIDAY
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_lp,5,'Friday','Power Day','Friday brings another sprint protocol and full body electrical muscle stimulation — finishing your training week with power and intensity before the weekend recovery days. This combination maximizes the growth hormone and testosterone response that drives your results over the weekend.')
  RETURNING id INTO v_day;

  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps) VALUES
  (v_day,1,'recovery','Cold Plunge',3,'Start Friday with cold exposure to activate your nervous system.','Starting your power day with cold primes your central nervous system for maximum output.',
   ARRAY['Enter cold plunge before training','Control breathing — this gets easier every week','3 full minutes','Begin training within 5 minutes']),
  (v_day,2,'strength','Katalyst EMS',20,'Full body electrical muscle stimulation suit activating up to 90% of muscle fibers simultaneously.','Katalyst EMS recruits muscle fibers that conventional exercise cannot reach. One 20-minute Katalyst session produces the muscle stimulus of a 90-minute conventional workout.',
   ARRAY['Put on the EMS suit with coaching assistance','Start at a comfortable intensity level','Perform slow, controlled movements throughout','The sensation is intense but should not be painful — communicate with staff','Slow movements amplify the electrical stimulus — do not rush','You will feel this for 2-3 days — that is normal and indicates deep muscle recruitment']),
  (v_day,3,'cardio','CAROL REHIT',8,'Two final 20-second maximum sprint intervals to close out your training week.','Finishing your training week with REHIT sprints creates a metabolic effect that persists through the weekend — elevated metabolism, increased fat oxidation, and continued cardiovascular adaptation even on your rest days.',
   ARRAY['Warm up 2 minutes','Sprint 1 — absolute maximum effort for 20 seconds','Recover 2 minutes','Sprint 2 — everything left in the tank','Cool down 3 minutes','You have completed your training week — well done']);

  -- SATURDAY
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_lp,6,'Saturday','Active Recovery','Saturday is your second aerobic and recovery day — bookending your training week with restoration. This combination of sauna, cold, and Zone 2 movement maximizes the adaptations from Monday through Friday while preparing your body for the week ahead.')
  RETURNING id INTO v_day;

  INSERT INTO protocol_day_activities (protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,description,why_it_matters,steps,is_optional,alternative_activity) VALUES
  (v_day,1,'recovery','Infrared Sauna',20,'Start Saturday with infrared sauna.','Weekend sauna sessions compound the benefits of weekday use. The research on sauna frequency shows a dose-response relationship — more sessions per week produce proportionally greater cardiovascular and longevity benefits.',
   ARRAY['Enter at 150°F','Use this time to reflect on your week','No performance pressure — pure restoration','Breathe deeply and let your nervous system downregulate'],
  false,null),
  (v_day,2,'recovery','Cold Plunge',3,'Contrast therapy — cold after sauna.','Weekend contrast therapy helps clear metabolic waste from the week''s training, reduces systemic inflammation, and sets up your body for optimal adaptation over the next 48 hours.',
   ARRAY['Move from sauna directly to cold plunge','This should be feeling more manageable each week','3 full minutes','Exit feeling refreshed'],
  false,null),
  (v_day,3,'cardio','CAROL Zone 2 Free Ride',45,'Easy aerobic ride to close your week.','Saturday Zone 2 training adds aerobic volume without adding recovery burden — it actually accelerates recovery while building your aerobic base. This is the session most members underestimate and most benefit from.',
   ARRAY['Easy conversational pace throughout','No intensity today — save that for Monday','Use the time to decompress from the week','End feeling better than when you started'],
  true,'Outdoor walk — 45 minutes at easy pace');

  -- SUNDAY
  INSERT INTO protocol_days (protocol_id,day_of_week,day_name,day_theme,day_description) VALUES
  (v_lp,7,'Sunday','Rest Day','Rest is not optional — it is where your results are made. Every adaptation from this week''s training happens during rest. Protect your sleep tonight, eat well, hydrate, and arrive Monday ready to push harder than last week.');

  RAISE NOTICE 'Longevity Protocol days seeded successfully.';
END $seed$;
