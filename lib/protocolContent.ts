// ─── Types ────────────────────────────────────────────────────────────────────

export type ProtocolTier =
  | "longevity"
  | "bone_density"
  | "body_composition"
  | "athletic_performance"
  | "healthspan_elite";

export type HealthCondition =
  | "menopause"
  | "osteoporosis"
  | "diabetes"
  | "hypertension"
  | "low_back_pain"
  | "joint_issues";

export type ColdPlungePosition =
  | "RECOMMENDED"
  | "OPTIONAL_CONTRAST"
  | "OPTIONAL_CARDIO"
  | "NEVER";

export type ContrastTherapyPreference =
  | "yes"
  | "cold_before_only"
  | "no_preference";

export type EquipmentKey =
  | "arx"
  | "carol"
  | "cold_plunge"
  | "infrared_sauna"
  | "katalyst"
  | "vasper"
  | "proteus"
  | "nxpro"
  | "compression"
  | "mobility"
  | "zone2";

export type WhyItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
  showIf?: HealthCondition[];
  showIfInjury?: true;
};

// ─── Why this plan ────────────────────────────────────────────────────────────

export const WHY_ITEMS: Record<ProtocolTier, WhyItem[]> = {
  longevity: [
    {
      id: "muscle_preservation",
      icon: "💪",
      title: "Strength that lasts",
      body: "ARX adaptive resistance matches your exact strength curve on every rep. One set to failure produces the same muscle stimulus as a full conventional workout — without the joint wear. You build muscle while protecting your body.",
    },
    {
      id: "cardio_efficiency",
      icon: "❤️",
      title: "Cardio in 8 minutes",
      body: "CAROL REHIT uses two 20-second sprints to trigger the same cardiovascular adaptation as 45 minutes of jogging. Your heart, lungs, and mitochondria all improve — without the time or the wear on your joints.",
    },
    {
      id: "recovery_integration",
      icon: "🔄",
      title: "Recovery is training",
      body: "Sauna, cold exposure, and red light therapy are not extras — they are part of the plan. They reduce inflammation, accelerate repair, and keep your nervous system balanced so every session is productive.",
    },
    {
      id: "menopause_strength",
      icon: "🌿",
      title: "Built for hormonal change",
      body: "After menopause, muscle loss accelerates and bone density drops faster than most people realize. This protocol prioritizes exactly the two stimuli — progressive resistance and impact loading — that have the strongest evidence for reversing both.",
      showIf: ["menopause"],
    },
    {
      id: "injury_katalyst",
      icon: "🛡️",
      title: "Strength without joint load",
      body: "Katalyst EMS activates up to 90% of your muscle fibers simultaneously without axial loading or joint compression. For members with injuries or structural limitations, it provides a full-body strength stimulus when conventional training would aggravate pain.",
      showIfInjury: true,
    },
  ],
  bone_density: [
    {
      id: "axial_loading",
      icon: "🦴",
      title: "Bone responds to load",
      body: "Bone density increases when bones are exposed to progressive axial loading. ARX provides controlled, scalable resistance that stimulates bone remodeling without the fracture risk of free weights or impact sports.",
    },
    {
      id: "impact_stimulus",
      icon: "⚡",
      title: "Targeted impact sessions",
      body: "Weight-bearing Zone 2 and Proteus 3D work specifically add the mechanical stimulus that triggers osteoblast activity — the cells that build new bone. These sessions are timed to your recovery windows so they compound rather than compete.",
    },
    {
      id: "hormonal_response",
      icon: "🔬",
      title: "The hormonal connection",
      body: "Strength training triggers growth hormone and IGF-1 release, both of which directly stimulate bone formation. Your protocol is sequenced to maximize this hormonal window on training days.",
    },
    {
      id: "menopause_bone",
      icon: "🌿",
      title: "Estrogen, bone, and timing",
      body: "Estrogen is the primary brake on bone resorption. After menopause, that brake releases. The bone density protocol front-loads resistance and impact stimulus specifically to offset this loss during the window when it matters most.",
      showIf: ["menopause", "osteoporosis"],
    },
  ],
  body_composition: [
    {
      id: "metabolic_demand",
      icon: "🔥",
      title: "Muscle drives metabolism",
      body: "Every pound of muscle burns 3× more calories at rest than fat tissue. This protocol prioritizes ARX volume to build lean mass first — because the metabolic benefit compounds over time in a way that cardio alone never can.",
    },
    {
      id: "fat_oxidation",
      icon: "💨",
      title: "CAROL targets fat directly",
      body: "CAROL Fat Burn sessions run at the precise intensity where your body oxidizes fat most efficiently. Combined with REHIT sprints that deplete glycogen, your sessions create a sustained fat-burning window that extends hours after you leave.",
    },
    {
      id: "arx_volume",
      icon: "📈",
      title: "Volume with precision",
      body: "Higher ARX frequency means more total muscle stimulus per week. Splitting upper and lower days distributes recovery load so each session is maximally productive — you accumulate more volume without the overtraining that traditional programs cause.",
    },
    {
      id: "sauna_fat",
      icon: "🌡️",
      title: "Sauna amplifies results",
      body: "Post-training sauna exposure extends the hormonal response from your session — growth hormone can remain elevated for up to 3 hours. This amplifies the lean mass and fat loss signals that your strength training already created.",
    },
  ],
  athletic_performance: [
    {
      id: "cns_priming",
      icon: "⚡",
      title: "Cold before strength",
      body: "Cold plunge before ARX activates your nervous system, increases alertness, and raises core muscle temperature. Research shows cold exposure before resistance training improves peak power output by measurably activating the sympathetic nervous system.",
    },
    {
      id: "power_output",
      icon: "💥",
      title: "Max effort produces max adaptation",
      body: "ARX adaptive resistance means every rep is a true max effort — the machine matches exactly what you can produce at every point in the range of motion. This is the only way to train at 100% output consistently without a spotter or injury risk.",
    },
    {
      id: "speed_strength_combo",
      icon: "🏃",
      title: "Speed and strength together",
      body: "Vasper combines resistance with cooling to extend the quality of high-output intervals. Pairing it with CAROL REHIT trains both phosphocreatine (sprint power) and aerobic capacity — the two systems that determine athletic ceiling.",
    },
    {
      id: "recovery_window",
      icon: "🔄",
      title: "Recovery determines ceiling",
      body: "The gap between sessions is where adaptation happens. Zone 2, mobility, and structured recovery modalities are programmed specifically to clear lactate, restore nervous system readiness, and make the next loading session more productive.",
    },
    {
      id: "injury_load",
      icon: "🛡️",
      title: "Performance without breakdown",
      body: "Katalyst EMS and Vasper provide high-intensity stimulus with minimal mechanical stress on joints and connective tissue. For athletes managing previous injuries, these tools allow full training load without re-aggravating structural issues.",
      showIfInjury: true,
    },
  ],
  healthspan_elite: [
    {
      id: "full_system",
      icon: "🔬",
      title: "Every system, every week",
      body: "Healthspan Elite is built for members who want to move every marker — not just strength or just cardio, but muscle, cardiovascular fitness, metabolic health, structural integrity, and nervous system recovery all in a single week. It requires commitment because it delivers comprehensive results.",
    },
    {
      id: "nxpro_nervous",
      icon: "💜",
      title: "NxPro and the nervous system",
      body: "Red light and near-infrared therapy at the NxPro station drives mitochondrial ATP production in both muscle and neural tissue. At high training frequencies, this directly combats neural fatigue and maintains the quality of your strength sessions across the week.",
    },
    {
      id: "katalyst_elite",
      icon: "⚡",
      title: "Katalyst at this frequency",
      body: "At 5–6 sessions per week, Katalyst EMS becomes a precision recovery and activation tool — not just a training session. On high-volume weeks, it maintains neuromuscular activation without additional mechanical stress, keeping your movement quality high.",
    },
    {
      id: "frequency_rationale",
      icon: "📅",
      title: "Why 3–6 days matters",
      body: "Below 3 sessions per week, the stimulus isn't frequent enough to drive continuous adaptation at this intensity. Above 6, recovery becomes the limiting factor. The 3–6 range is where elite-level consistency compounds without accumulating systemic fatigue.",
    },
    {
      id: "menopause_elite",
      icon: "🌿",
      title: "Hormonal optimization at this level",
      body: "The combination of ARX, Katalyst, cold exposure, and sauna in this protocol creates a hormonal environment that directly counteracts the decline in estrogen, progesterone, and growth hormone that drives aging in women. This is not incidental — it is central to the protocol design.",
      showIf: ["menopause"],
    },
  ],
};

