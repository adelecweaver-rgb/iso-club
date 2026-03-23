/**
 * Shared onboarding types, diff logic, and protocol recommendation.
 * Imported by both member-facing and coach-facing code.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingAnswers = {
  goals: string[];
  // member_goals.goal_type values: 'gain_muscle' | 'lose_fat' | 'improve_cardio' | 'attendance'
  health_limitations: string[];
  // 'lower_back' | 'knees' | 'hips' | 'neck' | 'pelvic_floor' | 'osteoporosis' | 'none' | 'other'
  notes: string | null;
  days_available_per_week: number | null;
  contrast_therapy_pref: string | null;
  // 'yes' | 'cold_plunge_only' | 'no_preference'
  motivation_style: string | null;
  // 'performance' | 'longevity' | 'weight_loss' | 'general_health'
};

export type OnboardingSnapshot = {
  id: string;
  member_id: string;
  saved_at: string;
  review_requested: boolean;
  answers: OnboardingAnswers;
};

export type FieldDiff = {
  field: keyof OnboardingAnswers;
  label: string;
  oldValue: string;
  newValue: string;
};

export type ProtocolRecommendation = {
  name: string | null;
  reason: string | null;
};

// ─── Display labels ───────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<keyof OnboardingAnswers, string> = {
  goals:                   "Goals",
  health_limitations:      "Health conditions",
  notes:                   "Injury / joint notes",
  days_available_per_week: "Days available per week",
  contrast_therapy_pref:   "Contrast therapy preference",
  motivation_style:        "Motivation style",
};

export const GOAL_LABELS: Record<string, string> = {
  gain_muscle:    "Gain muscle",
  lose_fat:       "Lose fat",
  improve_cardio: "Improve cardio",
  attendance:     "Consistency & attendance",
};

export const LIMITATION_LABELS: Record<string, string> = {
  lower_back:   "Lower back",
  knees:        "Knees",
  hips:         "Hips",
  neck:         "Neck",
  pelvic_floor: "Pelvic floor",
  osteoporosis: "Osteoporosis",
  none:         "None",
  other:        "Other",
};

export const CONTRAST_LABELS: Record<string, string> = {
  yes:              "Yes — both sauna and cold plunge",
  cold_plunge_only: "Cold plunge only",
  no_preference:    "No preference",
};

export const MOTIVATION_LABELS: Record<string, string> = {
  performance:    "Performance — I want measurable results",
  longevity:      "Longevity — I want to feel good long-term",
  weight_loss:    "Weight loss — body composition is my focus",
  general_health: "General health — I want to feel better overall",
};

// ─── Diff ─────────────────────────────────────────────────────────────────────

function displayValue(field: keyof OnboardingAnswers, raw: OnboardingAnswers[keyof OnboardingAnswers]): string {
  if (raw === null || raw === undefined) return "—";
  if (Array.isArray(raw)) {
    if (raw.length === 0) return "—";
    if (field === "goals") return raw.map((g) => GOAL_LABELS[g] ?? g).join(", ");
    if (field === "health_limitations") return raw.map((l) => LIMITATION_LABELS[l] ?? l).join(", ");
    return raw.join(", ");
  }
  if (field === "contrast_therapy_pref") return CONTRAST_LABELS[raw as string] ?? String(raw);
  if (field === "motivation_style")      return MOTIVATION_LABELS[raw as string] ?? String(raw);
  return String(raw);
}

function sortedKey(field: keyof OnboardingAnswers, val: OnboardingAnswers[keyof OnboardingAnswers]): string {
  if (Array.isArray(val)) return [...val].sort().join(",");
  return String(val ?? "");
}

export function computeOnboardingDiff(
  prev: OnboardingAnswers,
  next: OnboardingAnswers,
): FieldDiff[] {
  return (Object.keys(FIELD_LABELS) as Array<keyof OnboardingAnswers>)
    .map((key) => {
      const oldSorted = sortedKey(key, prev[key]);
      const newSorted = sortedKey(key, next[key]);
      if (oldSorted === newSorted) return null;
      return {
        field: key,
        label: FIELD_LABELS[key],
        oldValue: displayValue(key, prev[key]),
        newValue: displayValue(key, next[key]),
      };
    })
    .filter((d): d is FieldDiff => d !== null);
}

// ─── Protocol recommendation ──────────────────────────────────────────────────

const PROTOCOL_REASONS: Record<string, string> = {
  "Longevity Protocol":  "Covers muscle growth, fat loss, cardio fitness, and recovery — the complete multi-system approach.",
  "Metabolic Reset":     "Combines ARX strength training with fat-burning CAROL sessions to shift body composition.",
  "Cardio Focus":        "Prioritizes CAROL REHIT and extended sessions to build aerobic capacity and raise VO2 max.",
  "Strength Foundation": "Builds foundational muscle strength with targeted ARX sessions and progressive overload.",
};

export function recommendProtocol(activeGoals: string[]): ProtocolRecommendation {
  const g = new Set(activeGoals);
  if (g.size === 0) return { name: null, reason: null };

  let name: string;
  if ((g.has("gain_muscle") && g.has("lose_fat") && g.has("improve_cardio")) || g.size >= 4) {
    name = "Longevity Protocol";
  } else if (g.has("gain_muscle") && g.has("improve_cardio")) {
    name = "Longevity Protocol";
  } else if (g.has("gain_muscle") && g.has("lose_fat")) {
    name = "Metabolic Reset";
  } else if (g.has("lose_fat")) {
    name = "Metabolic Reset";
  } else if (g.has("improve_cardio")) {
    name = "Cardio Focus";
  } else {
    name = "Strength Foundation";
  }

  return { name, reason: PROTOCOL_REASONS[name] ?? null };
}

// ─── Empty answers factory ────────────────────────────────────────────────────

export function emptyAnswers(): OnboardingAnswers {
  return {
    goals: [],
    health_limitations: [],
    notes: null,
    days_available_per_week: null,
    contrast_therapy_pref: null,
    motivation_style: null,
  };
}
