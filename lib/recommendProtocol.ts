export type ProtocolTier =
  | "longevity"
  | "bone_density"
  | "body_composition"
  | "athletic_performance"
  | "healthspan_elite";

export type HealthCondition = "osteoporosis" | "menopause" | "cardiovascular" | "t2d";

export type MemberProfile = {
  primaryGoal: ProtocolTier | null;
  healthConditions: HealthCondition[];
  injuryNotes: string;
  daysAvailable: number;
};

export type ProtocolRecommendation = {
  tier: ProtocolTier;
  frequency: number;
  reasons: string[];
};

const TIER_LABELS: Record<ProtocolTier, string> = {
  longevity: "Longevity",
  bone_density: "Bone Density",
  body_composition: "Body Composition",
  athletic_performance: "Athletic Performance",
  healthspan_elite: "Healthspan Elite",
};

export function tierLabel(tier: ProtocolTier): string {
  return TIER_LABELS[tier];
}

const GOAL_TO_TIER: Record<string, ProtocolTier> = {
  longevity: "longevity",
  bone_density: "bone_density",
  body_composition: "body_composition",
  athletic_performance: "athletic_performance",
  healthspan_elite: "healthspan_elite",
};

export function recommendProtocol(profile: MemberProfile): ProtocolRecommendation {
  const reasons: string[] = [];
  let tier: ProtocolTier;
  let frequency = Math.max(1, Math.min(6, profile.daysAvailable || 3));

  // Rule 1 — osteoporosis overrides everything regardless of stated goal
  if (profile.healthConditions.includes("osteoporosis")) {
    tier = "bone_density";
    reasons.push(
      "Bone Density protocol selected because osteoporosis is listed as a health condition. This takes priority over the stated goal.",
    );
  }
  // Rule 2 — healthspan_elite primary goal
  else if (profile.primaryGoal === "healthspan_elite") {
    tier = "healthspan_elite";
    reasons.push("Healthspan Elite selected — this is the member's stated primary goal.");
  }
  // Rule 3 — direct goal → tier map
  else {
    tier = (profile.primaryGoal && GOAL_TO_TIER[profile.primaryGoal]) ?? "longevity";
    const goalDisplay = profile.primaryGoal
      ? profile.primaryGoal.replace(/_/g, " ")
      : "no goal specified";
    reasons.push(
      `${tierLabel(tier)} protocol matches the member's primary goal (${goalDisplay}).`,
    );
  }

  // Rule 4 — injury cap: if there are injury notes and days > 3, cap at 3
  if (profile.injuryNotes.trim() && frequency > 3) {
    frequency = 3;
    reasons.push(
      "Capped at 3 days due to injury notes — review with member before increasing frequency.",
    );
  }

  // Rule 5 — Healthspan Elite minimum 3 days
  if (tier === "healthspan_elite" && frequency < 3) {
    frequency = 3;
    reasons.push(
      "Healthspan Elite requires a minimum of 3 days per week — discuss with member if their schedule is a constraint.",
    );
  }

  return { tier, frequency, reasons };
}