// ─── Session rationale ────────────────────────────────────────────────────────

export const SESSION_RATIONALE: Record<ProtocolTier, Record<string, string>> = {
  longevity: {
    "Strength + Cardio": "Today is the foundation of your week. ARX primes your hormonal environment for recovery, and CAROL delivers cardiovascular stimulus in under 10 minutes. Cold before lifting activates your nervous system for peak output.",
    "Active Recovery": "Your muscles built nothing during yesterday's session — they build during today's recovery. Zone 2 keeps blood moving through muscle tissue while sauna extends the growth hormone window from yesterday.",
    "Mobility + Recovery": "Mobility and nervous system work mid-week reset your structural readiness for the second loading day. NxPro drives mitochondrial recovery at the cellular level.",
    "Zone 2 Cardio": "Zone 2 at this intensity builds aerobic base without adding recovery debt. It works the fat oxidation pathway, improves mitochondrial density, and sets you up for the following week's loading sessions.",
    "Optional Add-Ons": "These sessions are enhancements — not requirements. Katalyst, Vasper, and Proteus add volume and stimulus without the recovery cost of another full training day.",
    "Rest": "Rest is not doing nothing. It is the session where your body actually builds the adaptations triggered by this week's work. Protect it.",
  },
  bone_density: {
    "ARX Loading": "Heavy axial load through the spine and long bones is the strongest known stimulus for osteoblast activity — the cells that build new bone. This is the primary session of the week.",
    "Impact + Vibration": "Weight-bearing movement and 3D resistance add the mechanical signals that ARX alone cannot replicate. Proteus 3D trains rotational load, which specifically strengthens the vertebral attachments most vulnerable to osteoporotic fracture.",
    "Rest": "Bone remodeling is a slow process. Recovery days are when the mineral deposition triggered by loading actually occurs.",
  },
  body_composition: {
    "Strength — Upper": "Upper body ARX volume drives protein synthesis in the highest-metabolic muscle groups: back, chest, and shoulders. The REHIT after creates an EPOC window that extends caloric burn for hours.",
    "Cardio + Fat Burn": "CAROL Fat Burn runs at the precise watt output where your body's primary fuel is fat — not glycogen. The extended Zone 2 after keeps you in that oxidative window.",
    "Strength — Lower": "Lower body ARX activates the largest muscle groups in the body, producing the strongest hormonal response of any session this week. Leg press alone drives more systemic adaptation than most full-body workouts.",
    "Active Recovery": "Sauna after a loading day extends the growth hormone response and clears inflammatory markers. Cold after sauna adds a contrast stimulus that accelerates circulatory recovery.",
    "Strength + CAROL": "The week closes with a full-body compound session. Completing the week at high output creates a cumulative hormonal signal that drives the body toward lean mass retention through the weekend.",
    "Optional Training": "Additional volume for members who want to accelerate results. These sessions add output without overlapping the primary recovery windows.",
    "Rest": "Let the work you did this week produce results.",
  },
  athletic_performance: {
    "Power Day": "The primary strength session of the week. Cold exposure before maximizes nervous system readiness. Max-effort ARX at full output sets the adaptation target for the rest of the week.",
    "Speed + Cardio": "CAROL sprints and Vasper intervals train the two energy systems that determine athletic output. Vasper's cooling effect extends the quality of high-intensity intervals.",
    "Active Recovery": "Mobility and Zone 2 between loading days maintains movement quality and aerobic baseline without adding recovery debt to the system.",
    "Strength — Lower": "Lower body focus mid-week. Legs recover faster than upper body and can handle a second loading stimulus by Thursday.",
    "Rest / Mobility": "A buffer before the optional Saturday session. Light movement maintains readiness without adding load.",
    "Optional Power": "For athletes training at higher frequency. These sessions add volume to the week without displacing the primary recovery structure.",
    "Rest": "The full system resets.",
  },
  healthspan_elite: {
    "Full System Day": "The most complete session of the week. Cold primes the CNS, ARX delivers the primary strength stimulus, CAROL hits the cardiovascular system, Katalyst adds neuromuscular activation, and NxPro closes with cellular recovery. Everything fires.",
    "Cardio + Zone 2": "Vasper's thermoregulatory load combined with extended Zone 2 trains the aerobic system without adding mechanical stress from a second strength day. Sauna and cold contrast after amplify the recovery signal.",
    "Strength + 3D": "Second ARX session mid-week. Proteus 3D adds rotational and anti-rotational strength that standard resistance training misses. NxPro after maintains neural readiness for Friday.",
    "Mobility + Recovery": "At this training frequency, Thursday is a non-negotiable recovery session. Sauna, cold, and mobility work here directly determine the quality of Friday's full-system day.",
    "Optional Elite Session": "For members training 6 days. Vasper, Zone 2, and NxPro add elite-level volume without exceeding the recovery envelope.",
    "Rest": "Non-negotiable at this training volume. The entire system — muscular, cardiovascular, neural — requires 24 hours of full rest to integrate a week at this intensity.",
  },
};

// ─── Equipment notes ──────────────────────────────────────────────────────────

export const EQUIPMENT_NOTES: Record<EquipmentKey, string> = {
  arx: "Adaptive resistance matches your exact strength at every point in the range of motion. One set to failure produces the same stimulus as a conventional full workout.",
  carol: "Two 20-second maximal sprints trigger the same cardiovascular adaptations as 45 minutes of jogging. Your heart and mitochondria adapt — not your schedule.",
  cold_plunge: "Cold exposure activates the sympathetic nervous system, reduces inflammation, and extends recovery between sessions. Timing relative to your other sessions matters.",
  infrared_sauna: "Infrared penetrates deeper than conventional sauna, raising core temperature and triggering growth hormone release. Most effective in the 20–30 minute window post-training.",
  katalyst: "EMS activates up to 90% of muscle fibers simultaneously without joint compression. Pairs with ARX for max activation or replaces it when joint load needs to stay low.",
  vasper: "Combines resistance intervals with cooling cuffs to extend the quality of high-intensity work. Trains both power output and aerobic capacity without mechanical joint load.",
  proteus: "3D adaptive resistance trains rotational and multi-planar movement — the planes that conventional equipment misses. Especially effective for core, spine, and functional strength.",
  nxpro: "Red light and near-infrared therapy drives mitochondrial ATP production in muscle and neural tissue. Reduces recovery time between high-frequency sessions.",
  compression: "Pneumatic compression accelerates lymphatic drainage and venous return after high-output sessions. Most effective immediately post-training.",
  mobility: "Structured range-of-motion work maintains joint health, reduces injury risk, and improves the quality of loading sessions by ensuring full range access.",
  zone2: "Low-intensity aerobic work at the fat-oxidation threshold. Builds mitochondrial density, improves aerobic base, and adds training volume without adding recovery debt.",
};

// ─── Cold plunge banner rules ─────────────────────────────────────────────────

export const COLD_PLUNGE_RULES: Record<ColdPlungePosition, string> = {
  RECOMMENDED: "Cold plunge before this session primes your nervous system and improves focus and power output. Do it within 5 minutes of starting your first exercise.",
  OPTIONAL_CONTRAST: "Contrast therapy after sauna is optional today — alternating heat and cold enhances circulation and accelerates recovery. Only add it if your body feels ready.",
  OPTIONAL_CARDIO: "Cold plunge before cardio is optional — it can improve aerobic output if you respond well to cold exposure. Skip it if you feel flat or underrecovered.",
  NEVER: "Do not cold plunge after ARX or Katalyst today. Cold immediately after strength training blunts the muscle-building signal your body just created. Save cold exposure for the following morning.",
};

// ─── Goal line helpers ────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  gain_muscle: "build muscle",
  lose_fat: "lose body fat",
  improve_cardio: "improve cardiovascular fitness",
  attendance: "train consistently",
};

export function deriveGoalLine(activeGoals: string[]): string {
  if (!activeGoals.length) return "";
  const labels = activeGoals
    .map((g) => GOAL_LABELS[g] ?? g.replace(/_/g, " "))
    .filter(Boolean);
  if (labels.length === 1) return `Goal: ${labels[0]}.`;
  const last = labels[labels.length - 1];
  const rest = labels.slice(0, -1).join(", ");
  return `Goals: ${rest} and ${last}.`;
}

// ─── Tier display ─────────────────────────────────────────────────────────────

export const TIER_DISPLAY: Record<ProtocolTier, string> = {
  longevity: "Longevity",
  bone_density: "Bone Density",
  body_composition: "Body Composition",
  athletic_performance: "Athletic Performance",
  healthspan_elite: "Healthspan Elite",
};
