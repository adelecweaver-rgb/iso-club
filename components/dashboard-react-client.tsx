"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WHY_ITEMS,
  SESSION_RATIONALE,
  EQUIPMENT_NOTES,
  COLD_PLUNGE_RULES,
  TIER_DISPLAY,
  deriveGoalLine,
  type ProtocolTier,
  type EquipmentKey,
  type ColdPlungePosition,
} from "@/lib/protocolContent";
import { recommendProtocol as recommendProtocolLib } from "@/lib/onboarding";

type MemberSection =
  | "dashboard"
  | "progress"
  | "protocol"
  | "recovery"
  | "wearables"
  | "messages"
  | "reports"
  | "schedule"
  | "goals";

type CoachSection = "morning" | "members" | "messages" | "log" | "protocols";
type ActorRole = "member" | "coach" | "admin" | "staff" | "unknown";

type CarolSession = {
  sessionDate: string;
  rideType: string;
  peakPowerWatts: string;
  manp: string;
  avgSprintPower: string;
  caloriesInclEpoc: string;
  heartRateMax: string;
  sequentialNumber: string;
};

type DashboardPayload = {
  role: "member" | "coach";
  memberId: string | null;
  coachId: string | null;
  displayName: string;
  initials: string;
  tier: string;
  metrics: {
    carolFitness: string;
    arxOutput: string;
    leanMass: string;
    whoopRecovery: string;
  };
  healthspan: {
    muscle: string;
    cardio: string;
    metabolic: string;
    structural: string;
    recovery: string;
  };
  carolHistory: Array<{ label: string; value: string }>;
  carolSessions: CarolSession[];
  arxHistory: Array<{ label: string; value: string }>;
  vitalityAge: {
    estimated: number | null;
    chronological: number | null;
    difference: number | null;
    trend: number | null;
    hasEnoughData: boolean;
  };
  wins: Array<{ label: string; isMilestone: boolean; icon: string }>;
  goalDetails: {
    gain_muscle: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
    lose_fat: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
    improve_cardio: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
    attendance: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
  };
  sessionNote: { text: string; date: string; coachName: string } | null;
  coachAtRisk: Array<{ id: string; name: string; reasons: string[]; recovery: string }>;
  memberSince: string;
  bonusActivitiesThisWeek: number;
  todaysPlan: {
    hasProtocol: boolean;
    protocolName: string;
    dayName: string;
    dayTheme: string;
    dayDescription: string;
    isRestDay: boolean;
    activities: Array<{
      id: string; order: number; type: string; name: string; durationMinutes: number;
      description: string; whyItMatters: string; steps: string[];
      isBookable: boolean; bookingUrl: string | null;
      isOptional: boolean; alternativeActivity: string | null;
    }>;
    totalMinutes: number;
    sessionsThisWeek: number;
  } | null;
  longestStreakWeeks: number;
  milestones: Array<{ dateLabel: string; icon: string; label: string }>;
  arxSessions: Array<{
    sessionDate: string;
    exercise: string;
    output: number | null;
    concentricMax: number | null;
    eccentricMax: number | null;
  }>;
  scan: {
    scanDate: string;
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
    fatMassLbs: string;
    bodyShapeRating: string;
    waistIn: string;
    hipsIn: string;
    headForwardIn: string;
    shoulderForwardIn: string;
    hipForwardIn: string;
  };
  scanHistory: Array<{
    scanDate: string;
    scanDateRaw: string;
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
    fatMassLbs: string;
    bodyShapeRating: string;
    waistIn: string;
    hipsIn: string;
    bodyFatPctRaw: number | null;
    weightLbsRaw: number | null;
    leanMassLbsRaw: number | null;
    fatMassLbsRaw: number | null;
    bodyShapeRatingRaw: number | null;
    waistInRaw: number | null;
    hipsInRaw: number | null;
  }>;
  recoveryCounts: {
    infraredSauna: string;
    coldPlunge: string;
    nxpro: string;
    compression: string;
    vasper: string;
    katalyst: string;
    proteus: string;
    quickboard: string;
  };
  wearables: {
    whoopRecovery: string;
    ouraReadiness: string;
    hrvMs: string;
    sleepHours: string;
  };
  protocol: {
    name: string;
    weekCurrent: string;
    weekTotal: string;
    sessions: Array<{ name: string; detail: string; duration: string; status: string }>;
    id: string;
    targetSystem: string;
    tier: string;
    description: string;
    scienceRationale: string;
    daysPerWeek: number | null;
    arxPerWeek: number;
    carolPerWeek: number;
    recoveryPerMonth: number;
    carolRideTypes: string[];
    arxExercises: string[];
    coachNotes: string;
    customizationNotes: string;
    startDate: string;
    compliance: { arxThisWeek: number; carolThisWeek: number; recoveryThisMonth: number };
    days: Array<{
      id: string;
      dayOfWeek: number;
      dayName: string;
      dayTheme: string;
      activities: Array<{
        id: string;
        order: number;
        type: string;
        name: string;
        durationMinutes: number;
        isOptional: boolean;
        coldPlunge: string | null;
      }>;
    }>;
  };
  contrastTherapyPreference: string;
  bookings: Array<{ label: string; status: string; scheduledAt?: string | null }>;
  reports: Array<{ title: string }>;
  goals: {
    activeGoals: string[];
    progress: {
      gain_muscle: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current?: number; target?: number };
      lose_fat: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current?: number; target?: number };
      improve_cardio: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current?: number; target?: number };
      attendance: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current: number; target: number };
    };
  };
  checklistCompletions: {
    arxWeekDates: string[];
    carolWeekTypes: string[];
    recoveryWeekModalities: string[];
    arxTodayLogged: boolean;
    carolTodayTypes: string[];
    recoveryTodayModalities: string[];
    todayDate: string;
    weekStartDate: string;
  };
  coach: {
    todayCount: string;
    lowRecoveryCount: string;
    readyCount: string;
    alerts: string[];
    members: Array<{
      id: string;
      name: string;
      initials: string;
      tier: string;
      phoneMissing: boolean;
      recovery: string;
      muscle: string;
      session: string;
      member_status?: string;
      review_requested_at?: string | null;
    }>;
  };
};

type MessageItem = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  thread_id: string;
  read_at: string | null;
};

type InboxPeer = {
  id: string;
  full_name: string;
  role?: string;
  unread_count?: number;
  latest_at?: string;
  latest_preview?: string;
};

function firstNameFromName(name: string): string {
  const first = String(name || "").trim().split(" ")[0];
  return first || "Member";
}

function displayNameFromClerk(
  user: ReturnType<typeof useUser>["user"],
  fallback: string,
): string {
  if (!user) return fallback;
  const first = (user.firstName ?? "").trim();
  const last = (user.lastName ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.username?.trim()) return user.username.trim();
  return fallback;
}

function initialsFromName(name: string): string {
  const parts = String(name || "")
    .split(" ")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!parts.length) return "MB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeCarolTabKey(rideType: string): "rehit" | "fat_burn" | "free_custom" | "fitness_tests" {
  const value = String(rideType || "").trim().toLowerCase();
  if (value.includes("fat")) return "fat_burn";
  if (value.includes("free") || value.includes("custom")) return "free_custom";
  if (value.includes("test")) return "fitness_tests";
  return "rehit";
}

type ScanChange = { pct: number; display: string; direction: "up" | "down" } | null;

function scanPctChange(current: number | null, previous: number | null): ScanChange {
  if (current === null || previous === null || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct, display: `${Math.abs(pct).toFixed(1)}%`, direction: pct >= 0 ? "up" : "down" };
}

function scanChangeColor(change: ScanChange, goodDirection: "up" | "down" | "neutral"): string {
  if (!change || goodDirection === "neutral") return "var(--text3)";
  return change.direction === goodDirection ? "#4A7C59" : "#B84040";
}

type ScanItem = DashboardPayload["scanHistory"][number];

function bsrCategory(bsr: number | null): string {
  if (bsr === null) return "";
  if (bsr >= 80) return "excellent";
  if (bsr >= 60) return "healthy";
  if (bsr >= 40) return "needs improvement";
  return "high risk";
}

function scanInsight(current: ScanItem | undefined, previous: ScanItem | undefined): string {
  if (!current || !previous) {
    return "This is your baseline. Complete your next scan in 60–90 days to start tracking progress.";
  }
  const leanUp = (current.leanMassLbsRaw ?? 0) > (previous.leanMassLbsRaw ?? 0);
  const leanDown = (current.leanMassLbsRaw ?? 0) < (previous.leanMassLbsRaw ?? 0);
  const fatUp = (current.fatMassLbsRaw ?? 0) > (previous.fatMassLbsRaw ?? 0);
  const fatDown = (current.fatMassLbsRaw ?? 0) < (previous.fatMassLbsRaw ?? 0);
  const bsrUp = (current.bodyShapeRatingRaw ?? 0) > (previous.bodyShapeRatingRaw ?? 0);
  const bsr = current.bodyShapeRatingRaw;
  const bsrCat = bsrCategory(bsr);

  if (leanUp && fatDown) return "Great progress. You're building muscle and losing fat simultaneously — the ideal outcome.";
  if (leanUp && fatUp) return "You gained muscle and fat. Your training is working. Focus on nutrition timing — protein within 30 minutes post-workout and reduce processed carbs.";
  if (leanDown && fatUp) return "Body composition moved in the wrong direction this period. Let's review training frequency and nutrition together.";
  if (!leanDown && !leanUp && fatDown) return "You're losing fat while preserving muscle. Keep your protein intake high.";
  if (leanDown && fatDown) {
    const bsrNote = bsrUp && bsr !== null
      ? ` Your Body Shape Rating also improved to ${bsr.toFixed(0)}${bsrCat ? ` (${bsrCat} range)` : ""} — that reflects better fat distribution and lower cardiovascular risk, which is a meaningful health marker.`
      : "";
    return `Your body fat is down and the overall direction is positive.${bsrNote} The priority now is protecting and growing lean muscle — focused, consistent ARX sessions combined with hitting your daily protein target are the key levers here. Small improvements in lean mass each scan period compound significantly over time.`;
  }
  return "Your body composition is stable. Let's discuss your next goals.";
}

function sparklinePath(values: (number | null)[], w: number, h: number): string {
  const pts = values
    .map((v, i) => (v !== null ? { x: i, y: v } : null))
    .filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length < 2) return "";
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const rangeY = maxY - minY || 1;
  const maxX = values.length - 1 || 1;
  return pts
    .map((p, i) => {
      const sx = (p.x / maxX) * w;
      const sy = h - 2 - ((p.y - minY) / rangeY) * (h - 4);
      return `${i === 0 ? "M" : "L"} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
    })
    .join(" ");
}

// ── Trend sentiment system ────────────────────────────────────────────────────
type TrendSentiment = "positive" | "negative" | "neutral";
type TrendData = { direction: "up" | "down" | "none"; sentiment: TrendSentiment };

function sentimentColor(sentiment: TrendSentiment): string {
  if (sentiment === "positive") return "var(--teal, #4A7C59)";
  if (sentiment === "negative") return "var(--red, #B84040)";
  return "var(--text3)";
}

function trendArrow(direction: "up" | "down" | "none"): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "";
}

function makeTrend(direction: "up" | "down" | "none", sentiment: TrendSentiment = "neutral"): TrendData {
  return { direction, sentiment };
}

function eccRatioExplanation(ratio: number): string {
  const n = ratio.toFixed(2);
  if (ratio >= 3.0) return `Eccentric strength is ${n}× your concentric — well above average — excellent muscle control`;
  if (ratio >= 2.0) return `Eccentric strength is ${n}× your concentric — above average`;
  if (ratio >= 1.3) return `Eccentric strength is ${n}× your concentric — within the healthy range`;
  return `Eccentric strength is ${n}× your concentric — below the healthy range of 1.3×`;
}

type ArxExerciseGroup = {
  exercise: string;
  sessions: Array<{ sessionDate: string; output: number | null; concentricMax: number | null; eccentricMax: number | null }>;
};

function carolNum(s: string): number | null {
  if (!s || s === "--" || s === "—") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function estimateVo2Max(manpW: number, weightLbs: number): number | null {
  if (manpW <= 0 || weightLbs < 50) return null;
  const kg = weightLbs / 2.205;
  return 10.8 * (manpW / kg) + 7;
}

function vo2Category(vo2: number): { label: string; color: string; barPct: number } {
  const barPct = Math.min(100, Math.max(0, ((vo2 - 20) / 45) * 100));
  if (vo2 >= 55) return { label: "Excellent", color: "#4A7C59", barPct };
  if (vo2 >= 50) return { label: "Very Good", color: "#4A7C59", barPct };
  if (vo2 >= 44) return { label: "Good", color: "#4A7C59", barPct };
  if (vo2 >= 35) return { label: "Average", color: "#C4831A", barPct };
  return { label: "Below Average", color: "#B84040", barPct };
}

function buildCarolInsight(
  carolSessions: DashboardPayload["carolSessions"],
  weightLbsStr: string,
): string {
  const rehit = carolSessions.filter((s) => normalizeCarolTabKey(s.rideType) === "rehit");
  if (rehit.length === 0) {
    return carolSessions.length > 0
      ? "You have non-REHIT sessions logged. Add REHIT rides to unlock VO2 max tracking and your aerobic fitness trajectory."
      : "Connect your CAROL account to start tracking cardio fitness and see your VO2 max estimate.";
  }

  const parts: string[] = [];
  const weightLbs = carolNum(weightLbsStr) ?? carolNum(weightLbsStr.replace(/[^0-9.]/g, ""));
  const rehitWithManp = rehit.filter((s) => (carolNum(s.manp) ?? 0) > 0);
  const latestManp = carolNum(rehitWithManp[0]?.manp ?? "");

  if (latestManp && weightLbs) {
    const vo2 = estimateVo2Max(latestManp, weightLbs);
    if (vo2) {
      const cat = vo2Category(vo2);
      parts.push(
        `Based on your MANP and scan weight, estimated VO2 max is ~${vo2.toFixed(0)} ml/kg/min — ${cat.label.toLowerCase()} cardiorespiratory capacity.`,
      );
    }
  } else if (latestManp) {
    parts.push(`Current MANP of ${Math.round(latestManp)} W reflects strong aerobic power output. Complete a body scan to unlock a personalised VO2 max estimate.`);
  }

  if (rehitWithManp.length >= 6) {
    const recentAvg = rehitWithManp.slice(0, 3).reduce((s, r) => s + (carolNum(r.manp) ?? 0), 0) / 3;
    const olderAvg = rehitWithManp.slice(3, 6).reduce((s, r) => s + (carolNum(r.manp) ?? 0), 0) / 3;
    if (olderAvg > 0) {
      const pct = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (pct > 3) parts.push(`Aerobic fitness is trending up ${pct.toFixed(0)}% over recent sessions — consistent REHIT is working.`);
      else if (pct < -3) parts.push(`MANP is slightly down recently. This is often fatigue or under-recovery — prioritise sleep and ensure at least 48 hours between REHIT sessions.`);
      else parts.push(`MANP is holding steady — normal during an adaptation phase. Maintain 2 REHIT sessions per week to continue progressing.`);
    }
  }

  const lastEpoc = carolNum(rehit[0]?.caloriesInclEpoc ?? "");
  if (lastEpoc && lastEpoc > 80) {
    parts.push(`Last session generated ~${Math.round(lastEpoc)} kcal including EPOC — that metabolic boost continues for hours after the workout, which is a core benefit of REHIT.`);
  }

  return parts.length > 0
    ? parts.join(" ")
    : "Keep building your REHIT session history — aerobic trends and VO2 max estimates will appear as more data comes in.";
}

function buildArxByExercise(sessions: DashboardPayload["arxSessions"]): ArxExerciseGroup[] {
  const map = new Map<string, ArxExerciseGroup["sessions"]>();
  for (const s of sessions) {
    const arr = map.get(s.exercise) ?? [];
    arr.push(s);
    map.set(s.exercise, arr);
  }
  return Array.from(map.entries())
    .map(([exercise, arr]) => ({ exercise, sessions: arr }))
    .sort((a, b) => b.sessions.length - a.sessions.length);
}

function eccRatioLabel(ratio: number): { label: string; color: string } {
  if (ratio >= 1.3) return { label: "Excellent", color: "#4A7C59" };
  if (ratio >= 1.15) return { label: "Good", color: "#4A7C59" };
  if (ratio >= 1.0) return { label: "Developing", color: "#C4831A" };
  return { label: "Review form", color: "#B84040" };
}

function buildArxInsight(groups: ArxExerciseGroup[]): string {
  if (groups.length === 0) return "Log your first ARX session to start tracking strength progress.";
  if (groups.every((g) => g.sessions.length < 2)) return "Keep building your session history — you need a few more sessions per exercise to start seeing meaningful trend data.";

  const parts: string[] = [];

  // PRs: most recent session is the all-time best concentric
  const prExercises = groups
    .filter(({ sessions }) => {
      if (sessions.length < 2) return false;
      const latest = sessions[0].concentricMax ?? 0;
      const allTime = Math.max(...sessions.map((s) => s.concentricMax ?? 0));
      return latest > 0 && latest >= allTime;
    })
    .map(({ exercise }) => exercise);
  if (prExercises.length > 0) {
    parts.push(`New personal record${prExercises.length > 1 ? "s" : ""} on ${prExercises.slice(0, 2).join(" and ")} this cycle — strength is building.`);
  }

  // Strongest positive trend across exercises with enough history
  let bestTrend = { exercise: "", pct: 0 };
  for (const { exercise, sessions } of groups) {
    if (sessions.length < 6) continue;
    const recentAvg = sessions.slice(0, 3).reduce((s, r) => s + (r.concentricMax ?? 0), 0) / 3;
    const olderAvg = sessions.slice(3, 6).reduce((s, r) => s + (r.concentricMax ?? 0), 0) / 3;
    if (olderAvg > 0) {
      const pct = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (pct > bestTrend.pct) bestTrend = { exercise, pct };
    }
  }
  if (bestTrend.pct > 3) parts.push(`${bestTrend.exercise} concentric output is up ${bestTrend.pct.toFixed(0)}% over recent sessions.`);

  // Low ecc:conc ratio warning
  const lowRatio = groups.find(({ sessions }) => {
    const s = sessions[0];
    return s.concentricMax && s.eccentricMax && s.eccentricMax / s.concentricMax < 1.1;
  });
  if (lowRatio) parts.push(`Eccentric strength on ${lowRatio.exercise} is below 1.1× — slow the negative phase on your next session to activate more muscle fibers and reduce injury risk.`);

  if (parts.length === 0) return "Consistent training base. Focus on progressive overload — aim to slightly exceed your previous session output on each primary movement.";
  return parts.join(" ");
}

// ─── Goals helpers ────────────────────────────────────────────────────────────

const GOAL_DEFS: Record<string, { name: string; description: string; category: string }> = {
  gain_muscle: { name: "Gain Muscle", description: "Track lean mass growth from Fit3D body scans.", category: "Strength" },
  lose_fat: { name: "Lose Fat", description: "Track body fat percentage from Fit3D body scans.", category: "Composition" },
  improve_cardio: { name: "Improve Cardio", description: "Track aerobic power (MANP) from CAROL sessions.", category: "Cardio" },
  attendance: { name: "Consistency", description: "Track session completion against protocol targets.", category: "Habits" },
};

function goalStatusColor(direction: "positive" | "neutral" | "negative" | "no_data"): string {
  if (direction === "positive") return "#4A7C59";
  if (direction === "neutral") return "#C4831A";
  if (direction === "negative") return "#B84040";
  return "var(--text3)";
}

function goalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    gaining: "Gaining", maintaining: "Maintaining", losing: "Losing",
    improving: "Improving", increasing: "Increasing",
    declining: "Declining", on_track: "On Track", behind: "Behind", off_track: "Off Track",
    no_data: "No data yet",
  };
  return map[status] ?? status;
}

const PROTOCOL_REASONS: Record<string, string> = {
  "Longevity Protocol": "Covers muscle growth, fat loss, cardio fitness, and recovery — the complete multi-system approach.",
  "Metabolic Reset": "Combines ARX strength training with fat-burning CAROL sessions to shift body composition.",
  "Cardio Focus": "Prioritizes CAROL REHIT and extended sessions to build aerobic capacity and raise VO2 max.",
  "Strength Foundation": "Builds foundational muscle strength with targeted ARX sessions and progressive overload.",
};

// ─── Protocol page content ────────────────────────────────────────────────────

type ProtocolMeta = {
  tagline: string;
  description: string;
  targets: Array<{ label: string; value: string }>;
  whatToExpect: string[];
};

const PROTOCOL_META: Record<string, ProtocolMeta> = {
  Longevity: {
    tagline: "Feel good. Stay capable.",
    description: "Balanced training for strength, cardio, mobility, and recovery.",
    targets: [
      { label: "Strength", value: "1–2x" },
      { label: "Cardio (CAROL)", value: "2x" },
      { label: "Zone 2", value: "1–2x" },
      { label: "Mobility", value: "1x" },
      { label: "Recovery", value: "2x" },
    ],
    whatToExpect: [
      "3–5 sessions per week",
      "Moderate intensity",
      "Focus on consistency and feeling good",
    ],
  },
  "Body Composition": {
    tagline: "Look leaner. Build muscle.",
    description: "Higher-volume training designed to help change your body.",
    targets: [
      { label: "Strength", value: "2–3x" },
      { label: "Cardio (CAROL)", value: "2–3x" },
      { label: "Zone 2", value: "1x" },
      { label: "Mobility", value: "1x" },
      { label: "Recovery", value: "1–2x" },
    ],
    whatToExpect: [
      "More frequent training",
      "Higher overall output",
      "Designed for visible results",
    ],
  },
  Performance: {
    tagline: "Train harder. Get stronger.",
    description: "Higher-intensity training built to improve strength and performance.",
    targets: [
      { label: "Strength", value: "2–3x" },
      { label: "Cardio (CAROL)", value: "2x" },
      { label: "Zone 2", value: "1x" },
      { label: "Mobility", value: "1x" },
      { label: "Recovery", value: "1x" },
    ],
    whatToExpect: [
      "Higher intensity sessions",
      "Strength-focused training",
      "Performance-driven approach",
    ],
  },
};

const PROTOCOL_ALIASES: Record<string, keyof typeof PROTOCOL_META> = {
  // Current canonical names
  "Longevity":            "Longevity",
  "Body Composition":     "Body Composition",
  "Bone Density":         "Longevity",
  "Athletic Performance": "Performance",
  "Healthspan Elite":     "Performance",
  // Legacy names (backwards compat for already-assigned members)
  "Longevity Protocol":   "Longevity",
  "Metabolic Reset":      "Body Composition",
  "Exercise Performance": "Performance",
  "Performance":          "Performance",
  "Strength Foundation":  "Performance",
  "Cardio Focus":         "Longevity",
  "Recovery Phase":       "Longevity",
  "Recovery":             "Longevity",
};

function resolveProtocolMeta(name: string): ProtocolMeta {
  const key = PROTOCOL_ALIASES[name] ?? "Longevity";
  return PROTOCOL_META[key] ?? PROTOCOL_META["Longevity"];
}

const CHOOSE_PROTOCOL_OPTIONS: Array<{
  key: keyof typeof PROTOCOL_META;
  headline: string;
  description: string;
}> = [
  {
    key: "Longevity",
    headline: "Feel good. Stay capable.",
    description: "Balanced training for long-term health and energy.",
  },
  {
    key: "Body Composition",
    headline: "Look leaner. Build muscle.",
    description: "More training to help change your body.",
  },
  {
    key: "Performance",
    headline: "Train harder. Get stronger.",
    description: "Higher intensity training to improve performance.",
  },
];

const OPTIONAL_ADDONS = [
  "Katalyst (EMS training)",
  "Vasper",
  "Proteus",
  "Additional recovery",
];

// ─── Protocol data-model typed constants (coach-facing) ───────────────────────

// ProtocolTier imported from @/lib/protocolContent

type ColdPlungeRule =
  | "recommended"
  | "optional_contrast"
  | "optional_cardio"
  | "never"
  | null;

const PROTOCOL_TIER_LABELS: Record<ProtocolTier, string> = TIER_DISPLAY;

const COLD_PLUNGE_LABELS: Record<NonNullable<ColdPlungeRule>, string> = {
  recommended:       "Cold Plunge — Recommended",
  optional_contrast: "Cold Plunge — Optional Contrast",
  optional_cardio:   "Cold Plunge — Optional Cardio",
  never:             "Cold Plunge — Never",
};

type CoachProtocol = {
  id: string;
  name: string;
  target_system: string;
  description: string;
  tier: ProtocolTier | null;
  science_rationale: string | null;
  days_per_week: number | null;
  arx_frequency_per_week: number | null;
  carol_frequency_per_week: number | null;
  recovery_target_per_month: number | null;
  carol_ride_types: string[] | null;
  arx_exercises: string[] | null;
  notes: string | null;
};

type ProtocolDayActivity = {
  id: string;
  order: number;
  type: string;
  name: string;
  durationMinutes: number;
  isOptional: boolean;
  coldPlunge: ColdPlungeRule;
};

type ProtocolDay = {
  id: string;
  dayOfWeek: number;
  dayName: string;
  dayTheme: string;
  dayDescription: string;
  activities: ProtocolDayActivity[];
};

function equipmentTagStyle(type: string, coldPlunge: ColdPlungeRule, isOptional: boolean): {
  background: string;
  border: string;
  color: string;
} {
  if (coldPlunge === "recommended") {
    return { background: "rgba(85,184,240,0.18)", border: "1px solid rgba(85,184,240,0.6)", color: "#55b8f0" };
  }
  if (coldPlunge === "optional_contrast" || coldPlunge === "optional_cardio") {
    return { background: "transparent", border: "1px dashed rgba(85,184,240,0.5)", color: "#55b8f0" };
  }
  if (coldPlunge === "never") {
    return { background: "rgba(240,112,85,0.12)", border: "1px solid rgba(240,112,85,0.4)", color: "#f07055" };
  }
  const t = type.toLowerCase();
  if (t === "nxpro" || t === "nx_pro" || t.includes("nxpro")) {
    return { background: "rgba(168,85,240,0.15)", border: "1px solid rgba(168,85,240,0.5)", color: "#a855f0" };
  }
  if (t === "proteus") {
    return { background: "rgba(240,185,85,0.15)", border: "1px solid rgba(240,185,85,0.5)", color: "#f0b955" };
  }
  if (isOptional) {
    return { background: "transparent", border: "1px dashed rgba(255,255,255,0.2)", color: "var(--text3)" };
  }
  return { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text2)" };
}

function normalizeProtocolTier(v: unknown): ProtocolTier | null {
  const valid: ProtocolTier[] = ["longevity","bone_density","body_composition","athletic_performance","healthspan_elite"];
  if (typeof v === "string" && (valid as string[]).includes(v)) return v as ProtocolTier;
  return null;
}

function tierDaysRange(tier: ProtocolTier | null): string {
  if (tier === "healthspan_elite") return "3–6";
  return "1–6";
}

// Thin shim — delegates to shared lib so both member + coach views use the same logic.
function recommendProtocol(activeGoals: string[]): string | null {
  return recommendProtocolLib(activeGoals).name;
}

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─── Plan activity → log item mapping ────────────────────────────────────────
type PlanAct = { type: string; name: string };
function planActToLog(a: PlanAct): { to_add?: Array<{ type: string; subtype: string }>; bonus?: string[] } {
  const n = a.name.toLowerCase();
  if (a.type === "strength" && n.includes("arx")) return { to_add: [{ type: "arx", subtype: "manual_checkin" }] };
  if (a.type === "cardio" && n.includes("carol")) {
    if (n.includes("rehit")) return { to_add: [{ type: "carol", subtype: "REHIT" }] };
    if (n.includes("norwegian")) return { to_add: [{ type: "carol", subtype: "FAT_BURN_60" }] };
    return { to_add: [{ type: "carol", subtype: "FAT_BURN_45" }] };
  }
  if (a.type === "recovery") {
    if (n.includes("cold plunge") || n.includes("cold")) return { to_add: [{ type: "recovery", subtype: "cold_plunge" }] };
    if (n.includes("sauna")) return { to_add: [{ type: "recovery", subtype: "sauna" }] };
    if (n.includes("vasper")) return { bonus: ["vasper"] };
  }
  if (n.includes("katalyst")) return { bonus: ["katalyst"] };
  if (n.includes("proteus")) return { bonus: ["other_cardio"] };
  if (a.type === "coaching") return { bonus: ["nxpro"] };
  return {};
}

// ─── Bonus activity definitions ──────────────────────────────────────────────

const BONUS_ACTIVITIES = [
  { key: "katalyst", label: "Katalyst EMS" },
  { key: "quickboard", label: "Quickboard" },
  { key: "vasper", label: "Vasper" },
  { key: "nxpro", label: "NxPro / Red Light" },
  { key: "walk", label: "Walk" },
  { key: "stretching", label: "Stretching" },
  { key: "extra_sauna", label: "Extra sauna" },
  { key: "extra_cold_plunge", label: "Extra cold plunge" },
  { key: "other_cardio", label: "Other cardio" },
] as const;

// ─── Checklist helpers ────────────────────────────────────────────────────────

type ChecklistItem = {
  id: string;
  category: "strength" | "cardio" | "recovery";
  label: string;
  type: "arx" | "carol" | "recovery";
  subtype: string;
};

const CAROL_RIDE_LABELS: Record<string, string> = {
  REHIT: "REHIT", FAT_BURN_30: "Fat Burn 30", FAT_BURN_45: "Fat Burn 45",
  FAT_BURN_60: "Fat Burn 60", ENERGISER: "Energiser",
};
const RECOVERY_MODALITIES = ["cold_plunge", "sauna", "compression", "infrared_sauna", "nxpro"];
const RECOVERY_LABELS: Record<string, string> = {
  cold_plunge: "Cold plunge", sauna: "Sauna", compression: "Compression",
  infrared_sauna: "Infrared sauna", nxpro: "NxPro",
};

function generateChecklist(protocol: DashboardPayload["protocol"]): ChecklistItem[] {
  if (!protocol.targetSystem) return [];
  const items: ChecklistItem[] = [];
  for (let i = 0; i < protocol.arxPerWeek; i++) {
    items.push({ id: `arx-${i}`, category: "strength", label: "ARX session", type: "arx", subtype: "manual_checkin" });
  }
  for (const rideType of protocol.carolRideTypes) {
    const label = `CAROL ${CAROL_RIDE_LABELS[rideType] ?? rideType.replace(/_/g, " ")}`;
    items.push({ id: `carol-${rideType}`, category: "cardio", label, type: "carol", subtype: rideType });
  }
  const weeklyRecovery = Math.max(1, Math.ceil(protocol.recoveryPerMonth / 4));
  for (let i = 0; i < weeklyRecovery; i++) {
    const mod = RECOVERY_MODALITIES[i % RECOVERY_MODALITIES.length];
    const repeat = Math.floor(i / RECOVERY_MODALITIES.length);
    items.push({ id: `recovery-${mod}-${repeat}`, category: "recovery", label: RECOVERY_LABELS[mod] ?? mod, type: "recovery", subtype: mod });
  }
  return items;
}

function isChecklistItemDone(
  item: ChecklistItem,
  c: DashboardPayload["checklistCompletions"],
  local: Record<string, boolean>,
): boolean {
  if (local[item.id]) return true;
  if (item.type === "arx") {
    const idx = parseInt(item.id.split("-")[1] ?? "0", 10);
    return [...new Set(c.arxWeekDates)].length > idx;
  }
  if (item.type === "carol") return c.carolWeekTypes.includes(item.subtype);
  if (item.type === "recovery") {
    const parts = item.id.split("-");
    const repeat = parseInt(parts[parts.length - 1] ?? "0", 10);
    const mod = parts.slice(1, -1).join("-");
    return c.recoveryWeekModalities.filter((m) => m === mod).length > repeat;
  }
  return false;
}

function formatTargetSystem(s: string): string {
  const map: Record<string, string> = { muscle: "Muscle", cardio: "Cardio", metabolic: "Metabolic", recovery: "Recovery", performance: "Performance" };
  return map[s] ?? s;
}

function formatMessageTime(isoValue: string): string {
  if (!isoValue) return "";
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload as T;
}

export function DashboardReactClient({
  payload,
  role,
  actorRole,
  route,
  initialMemberView,
  initialCoachView,
}: {
  payload: DashboardPayload;
  role: "member" | "coach";
  actorRole: ActorRole;
  route: "dashboard" | "coach";
  initialMemberView: MemberSection;
  initialCoachView: CoachSection;
}) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [mode, setMode] = useState<"member" | "coach">(
    role === "member" ? "member" : route === "coach" ? "coach" : "member",
  );
  const [memberView, setMemberView] = useState<MemberSection>(initialMemberView);
  const [coachView, setCoachView] = useState<CoachSection>(initialCoachView);
  const [carolTab, setCarolTab] = useState<"rehit" | "fat_burn" | "free_custom" | "fitness_tests">(
    "rehit",
  );
  const [activeScanDot, setActiveScanDot] = useState<number | null>(null);
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
  const [coachProtocols, setCoachProtocols] = useState<CoachProtocol[]>([]);
  const [protocolTierFilter, setProtocolTierFilter] = useState<ProtocolTier | "all">("all");
  const [expandedProtocolId, setExpandedProtocolId] = useState<string | null>(null);
  const [protocolDaysCache, setProtocolDaysCache] = useState<Record<string, ProtocolDay[]>>({});
  const [loadingProtocolDays, setLoadingProtocolDays] = useState<string | null>(null);
  const [protocolFreqSelection, setProtocolFreqSelection] = useState<Record<string, number>>({});
  const [allMembers, setAllMembers] = useState<Array<{ id: string; name: string; tier: string; member_status?: string; review_requested_at?: string | null }>>([]);
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignProtocolId, setAssignProtocolId] = useState("");
  const [localGoals, setLocalGoals] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { gain_muscle: false, lose_fat: false, improve_cardio: false, attendance: false };
    for (const gt of payload.goals.activeGoals) init[gt] = true;
    return init;
  });
  const [savingGoal, setSavingGoal] = useState<string | null>(null);
  const [memberGoals, setMemberGoals] = useState<Record<string, boolean>>({});
  const [loadingMemberGoals, setLoadingMemberGoals] = useState(false);
  const [protocolRequested, setProtocolRequested] = useState(false);
  const [isRequestingProtocol, setIsRequestingProtocol] = useState(false);
  const [coachNoteText, setCoachNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [memberNotes, setMemberNotes] = useState<Array<{ id: string; note: string; created_at: string }>>([]);
  const [notesForMember, setNotesForMember] = useState("");
  const [todayCheckin, setTodayCheckin] = useState<"low" | "normal" | "strong" | "hurt" | null>(null);
  const [sessionGuideOpen, setSessionGuideOpen] = useState(false);
  const [guardrailItem, setGuardrailItem] = useState<ChecklistItem | null>(null);
  const [sendingGuardrail, setSendingGuardrail] = useState(false);
  const [guardrailSent, setGuardrailSent] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState<{ day: WeekDay | null; }>({ day: null });
  const [movingDay, setMovingDay] = useState(false);
  const [bonusCelebration, setBonusCelebration] = useState("");
  const [selectedArxExercise, setSelectedArxExercise] = useState<string | null>(null);
  const [progressExpandBody, setProgressExpandBody] = useState(false);
  const [progressExpandStrength, setProgressExpandStrength] = useState(false);
  const [progressExpandCardio, setProgressExpandCardio] = useState(false);
  type DayActivity = { date: string; arx: Array<{ exercise: string; concentricMax: number | null; eccentricMax: number | null }>; carol: Array<{ rideType: string; manp: number | null; peakPower: number | null }>; recovery: Array<{ modality: string }>; manual: Array<{ equipment: string }> };
  const [historyDays, setHistoryDays] = useState<DayActivity[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historySelectedDate, setHistorySelectedDate] = useState<string | null>(null);
  const [historyViewMonth, setHistoryViewMonth] = useState(() => new Date().getMonth());
  const [historyViewYear, setHistoryViewYear] = useState(() => new Date().getFullYear());
  const [sessionStep, setSessionStep] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState<Set<number>>(new Set());
  const [weekViewOpen, setWeekViewOpen] = useState(false);
  type WeekDay = { id: string; dayOfWeek: number; dayName: string; dayTheme: string; dayDescription: string; activities: Array<{ id: string; order: number; type: string; name: string; durationMinutes: number; description: string; whyItMatters: string; steps: string[]; isBookable: boolean; bookingUrl: string | null; isOptional: boolean; alternativeActivity: string | null; coldPlunge: string | null }>; totalMinutes: number };
  type WeekOverride = { protocolDayId: string; originalDow: number; overrideDow: number };
  const [weekPlan, setWeekPlan] = useState<WeekDay[]>([]);
  const [weekViewDay, setWeekViewDay] = useState<number | null>(null);
  const [weekPlanMeta, setWeekPlanMeta] = useState<{ customizationNotes: string | null; overrides: WeekOverride[] }>({ customizationNotes: null, overrides: [] });
  const [selectedProtocol, setSelectedProtocol] = useState<Record<string, boolean>>({});
  const [selectedBonus, setSelectedBonus] = useState<Record<string, boolean>>({});
  const [savingActivity, setSavingActivity] = useState(false);
  const [activitySavedMsg, setActivitySavedMsg] = useState("");
  const [localBonusCount, setLocalBonusCount] = useState(0);
  // Locally-appended logged sessions (key → array of date strings) so newly saved
  // sessions appear in the "already logged" rows without a page reload.
  const [localLoggedDates, setLocalLoggedDates] = useState<Record<string, string[]>>({});
  // Tracks which protocol day IDs have been checked off locally this session
  const [checkedDayIds, setCheckedDayIds] = useState<Record<string, boolean>>({});
  const [weekPlanLoaded, setWeekPlanLoaded] = useState(false);
  const [sessionCardDow, setSessionCardDow] = useState<number | null>(null);
  const [sessionCardCompleted, setSessionCardCompleted] = useState<Record<string, boolean>>({});
  // Which activity ID is expanded in the inline session card
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  // Whether the rest plan has been revealed (after tapping "See recovery options")
  const [showRestPlan, setShowRestPlan] = useState(false);
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [checkinLoaded, setCheckinLoaded] = useState(false);
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [protocolRequestText, setProtocolRequestText] = useState("");
  const [sendingProtocolRequest, setSendingProtocolRequest] = useState(false);
  const [protocolRequestSent, setProtocolRequestSent] = useState(false);
  const [showChangeProtocol, setShowChangeProtocol] = useState(false);
  const [confirmProtocol, setConfirmProtocol] = useState<keyof typeof PROTOCOL_META | null>(null);
  const [switchingProtocol, setSwitchingProtocol] = useState(false);
  const [switchProtocolSent, setSwitchProtocolSent] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [expandedSessionDay, setExpandedSessionDay] = useState<number | null>(null);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  type CoachNotif = {
    id: string;
    member_id: string;
    member_name: string;
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
    payload?: {
      diff?: Array<{ field: string; label: string; oldValue: string; newValue: string }>;
      recommendation?: string | null;
      recommendation_reason?: string | null;
    } | null;
  };
  const [coachNotifs, setCoachNotifs] = useState<CoachNotif[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifLoaded, setNotifLoaded] = useState(false);

  // Review screen state
  const [reviewMemberId, setReviewMemberId] = useState<string | null>(null);
  const [reviewNotifId, setReviewNotifId] = useState<string | null>(null);
  const [reviewDiff, setReviewDiff] = useState<Array<{ field: string; label: string; oldValue: string; newValue: string }>>([]);
  const [reviewRecommendation, setReviewRecommendation] = useState<string | null>(null);
  const [reviewRecommendationReason, setReviewRecommendationReason] = useState<string | null>(null);
  const [reviewMemberName, setReviewMemberName] = useState("");
  const [reviewCoachNote, setReviewCoachNote] = useState("");
  const [reviewProtocolChanged, setReviewProtocolChanged] = useState(false);
  const [reviewNewProtocolId, setReviewNewProtocolId] = useState("");
  const [reviewNewDays, setReviewNewDays] = useState<number | null>(null);
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [reviewConfirmMsg, setReviewConfirmMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [reviewDiffCollapsed, setReviewDiffCollapsed] = useState(false);
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignCoachNotes, setAssignCoachNotes] = useState("");
  const [assignStatus, setAssignStatus] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [peerName, setPeerName] = useState("Dustin");
  const [peerId, setPeerId] = useState(payload.coachId ?? "");
  const [selectedCoachRecipientId, setSelectedCoachRecipientId] = useState(
    payload.coach.members[0]?.id ?? "",
  );
  const [coachPeers, setCoachPeers] = useState<InboxPeer[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesStatus, setMessagesStatus] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const displayName = useMemo(
    () => displayNameFromClerk(user, payload.displayName || "Member"),
    [payload.displayName, user],
  );
  const greetingName = useMemo(() => firstNameFromName(displayName), [displayName]);
  const userInitials = useMemo(() => initialsFromName(displayName), [displayName]);
  const isCoachAccount = role !== "member";

  // Initialize selectedProtocol from server completion data on mount
  useEffect(() => {
    if (isCoachAccount) return;
    const checklist = generateChecklist(payload.protocol);
    const c = payload.checklistCompletions;
    const init: Record<string, boolean> = {};
    for (const item of checklist) init[item.id] = isChecklistItemDone(item, c, {});
    setSelectedProtocol(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load today's check-in on mount for members
  useEffect(() => {
    if (isCoachAccount || checkinLoaded) return;
    setCheckinLoaded(true);
    void (async () => {
      try {
        const res = await getJson<{ feeling: string | null }>("/api/member/checkin");
        if (res.feeling) setTodayCheckin(res.feeling as "low" | "normal" | "strong");
      } catch { /* table may not exist */ }
    })();
  }, [isCoachAccount, checkinLoaded]);

  // Load the week plan — triggered on mount AND whenever the member taps "Feeling strong"
  // (so it retries if the first fetch returned empty due to a timing issue)
  useEffect(() => {
    if (isCoachAccount || weekPlan.length > 0) return;
    // Only fetch once unless todayCheckin just became "strong"
    if (weekPlanLoaded && todayCheckin !== "strong") return;
    setWeekPlanLoaded(true);
    void (async () => {
      try {
        const r = await getJson<{ days: typeof weekPlan; customizationNotes: string | null; overrides: WeekOverride[] }>("/api/member/week-plan");
        if (Array.isArray(r.days) && r.days.length > 0) {
          setWeekPlan(r.days);
          setWeekPlanMeta({ customizationNotes: r.customizationNotes ?? null, overrides: r.overrides ?? [] });
        }
      } catch { /* protocol days may not be seeded */ }
    })();
  }, [isCoachAccount, weekPlan.length, weekPlanLoaded, todayCheckin]);

  const handleGoalToggle = useCallback(async (goalType: string, forMemberId?: string) => {
    if (forMemberId) {
      const newVal = !memberGoals[goalType];
      setMemberGoals((prev) => ({ ...prev, [goalType]: newVal }));
      try {
        await fetch("/api/coach/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: forMemberId, goal_type: goalType, is_active: newVal }) });
      } catch { setMemberGoals((prev) => ({ ...prev, [goalType]: !newVal })); }
    } else {
      const newVal = !localGoals[goalType];
      setSavingGoal(goalType);
      setLocalGoals((prev) => ({ ...prev, [goalType]: newVal }));
      try {
        await fetch("/api/member/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal_type: goalType, is_active: newVal }) });
      } catch { setLocalGoals((prev) => ({ ...prev, [goalType]: !newVal })); }
      finally { setSavingGoal(null); }
    }
  }, [localGoals, memberGoals]);

  // Load coach notifications eagerly when in coach mode
  useEffect(() => {
    if (!isCoachAccount) return;
    if (notifLoaded) return;
    setNotifLoaded(true);
    void (async () => {
      try {
        const res = await getJson<{ notifications: typeof coachNotifs; unread_count: number }>("/api/coach/notifications");
        if (Array.isArray(res.notifications)) setCoachNotifs(res.notifications);
        setNotifUnreadCount(res.unread_count ?? 0);
      } catch { /* table may not exist yet */ }
    })();
  }, [isCoachAccount, notifLoaded, coachNotifs]);

  useEffect(() => {
    if (!isCoachAccount || !assignMemberId || assignMemberId === notesForMember) return;
    setNotesForMember(assignMemberId);
    setMemberNotes([]);
    void (async () => {
      try {
        const res = await getJson<{ notes: typeof memberNotes }>(`/api/coach/session-notes?member_id=${assignMemberId}`);
        if (Array.isArray(res.notes)) setMemberNotes(res.notes);
      } catch { /* table may not exist yet */ }
    })();
  }, [assignMemberId, isCoachAccount, notesForMember]);

  useEffect(() => {
    if (!isCoachAccount || mode !== "coach" || coachView !== "protocols" || !assignMemberId) return;
    setLoadingMemberGoals(true);
    void (async () => {
      try {
        const res = await fetch(`/api/coach/goals?member_id=${assignMemberId}`);
        const json = (await res.json().catch(() => ({}))) as { goals?: Array<{ goal_type: string; is_active: boolean }> };
        const g: Record<string, boolean> = { gain_muscle: false, lose_fat: false, improve_cardio: false, attendance: false };
        for (const goal of json.goals ?? []) if (goal.is_active) g[goal.goal_type] = true;
        setMemberGoals(g);
      } finally { setLoadingMemberGoals(false); }
    })();
  }, [assignMemberId, coachView, isCoachAccount, mode]);
  const payloadCoachRecipients = useMemo(
    () =>
      Array.isArray(payload.coach.members)
        ? payload.coach.members.map((member) => ({
            id: String(member.id || ""),
            name: String(member.name || "Member"),
          }))
        : [],
    [payload.coach.members],
  );
  const effectiveCoachRecipients = useMemo(() => {
    if (coachPeers.length > 0) {
      return coachPeers.map((peer) => ({
        id: String(peer.id || ""),
        name: String(peer.full_name || "Member"),
      }));
    }
    return payloadCoachRecipients;
  }, [coachPeers, payloadCoachRecipients]);

  useEffect(() => {
    if (!isCoachAccount) return;
    if (selectedCoachRecipientId) return;
    const first = effectiveCoachRecipients[0]?.id ?? "";
    if (first) setSelectedCoachRecipientId(first);
  }, [effectiveCoachRecipients, isCoachAccount, selectedCoachRecipientId]);

  useEffect(() => {
    if (role === "member") {
      setMode("member");
    }
  }, [role]);

  const memberCarolRows = useMemo(() => {
    const allRows = Array.isArray(payload.carolSessions) ? payload.carolSessions : [];
    return allRows.filter((row) => normalizeCarolTabKey(row.rideType) === carolTab);
  }, [carolTab, payload.carolSessions]);

  const carolStatRows = useMemo(() => {
    return memberCarolRows.length ? memberCarolRows : payload.carolSessions;
  }, [memberCarolRows, payload.carolSessions]);

  const loadMessages = useCallback(
    async (markRead: boolean, targetPeerId?: string) => {
      try {
        const params = new URLSearchParams();
        if (markRead) params.set("mark_read", "1");
        if (targetPeerId && targetPeerId.trim()) params.set("peer_id", targetPeerId.trim());
        const response = await getJson<{
          peer?: { id?: string; full_name?: string; role?: string };
          peers?: InboxPeer[];
          coach?: { id?: string; full_name?: string };
          unread_count?: number;
          messages?: MessageItem[];
        }>(`/api/messages/inbox${params.toString() ? `?${params.toString()}` : ""}`);
        const resolvedPeerId = String(response.peer?.id || response.coach?.id || "");
        const resolvedPeerName = String(response.peer?.full_name || response.coach?.full_name || "Dustin");
        setPeerId(resolvedPeerId);
        setPeerName(resolvedPeerName);
        if (isCoachAccount) {
          const peers = Array.isArray(response.peers) ? response.peers : [];
          setCoachPeers(peers);
          setSelectedCoachRecipientId((previous) => {
            if (!resolvedPeerId) return previous;
            if (!previous) return resolvedPeerId;
            const previousStillValid = peers.some((peer) => String(peer.id || "") === previous);
            return previousStillValid ? previous : resolvedPeerId;
          });
        }
        setUnreadCount(markRead ? 0 : Number(response.unread_count || 0));
        const normalizedMessages = Array.isArray(response.messages)
          ? response.messages
              .slice(-120)
              .map((message) => ({
                ...message,
                body: String(message.body || "").slice(0, 4000),
              }))
          : [];
        setMessages(normalizedMessages);
        setMessagesStatus("");
      } catch (error) {
        setMessagesStatus(error instanceof Error ? error.message : "Unable to load messages.");
      }
    },
    [isCoachAccount],
  );

  useEffect(() => {
    if (role !== "member" || memberView !== "messages") return;
    void loadMessages(true);
  }, [loadMessages, memberView, role]);

  useEffect(() => {
    if (!isCoachAccount || mode !== "coach" || coachView !== "messages") return;
    const targetPeerId = selectedCoachRecipientId || undefined;
    void loadMessages(true, targetPeerId);
  }, [coachView, isCoachAccount, loadMessages, mode, selectedCoachRecipientId]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!isCoachAccount || mode !== "coach" || coachView !== "protocols") return;
    void (async () => {
      try {
        // Always reload protocols so tier/days_per_week are fresh
        const res = await getJson<{ protocols: CoachProtocol[] }>("/api/coach/protocols");
        if (Array.isArray(res.protocols)) setCoachProtocols(res.protocols);
        if (allMembers.length === 0) {
          const mRes = await getJson<{ members: typeof allMembers }>("/api/coach/members");
          if (Array.isArray(mRes.members)) setAllMembers(mRes.members);
        }
      } catch { /* tables may not exist yet */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachView, isCoachAccount, mode]);

  const sendMessage = useCallback(async () => {
    if (sendingMessage) return;
    const body = messageDraft.trim();
    if (!body) {
      setMessagesStatus("Message cannot be empty.");
      return;
    }
    setSendingMessage(true);
    setMessagesStatus("Sending...");
    try {
      const latestThreadId =
        messages
          .map((item) => String(item.thread_id || ""))
          .filter(Boolean)
          .slice(-1)[0] || undefined;
      const resolvedRecipientId =
        mode === "coach"
          ? selectedCoachRecipientId || peerId
          : peerId || undefined;
      if (!resolvedRecipientId) {
        throw new Error("Select a message recipient first.");
      }
      const response = await postJson<{ message?: MessageItem }>("/api/messages/send", {
        recipient_id: resolvedRecipientId || undefined,
        thread_id: latestThreadId,
        body,
      });
      if (response.message) {
        setMessages((previous) => [...previous, response.message as MessageItem]);
      }
      setMessageDraft("");
      setUnreadCount(0);
      setMessagesStatus("Message sent.");
    } catch (error) {
      setMessagesStatus(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setSendingMessage(false);
    }
  }, [messageDraft, messages, mode, peerId, selectedCoachRecipientId, sendingMessage]);

  const messageBadge = unreadCount > 0 ? unreadCount : undefined;
  const canSeeCoachImportData = actorRole === "coach" || actorRole === "admin";

  const activeMemberView = (view: MemberSection): string => (memberView === view ? "nav-item active" : "nav-item");
  const activeCoachView = (view: CoachSection): string => (coachView === view ? "nav-item active" : "nav-item");

  const setMemberSection = (view: MemberSection) => {
    setMode("member");
    setMemberView(view);
    // Reset session card navigation when leaving the dashboard so
    // returning always shows today's session, not a previously browsed day
    if (view !== "dashboard") {
      setSessionCardDow(null);
      setExpandedActivityId(null);
    }
  };

  const latestCarol = carolStatRows[0];
  const peakAvgSprintPower = carolStatRows.length
    ? Math.max(...carolStatRows.map((row) => Number(row.avgSprintPower || 0)))
    : 0;

  const handleSignOut = useCallback(async () => {
    await signOut({ redirectUrl: "/" });
  }, [signOut]);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <div className="logo-word">Iso<em>.</em></div>
          <div className="logo-sub">Healthspan OS</div>
        </div>

        {role !== "member" ? (
          <div className="view-toggle">
            <button
              className={`vt-btn ${mode === "member" ? "active" : ""}`}
              onClick={() => setMode("member")}
              type="button"
            >
              Member
            </button>
            <button
              className={`vt-btn ${mode === "coach" ? "active" : ""}`}
              onClick={() => setMode("coach")}
              type="button"
            >
              Coach
            </button>
          </div>
        ) : null}

        <div className="nav" id="member-nav" style={{ display: mode === "member" ? "block" : "none" }}>
          <div className="nav-group">
            <button className={activeMemberView("dashboard")} onClick={() => setMemberSection("dashboard")} type="button">
              Dashboard
            </button>
            <button className={activeMemberView("progress")} onClick={() => setMemberSection("progress")} type="button">
              Progress
            </button>
            <button className={activeMemberView("protocol")} onClick={() => setMemberSection("protocol")} type="button">
              Protocol
            </button>
          </div>
        </div>

        <div className="nav" id="coach-nav" style={{ display: mode === "coach" ? "block" : "none" }}>
          <div className="nav-group">
            <div className="nav-group-label">Coach</div>
            <button className={activeCoachView("morning")} onClick={() => setCoachView("morning")} type="button">
              Morning Brief
            </button>
            <button className={activeCoachView("members")} onClick={() => setCoachView("members")} type="button">
              All Members
            </button>
            <button className={activeCoachView("messages")} onClick={() => setCoachView("messages")} type="button">
              Messages
            </button>
            <button className={activeCoachView("log")} onClick={() => setCoachView("log")} type="button">
              Log Session
            </button>
            <button className={activeCoachView("protocols")} onClick={() => setCoachView("protocols")} type="button">
              Protocols
            </button>
            {canSeeCoachImportData ? (
              <>
                <Link className="nav-item" href="/coach/import/fit3d">
                  Import Data
                </Link>
                <Link className="nav-item" href="/coach/import/arx">
                  Import ARX
                </Link>
              </>
            ) : null}
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-row">
            <div className="user-av">{userInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">{displayName}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <Link
              href="/dashboard/settings"
              className="btn btn-sm"
              style={{ width: "100%", textAlign: "center", textDecoration: "none" }}
            >
              Settings &amp; Connections
            </Link>
            <button
              className="btn btn-sm"
              type="button"
              style={{ width: "100%" }}
              onClick={() => { void handleSignOut(); }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-date">{todayDateLabel()}</div>
            <div className="topbar-title">Good morning, {greetingName}.</div>
          </div>
          <div className="topbar-right">
            {mode === "member" ? (
              <>
                <Link className="btn btn-sm" href="/dashboard/settings">
                  Settings
                </Link>
              </>
            ) : canSeeCoachImportData ? (
              <>
                <Link className="btn btn-sm" href="/coach/import/fit3d">
                  Import Fit3D
                </Link>
                <Link className="btn btn-sm" href="/coach/import/arx">
                  Import ARX
                </Link>
              </>
            ) : null}
            {/* Coach notification bell */}
            {isCoachAccount && (
              <button
                type="button"
                className="btn notif-wrap btn-sm"
                onClick={() => {
                  setNotifPanelOpen(true);
                  if (!notifLoaded) {
                    setNotifLoaded(false); // trigger reload
                  }
                }}
                style={{ position: "relative", minWidth: 36 }}
              >
                🔔
                {notifUnreadCount > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: "#B84040", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                    {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
                  </span>
                )}
              </button>
            )}
            <button
              className="btn notif-wrap btn-sm"
              onClick={() => {
                if (mode === "coach") {
                  setCoachView("messages");
                } else {
                  setMemberSection("messages");
                }
              }}
              type="button"
            >
              Messages
              {mode === "member" && unreadCount > 0 ? <span className="notif-dot" /> : null}
            </button>
            <button className="btn btn-lime btn-sm" onClick={() => setMemberSection("schedule")} type="button">
              Book Session
            </button>
          </div>
        </div>

        <div id="view-dashboard" className="content" style={{ display: mode === "member" && memberView === "dashboard" ? "block" : "none" }}>

          {/* ── Greeting ─────────────────────────────────────────────── */}
          {(() => {
            const now  = new Date();
            const hour = now.getHours();
            const g    = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
            return (
              <div style={{ padding: "20px 16px 8px" }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 3 }}>
                  {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text)", lineHeight: 1.2 }}>
                  {g}, {greetingName}.
                </div>
              </div>
            );
          })()}

          {/* Connect nudge */}
          {payload.carolSessions.length === 0 && payload.arxSessions.length === 0 && payload.scanHistory.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 12px 8px", background: "rgba(29,158,117,0.06)", border: "0.5px solid #1D9E75", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 2 }}>Connect your devices to see real data</div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>Link ARX and CAROL in Settings.</div>
              </div>
              <Link href="/dashboard/settings" style={{ flexShrink: 0, fontSize: 12, fontWeight: 500, color: "#0F6E56", textDecoration: "none" }}>Settings →</Link>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              CARD 1 — READINESS CHECK
          ══════════════════════════════════════════════════════════════ */}
          {!todayCheckin && (() => {
            async function submitCheckin(feeling: "strong" | "low" | "hurt") {
              if (submittingCheckin) return;
              setSubmittingCheckin(true);
              try {
                await fetch("/api/member/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feeling }) });
                setTodayCheckin(feeling);
                setShowRestPlan(false);
              } catch { /* silent */ } finally { setSubmittingCheckin(false); }
            }
            return (
              <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: "0.5px solid #E5E5E0", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Before you come in</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 12, lineHeight: 1.4 }}>How are you feeling today?</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <button type="button" disabled={submittingCheckin} onClick={() => { void submitCheckin("strong"); }}
                      style={{ padding: "10px 6px", borderRadius: 10, border: "0.5px solid #1D9E75", background: "#F0FAF6", color: "#0F6E56", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "center", lineHeight: 1.4, opacity: submittingCheckin ? 0.6 : 1 }}>
                      <div style={{ fontSize: 18, marginBottom: 3 }}>💪</div>Feeling strong
                    </button>
                    <button type="button" disabled={submittingCheckin} onClick={() => { void submitCheckin("low"); }}
                      style={{ padding: "10px 6px", borderRadius: 10, border: "0.5px solid #D3D1C7", background: "#F5F5F2", color: "#5F5E5A", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "center", lineHeight: 1.4, opacity: submittingCheckin ? 0.6 : 1 }}>
                      <div style={{ fontSize: 18, marginBottom: 3 }}>😴</div>Feeling tired
                    </button>
                    <button type="button" disabled={submittingCheckin} onClick={() => { void submitCheckin("hurt"); }}
                      style={{ padding: "10px 6px", borderRadius: 10, border: "0.5px solid #F09595", background: "#FEF5F5", color: "#791F1F", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "center", lineHeight: 1.4, opacity: submittingCheckin ? 0.6 : 1 }}>
                      <div style={{ fontSize: 18, marginBottom: 3 }}>🤕</div>Something&apos;s hurt
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* CARD 1b — READINESS RESULT BANNER */}
          {todayCheckin && (() => {
            const isStrong = todayCheckin === "strong";
            const isHurt   = todayCheckin === "hurt";
            return (
              <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: isStrong ? "0.5px solid #1D9E75" : "0.5px solid #EF9F27", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px 12px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, marginBottom: 8, background: isStrong ? "#E1F5EE" : "#FAEEDA", color: isStrong ? "#0F6E56" : "#633806" }}>
                    {isStrong ? "Ready to train" : "Rest day recommended"}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 4 }}>
                    {isStrong ? "You're good to go." : isHurt ? "Listen to your body today." : "Take it easy today."}
                  </div>
                  <div style={{ fontSize: 13, color: "#5F5E5A", lineHeight: 1.55 }}>
                    {isStrong
                      ? "Proceed with your full session plan. Your schedule is loaded below."
                      : isHurt
                        ? "Pain is important information. Skip the ARX and Katalyst today. Your recovery stack below will help."
                        : "Skip the ARX and Katalyst. Your recovery stack below is still worth doing — sauna and Vasper will help you feel better and protect your progress."}
                  </div>
                </div>
                <div style={{ padding: "0 16px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!isStrong && !showRestPlan && (
                    <button type="button" onClick={() => setShowRestPlan(true)}
                      style={{ padding: "9px 14px", borderRadius: 10, background: "#1D9E75", color: "white", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                      See recovery options
                    </button>
                  )}
                  {isHurt && (
                    <a href={`mailto:dustin@theiso.club?subject=${encodeURIComponent("Request 1:1")}&body=${encodeURIComponent("Hi Dustin,\n\nI'd like to schedule a one-on-one assessment. I've been dealing with some pain and want to make sure I'm moving correctly before my next session.\n\nCould you find a time that works?\n\nThank you.")}`}
                      style={{ padding: "9px 14px", borderRadius: 10, background: "transparent", border: "0.5px solid #E5E5E0", color: "#5F5E5A", fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      Email Dustin →
                    </a>
                  )}
                  <button type="button" onClick={() => { setTodayCheckin(null); setShowRestPlan(false); }}
                    style={{ padding: "9px 14px", borderRadius: 10, background: "transparent", border: "0.5px solid #E5E5E0", color: "#5F5E5A", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                    Change
                  </button>
                </div>
              </div>
            );
          })()}

          {/* CARD 2a — SESSION CARD (strong) */}
          {todayCheckin === "strong" && (() => {
            const todayIsoSC  = payload.checklistCompletions.todayDate;
            const weekStartSC = payload.checklistCompletions.weekStartDate;
            const rawDiff     = Math.round((new Date(todayIsoSC + "T00:00:00").getTime() - new Date(weekStartSC + "T00:00:00").getTime()) / 86400000);
            const currentDow  = Math.max(1, Math.min(7, rawDiff + 1));

            // Use weekPlan (from API) if available, fall back to payload.protocol.days
            // Both have the same shape for navigation purposes.
            // protocol.days activities lack steps/whyItMatters but that's acceptable.
            type NavDay = {
              id: string;
              dayOfWeek: number;
              dayName: string;
              dayTheme: string;
              activities: Array<{
                id: string; type: string; name: string;
                durationMinutes: number; isOptional: boolean;
                coldPlunge?: string | null;
                steps?: string[]; whyItMatters?: string;
                isBookable?: boolean; bookingUrl?: string | null;
                alternativeActivity?: string | null;
              }>;
            };

            const planDays: NavDay[] = weekPlan.length > 0
              ? weekPlan
              : (payload.protocol.days ?? []).map((d) => ({
                  id: d.id,
                  dayOfWeek: d.dayOfWeek,
                  dayName: d.dayName,
                  dayTheme: d.dayTheme,
                  activities: d.activities.map((a) => ({
                    id: a.id, type: a.type, name: a.name,
                    durationMinutes: a.durationMinutes,
                    isOptional: a.isOptional,
                    coldPlunge: a.coldPlunge ?? null,
                  })),
                }));

            // No protocol assigned at all
            if (planDays.length === 0 && weekPlanLoaded) {
              const tp = payload.todaysPlan;
              if (!tp || !tp.hasProtocol) {
                return (
                  <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: "0.5px solid #E5E5E0", padding: "20px 16px" }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>Your plan is being set up</div>
                    <div style={{ fontSize: 13, color: "#888780", lineHeight: 1.55, marginBottom: 14 }}>
                      Dustin will assign your protocol after your first session.
                    </div>
                    <a href="https://theiso.club/book" target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", padding: "10px 16px", borderRadius: 10, background: "#1D9E75", color: "white", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                      Book your first session →
                    </a>
                  </div>
                );
              }
            }

            // Loading (neither source ready yet)
            if (planDays.length === 0) {
              return (
                <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: "0.5px solid #E5E5E0", padding: "20px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#888780" }}>Loading your session plan…</div>
                </div>
              );
            }

            const navDays  = planDays.filter((d) => d.dayOfWeek >= currentDow);
            const activeDow   = sessionCardDow ?? (navDays[0]?.dayOfWeek ?? currentDow);
            const viewingDay  = planDays.find((d) => d.dayOfWeek === activeDow) ?? navDays[0] ?? planDays[0];
            if (!viewingDay) return null;
            const navIdx  = navDays.findIndex((d) => d.dayOfWeek === activeDow);
            const canBack = navIdx > 0;
            const canFwd  = navIdx < navDays.length - 1;
            function isoForDowSC(dow: number): string {
              const base = new Date(weekStartSC + "T00:00:00");
              base.setDate(base.getDate() + (dow - 1));
              return base.toISOString().slice(0, 10);
            }
            const dayIso  = isoForDowSC(viewingDay.dayOfWeek);
            const isDone  = sessionCardCompleted[viewingDay.id]
              || payload.arxSessions.some((s) => s.sessionDate.slice(0, 10) === dayIso)
              || payload.carolSessions.some((s) => s.sessionDate.slice(0, 10) === dayIso);
            const required = viewingDay.activities.filter((a) => !a.isOptional);
            const actTypes = [...new Set(required.map((a) => {
              if (a.type === "strength") return "Strength";
              if (a.type === "cardio")   return "Cardio";
              if (a.type === "recovery") return "Recovery";
              if (a.type === "coaching") return "Coaching";
              return a.type.charAt(0).toUpperCase() + a.type.slice(1);
            }))];
            const totalDur = required.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
            const subtitle = `${actTypes.join(" · ")} · ~${totalDur} min`;
            const isToday   = viewingDay.dayOfWeek === currentDow;
            const DOW_NAMES = ["","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
            const cardLabel = isToday ? "Today's session" : `${DOW_NAMES[viewingDay.dayOfWeek]}'s session`;
            // Icon background based on coldPlunge field (from DB) — matches mockup spec:
            //   RECOMMENDED        → blue fill
            //   OPTIONAL_CONTRAST  → blue dashed outline, no fill
            //   OPTIONAL_CARDIO    → blue dashed outline, no fill
            //   null (core)        → warm gray fill
            function icoStyle(coldPlunge: string | null, type: string): React.CSSProperties {
              const cp = (coldPlunge ?? "").toUpperCase();
              if (cp === "RECOMMENDED") return { background: "#E6F1FB", border: "0.5px solid #B5D4F4" };
              if (cp === "OPTIONAL_CONTRAST" || cp === "OPTIONAL_CARDIO") return { background: "transparent", border: "0.5px dashed #B5D4F4" };
              if (type === "recovery") return { background: "#E6F1FB", border: "0.5px solid #D1E8F5" };
              return { background: "#F1EFE8" };
            }
            function actIcon(act: { type: string; name: string }): string {
              const n = act.name.toLowerCase();
              if (n.includes("cold") || n.includes("plunge")) return "🧊";
              if (n.includes("arx") || n.includes("strength") || n.includes("full body")) return "🏋";
              if (n.includes("carol") || n.includes("zone 2") || n.includes("bike") || n.includes("rehit") || n.includes("fat burn") || n.includes("norwegian")) return "🚴";
              if (n.includes("compression") || n.includes("boots")) return "🦵";
              if (n.includes("sauna") || n.includes("infrared")) return "🌡";
              if (n.includes("vasper")) return "💧";
              if (n.includes("katalyst") || n.includes("ems")) return "⚡";
              if (n.includes("proteus")) return "🔄";
              if (act.type === "coaching") return "👤";
              return "●";
            }
            async function handleMarkComplete() {
              if (isDone) return;
              setSessionCardCompleted((prev) => ({ ...prev, [viewingDay.id]: true }));
              setCheckedDayIds((prev) => ({ ...prev, [viewingDay.id]: true }));
              const toAdd = required.map((a): { type: "arx" | "carol" | "recovery"; subtype: string } | null => {
                const n = a.name.toLowerCase();
                if (a.type === "strength") return { type: "arx", subtype: "manual_checkin" };
                if (a.type === "cardio") {
                  if (n.includes("rehit")) return { type: "carol", subtype: "REHIT" };
                  if (n.includes("norwegian") || n.includes("4x4")) return { type: "carol", subtype: "FAT_BURN_60" };
                  if (n.includes("zone 2") || n.includes("free ride")) return { type: "carol", subtype: "FAT_BURN_30" };
                  return { type: "carol", subtype: "FAT_BURN_45" };
                }
                if (a.type === "recovery") {
                  if (n.includes("cold")) return { type: "recovery", subtype: "cold_plunge" };
                  if (n.includes("sauna") || n.includes("infrared")) return { type: "recovery", subtype: "infrared_sauna" };
                  if (n.includes("compression")) return { type: "recovery", subtype: "compression" };
                }
                return null;
              }).filter((x): x is { type: "arx" | "carol" | "recovery"; subtype: string } => x !== null);
              try {
                if (toAdd.length > 0) {
                  await fetch("/api/member/activity-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_add: toAdd, to_remove: [], bonus: [] }) });
                  const c = payload.checklistCompletions;
                  for (const item of toAdd) {
                    if (item.type === "arx") c.arxWeekDates.push(dayIso);
                    else if (item.type === "carol") c.carolWeekTypes.push(item.subtype);
                    else if (item.type === "recovery") c.recoveryWeekModalities.push(item.subtype);
                  }
                }
              } catch { /* optimistic */ }
            }
            return (
              <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: "0.5px solid #E5E5E0", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid #E5E5E0" }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cardLabel}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button type="button" disabled={!canBack}
                      onClick={() => { if (canBack) { setSessionCardDow(navDays[navIdx - 1]!.dayOfWeek); setExpandedActivityId(null); } }}
                      style={{ width: 28, height: 28, borderRadius: 8, border: "0.5px solid #E5E5E0", background: canBack ? "#FAFAF8" : "#F5F5F2", display: "flex", alignItems: "center", justifyContent: "center", cursor: canBack ? "pointer" : "default", fontSize: 14, color: canBack ? "#5F5E5A" : "#C8C7C2", opacity: canBack ? 1 : 0.35 }}>←</button>
                    <span style={{ fontSize: 12, color: "#888780", minWidth: 70, textAlign: "center" }}>{DOW_NAMES[viewingDay.dayOfWeek]}</span>
                    <button type="button" disabled={!canFwd}
                      onClick={() => { if (canFwd) { setSessionCardDow(navDays[navIdx + 1]!.dayOfWeek); setExpandedActivityId(null); } }}
                      style={{ width: 28, height: 28, borderRadius: 8, border: "0.5px solid #E5E5E0", background: canFwd ? "#FAFAF8" : "#F5F5F2", display: "flex", alignItems: "center", justifyContent: "center", cursor: canFwd ? "pointer" : "default", fontSize: 14, color: canFwd ? "#5F5E5A" : "#C8C7C2", opacity: canFwd ? 1 : 0.35 }}>→</button>
                  </div>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 17, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>{viewingDay.dayTheme || viewingDay.dayName}</div>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 14 }}>{subtitle}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                    {required.map((act) => {
                      const isExpanded = expandedActivityId === act.id;
                      const hasDetail  = (act.steps && act.steps.length > 0) || !!act.whyItMatters;
                      return (
                        <div key={act.id}>
                          <div
                            role={hasDetail ? "button" : undefined}
                            tabIndex={hasDetail ? 0 : undefined}
                            onClick={() => hasDetail && setExpandedActivityId(isExpanded ? null : act.id)}
                            onKeyDown={(e) => hasDetail && e.key === " " && setExpandedActivityId(isExpanded ? null : act.id)}
                            style={{ display: "flex", alignItems: "center", gap: 10, cursor: hasDetail ? "pointer" : "default" }}
                          >
                            <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, ...icoStyle(act.coldPlunge ?? null, act.type) }}>
                              {actIcon(act)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: "#1a1a1a" }}>{act.name}{act.isOptional && <span style={{ marginLeft: 5, fontSize: 10, color: "#888780" }}>optional</span>}</div>
                              {act.durationMinutes > 0 && <div style={{ fontSize: 11, color: "#888780" }}>{act.durationMinutes} min</div>}
                            </div>
                            {hasDetail && <span style={{ fontSize: 12, color: "#888780", transform: isExpanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.14s" }}>›</span>}
                          </div>
                          {isExpanded && (
                            <div style={{ paddingLeft: 40, paddingTop: 8, paddingBottom: 4 }}>
                              {act.whyItMatters && <p style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.6, margin: "0 0 8px 0" }}>{act.whyItMatters}</p>}
                              {act.steps && act.steps.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                  {act.steps.map((step, si) => (
                                    <div key={si} style={{ display: "flex", gap: 8 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", minWidth: 16, marginTop: 2 }}>{si + 1}</span>
                                      <span style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.55 }}>{step}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {isToday && (
                      <button type="button" onClick={() => { void handleMarkComplete(); }} disabled={isDone}
                        style={{ flex: 1, padding: "11px", borderRadius: 10, background: isDone ? "#E1F5EE" : "#1D9E75", color: isDone ? "#0F6E56" : "white", border: isDone ? "0.5px solid #1D9E75" : "none", fontSize: 13, fontWeight: 500, cursor: isDone ? "default" : "pointer", transition: "all 0.15s" }}>
                        {isDone ? "✓ Completed" : "Mark as complete"}
                      </button>
                    )}
                    <button type="button" onClick={() => setMemberSection("protocol")}
                      style={{ padding: "11px 14px", borderRadius: 10, background: "transparent", border: "0.5px solid #E5E5E0", color: "#5F5E5A", fontSize: 13, fontWeight: 500, cursor: "pointer", ...(isToday ? {} : { flex: 1 }) }}>
                      Full plan
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* CARD 2b — REST STACK */}
          {(todayCheckin === "low" || todayCheckin === "hurt") && showRestPlan && (
            <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: "0.5px solid #E5E5E0", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #E5E5E0" }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recovery options for today</div>
              </div>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 17, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>Rest day stack</div>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 14 }}>No ARX or Katalyst today — just recovery</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { e: "🌡", name: "Infrared sauna",   note: "Heat stress supports recovery",  dur: 20, opt: false },
                    { e: "💧", name: "Vasper",            note: "Reduces cortisol, aids repair",  dur: 20, opt: false },
                    { e: "🧊", name: "Cold plunge",       note: "Contrast therapy after sauna",   dur: null, opt: true  },
                    { e: "🦵", name: "Compression boots", note: "Lymphatic support",              dur: 15, opt: false },
                  ].map((item) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, ...(item.opt ? { border: "0.5px dashed #B5D4F4", background: "transparent" } : { background: "#E6F1FB" }) }}>
                        {item.e}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: "#1a1a1a" }}>{item.name}{item.opt && <span style={{ marginLeft: 5, fontSize: 10, color: "#888780" }}>optional</span>}</div>
                        <div style={{ fontSize: 11, color: "#888780" }}>{item.note}{item.dur ? ` · ${item.dur} min` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CARD 3 — BOOKING */}
          {(() => {
            const next = payload.bookings[0] ?? null;
            const isBooked = !!next && next.status !== "cancelled";
            let timeStr = "", dateStr = "";
            if (next?.scheduledAt) {
              const d = new Date(next.scheduledAt);
              timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
            } else if (next?.label) { dateStr = next.label; }
            return (
              <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: "0.5px solid #E5E5E0", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Next booking</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>{isBooked ? `${timeStr} booked` : "Not booked"}</div>
                  {dateStr && <div style={{ fontSize: 12, color: "#888780", marginTop: 1 }}>{dateStr}</div>}
                </div>
                <a href="https://theiso.club/book" target="_blank" rel="noreferrer"
                  style={{ padding: "9px 14px", borderRadius: 10, textDecoration: "none", fontSize: 12, fontWeight: 500, flexShrink: 0, ...(isBooked ? { background: "#F1EFE8", border: "0.5px solid #D3D1C7", color: "#5F5E5A" } : { background: "#F0FAF6", border: "0.5px solid #1D9E75", color: "#0F6E56" }) }}>
                  {isBooked ? "Manage ↗" : "Book now ↗"}
                </a>
              </div>
            );
          })()}

          {/* CARD 4 — WEEKLY PROGRESS */}
          {(() => {
            const weekStartWP    = payload.checklistCompletions.weekStartDate;
            const todayIsoWP     = payload.checklistCompletions.todayDate;
            // Use weekPlan if loaded, otherwise fall back to payload.protocol.days
            // (same source the session card uses so IDs and completion state stay in sync)
            const allDaysWP = weekPlan.length > 0
              ? weekPlan
              : (payload.protocol.days ?? []).map((d) => ({
                  id: d.id, dayOfWeek: d.dayOfWeek,
                  dayName: d.dayName, dayTheme: d.dayTheme,
                  activities: d.activities,
                }));
            const trainingDaysWP = allDaysWP.filter((d) => !d.dayTheme.toLowerCase().includes("rest"));
            function isoForDowWP(dow: number): string {
              const base = new Date(weekStartWP + "T00:00:00"); base.setDate(base.getDate() + (dow - 1));
              return base.toISOString().slice(0, 10);
            }
            const currentDowWP = Math.max(1, Math.min(7,
              Math.round((new Date(todayIsoWP + "T00:00:00").getTime() - new Date(weekStartWP + "T00:00:00").getTime()) / 86400000) + 1
            ));
            function isDayDoneWP(dow: number, dayId: string): boolean {
              if (sessionCardCompleted[dayId] || checkedDayIds[dayId]) return true;
              const iso = isoForDowWP(dow);
              return payload.arxSessions.some((s) => s.sessionDate.slice(0, 10) === iso)
                  || payload.carolSessions.some((s) => s.sessionDate.slice(0, 10) === iso);
            }
            const completedWP = trainingDaysWP.filter((d) => isDayDoneWP(d.dayOfWeek, d.id)).length;
            const totalWP = trainingDaysWP.length;
            function mondayOf(iso: string): string {
              const d = new Date(iso + "T00:00:00"); const dow = d.getDay();
              d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
              return d.toISOString().slice(0, 10);
            }
            const activeWeeks = new Set<string>();
            for (const s of payload.arxSessions)  activeWeeks.add(mondayOf(s.sessionDate.slice(0, 10)));
            for (const s of payload.carolSessions) activeWeeks.add(mondayOf(s.sessionDate.slice(0, 10)));
            let streak = 0;
            const curMon = new Date(weekStartWP + "T00:00:00");
            while (activeWeeks.has(curMon.toISOString().slice(0, 10))) { streak++; curMon.setDate(curMon.getDate() - 7); }
            if (streak === 0 && completedWP > 0) streak = 1;
            return (
              <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px", border: "0.5px solid #E5E5E0", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>This week</div>
                  {streak > 0 && <div style={{ fontSize: 11, color: "#0F6E56", fontWeight: 500 }}>{streak} week{streak !== 1 ? "s" : ""} consistent</div>}
                </div>
                {trainingDaysWP.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {trainingDaysWP.map((day) => {
                      const done = isDayDoneWP(day.dayOfWeek, day.id);
                      const isToday = day.dayOfWeek === currentDowWP;
                      return <div key={day.id} style={{ flex: 1, height: 6, borderRadius: 3, background: done ? "#1D9E75" : isToday ? "#9FE1CB" : "#F1EFE8", transition: "background 0.2s" }} />;
                    })}
                  </div>
                )}
                <div style={{ fontSize: 13, color: "#5F5E5A" }}>
                  <span style={{ fontWeight: 500, color: "#1a1a1a" }}>{completedWP} of {totalWP}</span> sessions complete this week
                </div>
              </div>
            );
          })()}

          {/* CARD 5 — COACH MESSAGE */}
          {(() => {
            if (unreadCount === 0 || messages.length === 0) return null;
            const memberId = payload.memberId ?? "";
            const unread = [...messages].reverse().find((m) => !m.read_at && m.sender_id !== memberId);
            if (!unread) return null;
            function relTime(iso: string): string {
              const diff = Date.now() - new Date(iso).getTime();
              const mins = Math.floor(diff / 60000); const hours = Math.floor(mins / 60);
              if (mins < 5) return "Just now";
              if (hours < 1) return `${mins}m ago`;
              if (hours < 4) return "This morning";
              if (hours < 20) return `${hours}h ago`;
              if (hours < 28) return "Yesterday";
              return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }
            return (
              <div style={{ background: "#FFFFFF", borderRadius: 16, margin: "8px 12px 24px", border: "0.5px solid #E5E5E0", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "0.5px solid #E5E5E0" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E1F5EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#0F6E56", flexShrink: 0 }}>D</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>Coach Dustin</div>
                    <div style={{ fontSize: 11, color: "#888780" }}>{relTime(unread.created_at)}</div>
                  </div>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75", flexShrink: 0 }} />
                </div>
                <div style={{ padding: "12px 16px", fontSize: 13, color: "#444441", lineHeight: 1.6 }}>
                  {unread.body.length > 160 ? unread.body.slice(0, 160) + "…" : unread.body}
                </div>
                <div style={{ padding: "0 16px 12px" }}>
                  <button type="button" onClick={() => setMemberSection("messages")}
                    style={{ width: "100%", padding: "9px", borderRadius: 10, border: "0.5px solid #E5E5E0", background: "#FAFAF8", fontSize: 13, color: "#5F5E5A", fontWeight: 500, cursor: "pointer", textAlign: "center" }}>
                    Reply
                  </button>
                </div>
              </div>
            );
          })()}

        </div>

        <div id="view-goals" className="content" style={{ display: "none" }}>
          <div className="sec-header"><div className="sec-title">My Goals</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}>
            {(["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const).map((goalType) => {
              const def = GOAL_DEFS[goalType];
              const prog = payload.goals.progress[goalType];
              const isActive = localGoals[goalType] ?? false;
              const isSaving = savingGoal === goalType;
              const color = goalStatusColor(prog.direction);
              const progTarget = (prog as { target?: number }).target ?? 0;
              const progCurrent = (prog as { current?: number }).current ?? 0;
              const barPct = goalType === "attendance" && progTarget > 0
                ? Math.min(100, (progCurrent / progTarget) * 100)
                : prog.direction === "positive" ? 80 : prog.direction === "neutral" ? 50 : prog.direction === "negative" ? 20 : 0;
              return (
                <div key={goalType} className="card" style={{ padding: "16px 18px", opacity: isActive ? 1 : 0.55 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{def.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{def.category}</div>
                    </div>
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => { void handleGoalToggle(goalType); }}
                      disabled={isSaving}
                      style={{ width: 44, height: 24, borderRadius: 12, background: isActive ? "#4A7C59" : "var(--bg3)", border: `2px solid ${isActive ? "#4A7C59" : "var(--border)"}`, cursor: "pointer", padding: 0, position: "relative", transition: "all 0.2s", flexShrink: 0, opacity: isSaving ? 0.5 : 1 }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: isActive ? 22 : 2, transition: "left 0.2s" }} />
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.55, marginBottom: 14 }}>{def.description}</p>
                  {isActive && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color }}>{goalStatusLabel(prog.status)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>{prog.display}</div>
                      <div style={{ height: 4, background: "var(--bg2)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barPct}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {/* Protocol recommendation */}
          {(() => {
            const active = Object.entries(localGoals).filter(([, v]) => v).map(([k]) => k);
            const rec = recommendProtocol(active);
            if (!rec || active.length === 0) return null;
            const reason = PROTOCOL_REASONS[rec] ?? "Matched to your current goal combination.";
            async function handleAskCoach() {
              if (isRequestingProtocol || protocolRequested) return;
              setIsRequestingProtocol(true);
              try {
                let resolvedPeerId = peerId;
                if (!resolvedPeerId) {
                  const inbox = await getJson<{ peer?: { id?: string }; coach?: { id?: string } }>("/api/messages/inbox");
                  resolvedPeerId = String(inbox.peer?.id || inbox.coach?.id || "");
                }
                if (!resolvedPeerId) throw new Error("no peer");
                const goalNames = active.map((g) => GOAL_DEFS[g]?.name ?? g).join(", ");
                await postJson("/api/messages/send", {
                  recipient_id: resolvedPeerId,
                  body: `Hi Dustin — the dashboard is recommending the ${rec} protocol based on my current goals (${goalNames}). Could you assign this when you have a chance? Thanks!`,
                });
                setProtocolRequested(true);
              } catch { /* silent */ } finally { setIsRequestingProtocol(false); }
            }
            return (
              <div style={{ background: "rgba(74,124,89,0.06)", border: "1px solid rgba(74,124,89,0.22)", borderRadius: "var(--r)", padding: "18px 20px" }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(157,204,58,0.7)", marginBottom: 8 }}>Protocol Recommendation</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                  Based on your goals, we recommend: <span style={{ color: "#4A7C59" }}>{rec}</span>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.6, margin: "0 0 14px 0" }}>{reason}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {protocolRequested ? (
                    <span style={{ fontSize: 12, color: "#4A7C59", fontWeight: 500 }}>✓ Request sent to Dustin</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-lime btn-sm"
                      disabled={isRequestingProtocol}
                      onClick={() => { void handleAskCoach(); }}
                      style={{ fontSize: 12 }}
                    >
                      {isRequestingProtocol ? "Sending…" : "Ask coach to assign this protocol"}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setMemberSection("protocol")}>
                    View current protocol →
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        <div id="view-protocol" className="content" style={{ display: mode === "member" && memberView === "protocol" ? "block" : "none" }}>
          {(() => {
            const p = payload.protocol;
            const contrastPref = payload.contrastTherapyPreference || "no_preference";
            const hasProtocol = !!p.name;
            const tierKey = normalizeProtocolTier(p.tier);
            const firstName = greetingName;

            // ── Helpers ───────────────────────────────────────────────────
            // "Next session" calculation from protocol days
            const todayDow = new Date().getDay(); // 0=Sun…6=Sat
            const trainingDays = p.days.filter((d) => d.activities.some((a) => !a.isOptional));
            const nextDayIdx = (() => {
              if (!trainingDays.length) return null;
              // Find first training day after today (dow 1=Mon…7=Sun in DB)
              const after = trainingDays.find((d) => d.dayOfWeek > (todayDow === 0 ? 7 : todayDow));
              return after ? after.dayOfWeek : trainingDays[0].dayOfWeek;
            })();

            // Equipment tag style
            function activityTagStyle(coldPlunge: string | null, isOptional: boolean): React.CSSProperties {
              if (coldPlunge === "RECOMMENDED") return { background: "rgba(85,184,240,0.18)", border: "1px solid rgba(85,184,240,0.6)", color: "#55b8f0" };
              if (coldPlunge === "OPTIONAL_CONTRAST" || coldPlunge === "OPTIONAL_CARDIO") return { background: "transparent", border: "1px dashed rgba(85,184,240,0.45)", color: "#55b8f0" };
              if (coldPlunge === "NEVER") return { background: "rgba(240,112,85,0.12)", border: "1px solid rgba(240,112,85,0.4)", color: "#f07055" };
              if (isOptional) return { background: "transparent", border: "1px dashed rgba(255,255,255,0.18)", color: "var(--text3)" };
              return { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text2)" };
            }

            function equipKey(type: string, name: string): EquipmentKey | null {
              const t = type.toLowerCase(); const n = name.toLowerCase();
              if (t === "strength" && n.includes("arx")) return "arx";
              if (t === "cardio" && n.includes("carol")) return "carol";
              if (t === "cardio" && (n.includes("zone 2") || n.includes("zone2"))) return "zone2";
              if (n.includes("cold plunge") || n.includes("cold")) return "cold_plunge";
              if (n.includes("infrared sauna") || n.includes("infrared")) return "infrared_sauna";
              if (n.includes("katalyst") || n.includes("ems")) return "katalyst";
              if (n.includes("vasper")) return "vasper";
              if (n.includes("proteus")) return "proteus";
              if (n.includes("nxpro") || n.includes("red light") || n.includes("nx pro")) return "nxpro";
              if (n.includes("compression")) return "compression";
              if (t === "mobility" || n.includes("mobility")) return "mobility";
              if (n.includes("sauna") && !n.includes("infrared")) return "infrared_sauna";
              return null;
            }

            // ── Change Protocol screen ────────────────────────────────────
            if (showChangeProtocol) {
              if (confirmProtocol) {
                const opt = CHOOSE_PROTOCOL_OPTIONS.find((o) => o.key === confirmProtocol)!;
                return (
                  <div style={{ maxWidth: 480 }}>
                    <button type="button" onClick={() => setConfirmProtocol(null)}
                      style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12, padding: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
                      ← Back
                    </button>
                    <div className="card" style={{ padding: "28px 24px" }}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 10 }}>Confirm switch</div>
                      <div style={{ fontSize: 22, fontFamily: "var(--serif)", color: "var(--text)", marginBottom: 6 }}>{confirmProtocol}</div>
                      <div style={{ fontSize: 13, color: "var(--lime)", marginBottom: 12, fontStyle: "italic" }}>{opt.headline}</div>
                      <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 20px 0" }}>{opt.description}</p>
                      <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "12px 14px", marginBottom: 24, border: "1px solid var(--border)" }}>
                        <p style={{ fontSize: 12, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>We recommend staying on a protocol for a few weeks to see results.</p>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        {switchProtocolSent ? (
                          <span style={{ fontSize: 13, color: "var(--lime)", fontWeight: 500 }}>✓ Request sent to your coach</span>
                        ) : (
                          <>
                            <button type="button" className="btn btn-lime" disabled={switchingProtocol}
                              onClick={() => {
                                if (switchingProtocol) return;
                                setSwitchingProtocol(true);
                                void (async () => {
                                  try {
                                    let resolvedPeerId = peerId;
                                    if (!resolvedPeerId) {
                                      const inbox = await getJson<{ peer?: { id?: string }; coach?: { id?: string } }>("/api/messages/inbox");
                                      resolvedPeerId = String(inbox.peer?.id || inbox.coach?.id || "");
                                    }
                                    if (resolvedPeerId) await postJson("/api/messages/send", { recipient_id: resolvedPeerId, body: `Hi — I'd like to switch to the ${confirmProtocol} protocol. Could you update this when you have a chance? Thanks!` });
                                    setSwitchProtocolSent(true);
                                  } catch { /* silent */ } finally { setSwitchingProtocol(false); }
                                })();
                              }} style={{ fontSize: 13 }}>
                              {switchingProtocol ? "Sending…" : `Confirm Switch to ${confirmProtocol}`}
                            </button>
                            <button type="button" className="btn" onClick={() => { setConfirmProtocol(null); setSwitchProtocolSent(false); }} style={{ fontSize: 13 }}>Cancel</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div style={{ maxWidth: 520 }}>
                  <button type="button" onClick={() => { setShowChangeProtocol(false); setSwitchProtocolSent(false); setConfirmProtocol(null); }}
                    style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12, padding: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
                    ← Back to Protocol
                  </button>
                  <div style={{ fontSize: 20, fontFamily: "var(--serif)", color: "var(--text)", marginBottom: 6 }}>Choose Your Focus</div>
                  <p style={{ fontSize: 13, color: "var(--text3)", margin: "0 0 24px 0", lineHeight: 1.6 }}>Select the protocol that fits where you are right now.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {CHOOSE_PROTOCOL_OPTIONS.map((opt) => {
                      const isCurrent = opt.key === p.name;
                      return (
                        <button key={opt.key} type="button" onClick={() => { if (!isCurrent) setConfirmProtocol(opt.key); }}
                          style={{ background: isCurrent ? "rgba(201,240,85,0.06)" : "var(--bg3)", border: `1px solid ${isCurrent ? "rgba(201,240,85,0.3)" : "var(--border2)"}`, borderRadius: "var(--r)", padding: "18px 20px", textAlign: "left", cursor: isCurrent ? "default" : "pointer", width: "100%" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{opt.key}</div>
                            {isCurrent && <span style={{ fontSize: 10, background: "rgba(201,240,85,0.12)", color: "var(--lime)", border: "1px solid rgba(201,240,85,0.3)", borderRadius: 4, padding: "2px 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Current</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--lime)", marginBottom: 6, fontStyle: "italic" }}>{opt.headline}</div>
                          <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.6 }}>{opt.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // ── No protocol assigned ──────────────────────────────────────
            if (!hasProtocol) {
              return (
                <div style={{ maxWidth: 460 }}>
                  <div style={{ fontSize: 24, fontFamily: "var(--serif)", color: "var(--text)", marginBottom: 8, lineHeight: 1.2 }}>Your plan is being prepared</div>
                  <p style={{ fontSize: 13.5, color: "var(--text3)", lineHeight: 1.7, margin: 0 }}>Dustin will assign your protocol after your first session.</p>
                </div>
              );
            }

            // ── SUMMARY CARD ──────────────────────────────────────────────
            const goalLine = deriveGoalLine(payload.goals.activeGoals);
            const tierLabel = PROTOCOL_TIER_LABELS[tierKey ?? "longevity"] ?? p.tier;
            const avgDuration = (() => {
              const trainingDaysAll = p.days.filter((d) => d.activities.some((a) => !a.isOptional));
              if (!trainingDaysAll.length) return null;
              const totalMins = trainingDaysAll.reduce((sum, d) => sum + d.activities.filter((a) => !a.isOptional).reduce((s, a) => s + a.durationMinutes, 0), 0);
              return Math.round(totalMins / trainingDaysAll.length);
            })();
            const saunaPerWeek = p.days.reduce((sum, d) => sum + d.activities.filter((a) => a.name.toLowerCase().includes("sauna") && !a.isOptional).length, 0);

            // ── WHY ITEMS (filtered) ──────────────────────────────────────
            const whyItems = (WHY_ITEMS[tierKey ?? "longevity"] ?? []).filter((item) => {
              if (item.showIf) return false; // no health conditions in payload yet — skip conditional
              if (item.showIfInjury) return false;
              return true;
            });

            // ── SESSION RATIONALE lookup ──────────────────────────────────
            const rationaleMap = SESSION_RATIONALE[tierKey ?? "longevity"] ?? {};

            return (
              <div style={{ maxWidth: 600 }}>
                {/* ── 1. Summary card ─────────────────────────────────── */}
                <div className="card" style={{ padding: "20px 20px 18px", marginBottom: 14 }}>
                  {/* Tier pill + coach label */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 11, background: tierKey === "healthspan_elite" ? "rgba(168,85,240,0.15)" : "rgba(201,240,85,0.1)", color: tierKey === "healthspan_elite" ? "#a855f0" : "var(--lime)", border: `1px solid ${tierKey === "healthspan_elite" ? "rgba(168,85,240,0.4)" : "rgba(201,240,85,0.3)"}`, borderRadius: 20, padding: "3px 12px", fontWeight: 600, letterSpacing: "0.06em" }}>
                      {tierLabel}{p.daysPerWeek ? ` · ${p.daysPerWeek} days / week` : ""}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Coach Dustin</span>
                  </div>

                  {/* Heading */}
                  <div style={{ fontSize: 22, fontFamily: "var(--serif)", color: "var(--text)", marginBottom: 8, lineHeight: 1.2 }}>
                    {firstName}&apos;s protocol
                  </div>

                  {/* Goal line — only shown when goals are set */}
                  {goalLine && (
                    <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 14px 0", lineHeight: 1.6 }}>{goalLine}</p>
                  )}

                  {/* Coach note */}
                  {p.coachNotes && (
                    <div style={{ borderLeft: "3px solid rgba(196,131,26,0.5)", paddingLeft: 14, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(196,131,26,0.7)", marginBottom: 6 }}>A note from your coach</div>
                      <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.7, margin: "0 0 6px 0" }}>{p.coachNotes}</p>
                      <div style={{ fontSize: 11, color: "rgba(196,131,26,0.6)", fontStyle: "italic" }}>— Coach Dustin</div>
                    </div>
                  )}

                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                    {[
                      { label: "Days / week", value: p.daysPerWeek ? `${p.daysPerWeek}x` : "—" },
                      { label: "Avg session", value: avgDuration ? `${avgDuration} min` : "—" },
                      { label: "Sauna / week", value: saunaPerWeek > 0 ? `${saunaPerWeek}x` : "—" },
                    ].map((stat) => (
                      <div key={stat.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.3 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 2. Why this plan (collapsible) ──────────────────── */}
                {whyItems.length > 0 && (
                  <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
                    <button
                      type="button"
                      onClick={() => setWhyExpanded((v) => !v)}
                      style={{ width: "100%", background: "none", border: "none", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Why this plan for you</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>How your protocol was built</div>
                      </div>
                      <span style={{ fontSize: 18, color: "var(--text3)", transition: "transform 0.2s", transform: whyExpanded ? "rotate(180deg)" : "none" }}>›</span>
                    </button>
                    {whyExpanded && (
                      <div style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
                        <div style={{ height: 1, background: "var(--border)", marginBottom: 4 }} />
                        {whyItems.map((item) => (
                          <div key={item.id} style={{ display: "flex", gap: 14 }}>
                            <div style={{ fontSize: 20, lineHeight: "26px", flexShrink: 0, width: 28, textAlign: "center" }}>{item.icon}</div>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginBottom: 5 }}>{item.title}</div>
                              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, margin: 0 }}>{item.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 3. Weekly sessions ──────────────────────────────── */}
                {p.days.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 12 }}>Your weekly sessions</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {p.days.map((day, dayIdx) => {
                        const isNext = day.dayOfWeek === nextDayIdx;
                        const isOpen = expandedSessionDay === null ? isNext : expandedSessionDay === dayIdx;
                        const coreActs = day.activities.filter((a) => !a.isOptional);
                        const optActs = day.activities.filter((a) => a.isOptional);
                        const isRestDay = coreActs.length === 0;
                        const rationale = rationaleMap[day.dayTheme] ?? rationaleMap[day.dayName] ?? null;

                        // Cold plunge NEVER banner: any non-optional activity has coldPlunge=NEVER
                        const neverAct = coreActs.find((a) => a.coldPlunge === "NEVER");

                        // Filter cold plunge items based on contrastPref
                        const visibleCoreActs = coreActs.filter((a) => {
                          if (a.coldPlunge === "OPTIONAL_CONTRAST" && contrastPref === "cold_before_only") return false;
                          return true;
                        });

                        return (
                          <div key={day.id} style={{ background: "var(--bg2)", border: `1px solid ${isNext ? "rgba(201,240,85,0.3)" : "var(--border)"}`, borderRadius: "var(--r)", overflow: "hidden" }}>
                            {/* Day header — always visible */}
                            <button
                              type="button"
                              onClick={() => setExpandedSessionDay(isOpen ? -1 : dayIdx)}
                              style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
                            >
                              {/* Day circle */}
                              <div style={{ width: 32, height: 32, borderRadius: "50%", background: isNext ? "var(--lime)" : "var(--bg3)", border: `1px solid ${isNext ? "var(--lime)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isNext ? "#0b0c09" : "var(--text3)" }}>{dayIdx + 1}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{day.dayTheme || day.dayName}</span>
                                  {isNext && <span style={{ fontSize: 9, background: "rgba(201,240,85,0.15)", color: "var(--lime)", border: "1px solid rgba(201,240,85,0.4)", borderRadius: 20, padding: "2px 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>Next session</span>}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{day.dayName}{isRestDay ? " · Rest" : ""}</div>
                              </div>
                              <span style={{ fontSize: 16, color: "var(--text3)", transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "none", flexShrink: 0 }}>›</span>
                            </button>

                            {/* Expanded content */}
                            {isOpen && !isRestDay && (
                              <div style={{ padding: "0 16px 16px" }}>
                                <div style={{ height: 1, background: "var(--border)", marginBottom: 14 }} />

                                {/* Session rationale banner */}
                                {rationale && (
                                  <div style={{ background: "rgba(201,240,85,0.07)", border: "1px solid rgba(201,240,85,0.2)", borderRadius: "var(--r-sm)", padding: "10px 14px", marginBottom: 14 }}>
                                    <p style={{ fontSize: 12.5, color: "var(--text2)", margin: 0, lineHeight: 1.65 }}>{rationale}</p>
                                  </div>
                                )}

                                {/* Equipment items */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                  {visibleCoreActs.map((act) => {
                                    const key = equipKey(act.type, act.name);
                                    const note = key ? EQUIPMENT_NOTES[key] ?? null : null;
                                    const tagStyle = activityTagStyle(act.coldPlunge, false);
                                    const badge = act.coldPlunge === "RECOMMENDED" ? "Recommended"
                                      : (act.coldPlunge === "OPTIONAL_CONTRAST" || act.coldPlunge === "OPTIONAL_CARDIO") ? "Optional"
                                      : null;
                                    return (
                                      <div key={act.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", ...tagStyle }}>
                                          <span style={{ fontSize: 14 }}>
                                            {act.coldPlunge === "RECOMMENDED" || act.coldPlunge === "OPTIONAL_CONTRAST" || act.coldPlunge === "OPTIONAL_CARDIO" ? "❄️"
                                              : act.coldPlunge === "NEVER" ? "⛔"
                                              : act.type === "strength" ? "💪"
                                              : act.type === "cardio" ? "❤️"
                                              : act.type === "mobility" ? "🧘"
                                              : act.type === "recovery" ? "♻️"
                                              : "•"}
                                          </span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{act.name}</span>
                                            {act.durationMinutes > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{act.durationMinutes} min</span>}
                                            {badge && (
                                              <span style={{ fontSize: 9, color: badge === "Recommended" ? "#55b8f0" : "var(--text3)", border: `1px solid ${badge === "Recommended" ? "rgba(85,184,240,0.4)" : "var(--border)"}`, borderRadius: 3, padding: "1px 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>{badge}</span>
                                            )}
                                          </div>
                                          {note && <p style={{ fontSize: 12, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>{note}</p>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Cold plunge NEVER banner */}
                                {neverAct && (
                                  <div style={{ background: "rgba(240,112,85,0.07)", border: "1px solid rgba(240,112,85,0.25)", borderRadius: "var(--r-sm)", padding: "10px 14px", marginTop: 14 }}>
                                    <p style={{ fontSize: 12.5, color: "#f07055", margin: 0, lineHeight: 1.65 }}>
                                      {COLD_PLUNGE_RULES["NEVER" as ColdPlungePosition]}
                                    </p>
                                  </div>
                                )}

                                {/* Optional add-ons */}
                                {optActs.length > 0 && (
                                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>Optional add-ons</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                      {optActs.map((act) => (
                                        <span key={act.id} style={{ fontSize: 12, padding: "5px 11px", borderRadius: "var(--r-sm)", ...activityTagStyle(act.coldPlunge, true) }}>
                                          {act.name}{act.durationMinutes > 0 ? ` · ${act.durationMinutes}m` : ""}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {isOpen && isRestDay && (
                              <div style={{ padding: "0 16px 14px" }}>
                                <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />
                                <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>Rest is not doing nothing. It is the session where your body actually builds the adaptations from this week&apos;s work.</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            );
          })()}
        </div>

        {/* ── Workout History ──────────────────────────────────────────── */}
        <div id="view-history" className="content" style={{ display: mode === "member" && (memberView as string) === "history" ? "block" : "none" }}>
          {(() => {
            // Load data when tab opens
            if ((memberView as string) === "history" && !historyLoaded && !historyLoadingMore) {
              setHistoryLoadingMore(true);
              void getJson<{ days: DayActivity[] }>("/api/member/activity-history?months=3")
                .then((r) => { setHistoryDays(r.days ?? []); setHistoryLoaded(true); })
                .catch(() => { setHistoryLoaded(true); })
                .finally(() => setHistoryLoadingMore(false));
            }

            const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const DOW_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];
            const today = new Date().toISOString().slice(0, 10);

            // Build day index from history data
            const dayIndex = new Map<string, DayActivity>();
            for (const d of historyDays) dayIndex.set(d.date, d);

            // Calendar grid for current view month
            const firstDay = new Date(historyViewYear, historyViewMonth, 1).getDay();
            const daysInMonth = new Date(historyViewYear, historyViewMonth + 1, 0).getDate();
            const firstDayMon = firstDay === 0 ? 6 : firstDay - 1;
            const cells: Array<{ date: string | null; dayNum: number | null }> = [];
            for (let i = 0; i < firstDayMon; i++) cells.push({ date: null, dayNum: null });
            for (let d = 1; d <= daysInMonth; d++) {
              const date = `${historyViewYear}-${String(historyViewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              cells.push({ date, dayNum: d });
            }

            const getActivityDots = (data: DayActivity | undefined): Array<{ color: string; label: string }> => {
              if (!data) return [];
              const dots: Array<{ color: string; label: string }> = [];
              if (data.arx.length > 0) dots.push({ color: "#4A7C59", label: "Strength" });
              if (data.carol.length > 0) dots.push({ color: "#C4831A", label: "Cardio" });
              if (data.recovery.length > 0) dots.push({ color: "#9B8EA0", label: "Recovery" });
              if (data.manual.length > 0 && dots.length < 3) dots.push({ color: "#6B9FD4", label: "Activity" });
              return dots.slice(0, 3);
            };

            const MODALITY_LABELS: Record<string, string> = { cold_plunge: "Cold plunge", sauna: "Sauna", compression: "Compression", infrared_sauna: "Infrared sauna", nxpro: "NxPro", vasper: "Vasper", quickboard: "Quickboard", katalyst: "Katalyst EMS", walk: "Walk", stretching: "Stretching", other_cardio: "Other cardio" };
            const RIDE_LABELS: Record<string, string> = { REHIT: "REHIT", FAT_BURN_30: "Fat Burn 30", FAT_BURN_45: "Fat Burn 45", FAT_BURN_60: "Fat Burn 60", ENERGISER: "Energiser" };

            const selectedData = historySelectedDate ? dayIndex.get(historySelectedDate) : null;
            const totalDaysWithActivity = historyDays.length;

            return (
              <>
                <div className="sec-header">
                  <div className="sec-title">History</div>
                  {totalDaysWithActivity > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{totalDaysWithActivity} active days</div>
                  )}
                </div>

                {historyLoadingMore && !historyLoaded ? (
                  <div className="card"><div className="card-body" style={{ color: "var(--text3)", fontSize: 13 }}>Loading history…</div></div>
                ) : (
                  <>
                    {/* Calendar */}
                    <div className="card" style={{ marginBottom: 14 }}>
                      {/* Month navigation */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px 12px" }}>
                        <button type="button" style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 18, padding: "0 8px" }}
                          onClick={() => { const d = new Date(historyViewYear, historyViewMonth - 1, 1); setHistoryViewMonth(d.getMonth()); setHistoryViewYear(d.getFullYear()); setHistorySelectedDate(null); }}>‹</button>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{MONTHS[historyViewMonth]} {historyViewYear}</div>
                        <button type="button" style={{ background: "none", border: "none", color: new Date(historyViewYear, historyViewMonth + 1) > new Date() ? "var(--text3)" : "var(--text3)", cursor: "pointer", fontSize: 18, padding: "0 8px" }}
                          onClick={() => { const d = new Date(historyViewYear, historyViewMonth + 1, 1); if (d <= new Date()) { setHistoryViewMonth(d.getMonth()); setHistoryViewYear(d.getFullYear()); setHistorySelectedDate(null); } }}>›</button>
                      </div>

                      {/* Day of week headers */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 12px 6px" }}>
                        {DOW_LABELS.map((d) => (
                          <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--text3)", fontWeight: 600, letterSpacing: "0.05em" }}>{d}</div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, padding: "0 12px 14px" }}>
                        {cells.map((cell, i) => {
                          if (!cell.date || !cell.dayNum) return <div key={i} />;
                          const data = dayIndex.get(cell.date);
                          const dots = getActivityDots(data);
                          const isToday = cell.date === today;
                          const isSelected = cell.date === historySelectedDate;
                          const hasActivity = dots.length > 0;
                          return (
                            <button key={cell.date} type="button"
                              onClick={() => setHistorySelectedDate(isSelected ? null : cell.date)}
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 2px", borderRadius: 8, background: isSelected ? "rgba(74,124,89,0.10)" : hasActivity ? "rgba(28,43,30,0.04)" : "transparent", border: isToday ? "1.5px solid rgba(74,124,89,0.38)" : isSelected ? "1.5px solid rgba(157,204,58,0.5)" : "1.5px solid transparent", cursor: "pointer", minHeight: 44 }}>
                              <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? "#4A7C59" : "var(--text2)" }}>{cell.dayNum}</span>
                              <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                                {dots.map((dot, di) => (
                                  <div key={di} style={{ width: 5, height: 5, borderRadius: "50%", background: dot.color }} />
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div style={{ display: "flex", gap: 14, padding: "0 20px 14px", flexWrap: "wrap" }}>
                        {[{ color: "#4A7C59", label: "Strength" }, { color: "#C4831A", label: "Cardio" }, { color: "#9B8EA0", label: "Recovery" }, { color: "#6B9FD4", label: "Activity" }].map(({ color, label }) => (
                          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
                            <span style={{ fontSize: 10, color: "var(--text3)" }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Day detail panel */}
                    {historySelectedDate && (
                      <div className="card" style={{ marginBottom: 14 }}>
                        <div style={{ padding: "14px 20px 4px" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
                            {new Date(historySelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                          </div>
                          {!selectedData ? (
                            <p style={{ fontSize: 13, color: "var(--text3)", margin: "0 0 14px 0" }}>Rest day — no sessions logged.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 14 }}>
                              {selectedData.arx.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4A7C59", marginBottom: 8 }}>Strength (ARX)</div>
                                  {selectedData.arx.map((a, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ fontSize: 13, color: "var(--text2)" }}>{a.exercise}</span>
                                      <div style={{ display: "flex", gap: 14 }}>
                                        {a.concentricMax != null && <span style={{ fontSize: 11, color: "var(--text3)" }}>Conc <b style={{ color: "var(--text)" }}>{Math.round(a.concentricMax)} lbs</b></span>}
                                        {a.eccentricMax != null && <span style={{ fontSize: 11, color: "var(--text3)" }}>Ecc <b style={{ color: "var(--text)" }}>{Math.round(a.eccentricMax)} lbs</b></span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {selectedData.carol.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4831A", marginBottom: 8 }}>Cardio (CAROL)</div>
                                  {selectedData.carol.map((c, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ fontSize: 13, color: "var(--text2)" }}>{RIDE_LABELS[c.rideType] ?? c.rideType.replace(/_/g, " ")}</span>
                                      <div style={{ display: "flex", gap: 14 }}>
                                        {c.manp != null && c.manp > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>MANP <b style={{ color: "var(--text)" }}>{Math.round(c.manp)}W</b></span>}
                                        {c.peakPower != null && c.peakPower > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>Peak <b style={{ color: "var(--text)" }}>{Math.round(c.peakPower)}W</b></span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {selectedData.recovery.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9B8EA0", marginBottom: 8 }}>Recovery</div>
                                  {selectedData.recovery.map((r, i) => (
                                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ fontSize: 13, color: "var(--text2)" }}>{MODALITY_LABELS[r.modality] ?? r.modality.replace(/_/g, " ")}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {selectedData.manual.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B9FD4", marginBottom: 8 }}>Activities</div>
                                  {selectedData.manual.map((m, i) => (
                                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ fontSize: 13, color: "var(--text2)" }}>{MODALITY_LABELS[m.equipment] ?? m.equipment.replace(/_/g, " ")}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Load more */}
                    {historyLoaded && historyDays.length === 0 && (
                      <div className="card"><div className="card-body"><p style={{ color: "var(--text3)" }}>No sessions logged yet. Start logging activities to see your history here.</p></div></div>
                    )}
                    {historyLoaded && (
                      <div style={{ textAlign: "center", marginTop: 4 }}>
                        <button type="button" className="btn btn-sm" style={{ fontSize: 11 }} disabled={historyLoadingMore}
                          onClick={async () => {
                            setHistoryLoadingMore(true);
                            try { const r = await getJson<{ days: DayActivity[] }>("/api/member/activity-history?months=12"); setHistoryDays(r.days ?? []); } catch { /* */ }
                            finally { setHistoryLoadingMore(false); }
                          }}>
                          {historyLoadingMore ? "Loading…" : "Load full year →"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* ── Progress Tab ─────────────────────────────────────────────────── */}
        <div id="view-progress" className="content" style={{ display: mode === "member" && memberView === "progress" ? "block" : "none" }}>
          {(() => {
            // ── Shared data ───────────────────────────────────────────────────────
            const allCarol = Array.isArray(payload.carolSessions) ? payload.carolSessions : [];

            // ── 1. Healthspan ─────────────────────────────────────────────────────
            const va = payload.vitalityAge;

            // ── 2. Body Composition ───────────────────────────────────────────────
            const currentScan = payload.scanHistory[0];
            const prevScan = payload.scanHistory[1];
            const scansAsc = [...payload.scanHistory].reverse();
            const leanSparkVals = scansAsc.map((s) => s.leanMassLbsRaw);
            const fatSparkVals = scansAsc.map((s) => s.bodyFatPctRaw);
            const wtSparkVals = scansAsc.map((s) => s.weightLbsRaw);
            const leanFirst = leanSparkVals.find((v) => v !== null) ?? null;
            const leanLast = [...leanSparkVals].reverse().find((v) => v !== null) ?? null;
            const fatFirst = fatSparkVals.find((v) => v !== null) ?? null;
            const fatLast = [...fatSparkVals].reverse().find((v) => v !== null) ?? null;
            const leanTrend = makeTrend(leanFirst !== null && leanLast !== null ? (leanLast >= leanFirst ? "up" : "down") : "none");
            const fatTrend = makeTrend(fatFirst !== null && fatLast !== null ? (fatLast <= fatFirst ? "down" : "up") : "none");
            // "last N months" label from actual scan date span
            const scanSparkTimeLabel = (() => {
              const oldest = scansAsc[0]?.scanDateRaw;
              const newest = scansAsc[scansAsc.length - 1]?.scanDateRaw;
              if (!oldest || !newest || oldest === newest) return null;
              const months = Math.round((new Date(newest).getTime() - new Date(oldest).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
              return months >= 1 ? `last ${months} month${months !== 1 ? "s" : ""}` : null;
            })();
            const scanMetrics: Array<{ label: string; value: string; raw: number | null; prevRaw: number | null; good: "up" | "down" | "neutral"; unit?: string }> = [
              { label: "Lean mass", value: payload.scan.leanMassLbs, raw: currentScan?.leanMassLbsRaw ?? null, prevRaw: prevScan?.leanMassLbsRaw ?? null, good: "up", unit: "lbs" },
              { label: "Body fat %", value: payload.scan.bodyFatPct, raw: currentScan?.bodyFatPctRaw ?? null, prevRaw: prevScan?.bodyFatPctRaw ?? null, good: "down", unit: "%" },
              { label: "Weight", value: payload.scan.weightLbs, raw: currentScan?.weightLbsRaw ?? null, prevRaw: prevScan?.weightLbsRaw ?? null, good: "neutral", unit: "lbs" },
              { label: "Fat mass", value: payload.scan.fatMassLbs, raw: currentScan?.fatMassLbsRaw ?? null, prevRaw: prevScan?.fatMassLbsRaw ?? null, good: "down", unit: "lbs" },
              { label: "Body shape", value: payload.scan.bodyShapeRating, raw: currentScan?.bodyShapeRatingRaw ?? null, prevRaw: prevScan?.bodyShapeRatingRaw ?? null, good: "up" },
              { label: "Waist", value: payload.scan.waistIn, raw: currentScan?.waistInRaw ?? null, prevRaw: prevScan?.waistInRaw ?? null, good: "down", unit: "\"" },
              { label: "Hips", value: payload.scan.hipsIn, raw: currentScan?.hipsInRaw ?? null, prevRaw: prevScan?.hipsInRaw ?? null, good: "down", unit: "\"" },
            ];

            // ── 3. Strength ───────────────────────────────────────────────────────
            const arxGroups = buildArxByExercise(payload.arxSessions);
            const arxNow = new Date();
            const arxMonthStart = new Date(arxNow.getFullYear(), arxNow.getMonth(), 1).toISOString().slice(0, 10);
            const arxSessionsThisMonth = payload.arxSessions.filter((s) => s.sessionDate >= arxMonthStart).length;
            const latestArxDate = payload.arxSessions[0]?.sessionDate?.slice(0, 10);
            const latestArxSessions = latestArxDate
              ? payload.arxSessions.filter((s) => s.sessionDate.slice(0, 10) === latestArxDate)
              : [];
            const latestArxByEx = new Map<string, { conc: number | null; ecc: number | null }>();
            for (const s of latestArxSessions) {
              const cur = latestArxByEx.get(s.exercise);
              if (!cur || (s.concentricMax ?? 0) > (cur.conc ?? 0)) latestArxByEx.set(s.exercise, { conc: s.concentricMax, ecc: s.eccentricMax });
            }
            const latestConcByEx = arxGroups.map(({ exercise, sessions }) => ({ exercise, value: sessions[0]?.concentricMax ?? 0 }));
            const latestEccByEx = arxGroups.map(({ exercise, sessions }) => ({ exercise, value: sessions[0]?.eccentricMax ?? 0 }));
            const maxConcAll = latestConcByEx.reduce((m, e) => Math.max(m, e.value), 0);
            const maxEccAll = latestEccByEx.reduce((m, e) => Math.max(m, e.value), 0);
            const maxBarAll = Math.max(maxConcAll, maxEccAll, 1);
            // Top 3 exercises by concentric for summary
            const top3Exercises = [...latestConcByEx]
              .filter((e) => e.value > 0)
              .sort((a, b) => b.value - a.value)
              .slice(0, 3)
              .map((e) => {
                const group = arxGroups.find((g) => g.exercise === e.exercise);
                const sessions = group?.sessions ?? [];
                const prevPeak = sessions.slice(1, 5).reduce((mx, s) => Math.max(mx, s.concentricMax ?? 0), 0);
                const dir: "up" | "down" | "none" = prevPeak > 0
                  ? e.value > prevPeak ? "up" : e.value < prevPeak ? "down" : "none"
                  : "none";
                return { exercise: e.exercise, value: e.value, trend: makeTrend(dir) };
              });
            // Top performer: highest concentric, first in sorted order if tied
            const topPerformerExercise = [...latestConcByEx].sort((a, b) => b.value - a.value)[0]?.exercise ?? null;
            // Strength trend (neutral by default — no alarming red)
            const topConc = arxGroups[0]?.sessions[0]?.concentricMax ?? null;
            const topConcPrev = arxGroups[0]?.sessions.slice(1, 4).reduce((mx, s) => Math.max(mx, s.concentricMax ?? 0), 0) ?? 0;
            const strengthTrend: TrendData | null = topConc !== null && topConcPrev > 0
              ? makeTrend(topConc > topConcPrev ? "up" : topConc < topConcPrev ? "down" : "none")
              : null;

            // ── 4. Cardio ─────────────────────────────────────────────────────────
            const rehitSessions = allCarol.filter((s) => normalizeCarolTabKey(s.rideType) === "rehit");
            const rehitWithManp = rehitSessions.filter((s) => (carolNum(s.manp) ?? 0) > 0);
            const latestManp = carolNum(rehitWithManp[0]?.manp ?? "");
            const weightLbsNum = carolNum(payload.scan.weightLbs);
            const vo2 = latestManp && weightLbsNum ? estimateVo2Max(latestManp, weightLbsNum) : null;
            const vo2Cat = vo2 ? vo2Category(vo2) : null;
            let manpTrendLabel = "";
            let manpTrendColor = "var(--text3)";
            if (rehitWithManp.length >= 6) {
              const recentAvg = rehitWithManp.slice(0, 3).reduce((s, r) => s + (carolNum(r.manp) ?? 0), 0) / 3;
              const olderAvg = rehitWithManp.slice(3, 6).reduce((s, r) => s + (carolNum(r.manp) ?? 0), 0) / 3;
              if (olderAvg > 0) {
                const pct = ((recentAvg - olderAvg) / olderAvg) * 100;
                if (pct > 3) { manpTrendLabel = `↑ ${pct.toFixed(0)}% vs prior`; manpTrendColor = "#4A7C59"; }
                else if (pct < -3) { manpTrendLabel = `↓ ${Math.abs(pct).toFixed(0)}% vs prior`; manpTrendColor = "#B84040"; }
                else { manpTrendLabel = "Stable"; manpTrendColor = "var(--text3)"; }
              }
            } else if (rehitWithManp.length >= 2) {
              manpTrendLabel = "Building…";
              manpTrendColor = "var(--text3)";
            }
            const carolNow = new Date();
            const carolMonthStart = new Date(carolNow.getFullYear(), carolNow.getMonth(), 1).toISOString().slice(0, 10);
            const carolPrevMonthStart = new Date(carolNow.getFullYear(), carolNow.getMonth() - 1, 1).toISOString().slice(0, 10);
            const carolThisMonth = allCarol.filter((s) => s.sessionDate >= carolMonthStart).length;
            const carolPrevMonth = allCarol.filter((s) => s.sessionDate >= carolPrevMonthStart && s.sessionDate < carolMonthStart).length;
            const RIDE_TYPE_LABELS: Record<string, string> = { REHIT: "REHIT", FAT_BURN_30: "Fat Burn 30", FAT_BURN_45: "Fat Burn 45", FAT_BURN_60: "Fat Burn 60", ENERGISER: "Energiser" };

            // ── 5. Consistency ────────────────────────────────────────────────────
            const allSessionDates = [
              ...payload.arxSessions.map((s) => s.sessionDate.slice(0, 10)),
              ...allCarol.map((s) => s.sessionDate.slice(0, 10)),
            ];
            const targetPerWeek = (payload.protocol.arxPerWeek ?? 0) + (payload.protocol.carolPerWeek ?? 0);
            const consistNow = new Date();
            const consistDow = consistNow.getDay();
            const consistMonday = new Date(consistNow);
            consistMonday.setHours(0, 0, 0, 0);
            consistMonday.setDate(consistNow.getDate() - (consistDow + 6) % 7);
            const consistWeeks: { start: string; end: string; count: number; isCurrent: boolean }[] = [];
            for (let i = 11; i >= 0; i--) {
              const mon = new Date(consistMonday);
              mon.setDate(consistMonday.getDate() - i * 7);
              const sun = new Date(mon);
              sun.setDate(mon.getDate() + 6);
              const s = mon.toISOString().slice(0, 10);
              const e = sun.toISOString().slice(0, 10);
              consistWeeks.push({ start: s, end: e, count: allSessionDates.filter((d) => d >= s && d <= e).length, isCurrent: i === 0 });
            }
            const totalSessions12 = consistWeeks.reduce((sum, w) => sum + w.count, 0);
            const avgPerWeek = (totalSessions12 / 12).toFixed(1);
            const consistMax = Math.max(...consistWeeks.map((w) => w.count), targetPerWeek, 1);

            // ── Last updated labels ───────────────────────────────────────────────
            const fmtDate = (iso: string | null | undefined) =>
              iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
            const scanLastUpdated = fmtDate(currentScan?.scanDateRaw);
            const strengthLastUpdated = fmtDate(latestArxDate);
            const cardioLastUpdated = fmtDate(allCarol[0]?.sessionDate?.slice(0, 10));
            const consistLastUpdated = fmtDate(allSessionDates.sort().reverse()[0]);

            const sectionLabelStyle: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text3)", marginBottom: 12, fontWeight: 600 };
            const detailBtnStyle: React.CSSProperties = { background: "none", border: "none", padding: "8px 0 0", fontSize: 11, color: "#4A7C59", cursor: "pointer", fontWeight: 500, textAlign: "left" };

            return (
              <>
                <div className="sec-header">
                  <div className="sec-title">Progress</div>
                </div>

                {/* ── 1. Healthspan — unchanged ───────────────────────────────────── */}
                <div style={{ marginBottom: 28 }}>
                  <div style={sectionLabelStyle}>Healthspan</div>
                  <div className="card" style={{ padding: "20px 22px" }}>
                    {va.hasEnoughData && va.estimated !== null ? (
                      <>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 8 }}>
                          <div style={{ fontSize: 52, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{va.estimated}</div>
                          <div style={{ paddingBottom: 6 }}>
                            <div style={{ fontSize: 11, color: "var(--text3)" }}>vitality age</div>
                            {va.chronological !== null && (
                              <div style={{ fontSize: 12, color: "var(--text2)" }}>vs {va.chronological} chronological</div>
                            )}
                          </div>
                        </div>
                        {va.difference !== null && va.difference !== 0 && (
                          <div style={{ fontSize: 13, color: va.difference > 0 ? "#4A7C59" : "#B84040", fontWeight: 500, marginBottom: 4 }}>
                            {va.difference > 0
                              ? `Functioning ${va.difference} year${va.difference !== 1 ? "s" : ""} younger than your age`
                              : `Vitality age is ${Math.abs(va.difference)} year${Math.abs(va.difference) !== 1 ? "s" : ""} above chronological`}
                          </div>
                        )}
                        {va.trend !== null && va.trend !== 0 && (
                          <div style={{ fontSize: 12, color: va.trend > 0 ? "#4A7C59" : "#B84040" }}>
                            {va.trend > 0
                              ? `↑ Improved ${va.trend} year${va.trend !== 1 ? "s" : ""} since joining`
                              : `↓ Up ${Math.abs(va.trend)} year${Math.abs(va.trend) !== 1 ? "s" : ""} since last calculation`}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Vitality Age</div>
                        <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
                          Complete your first body scan and a CAROL session to calculate your Vitality Age.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* ── 2. Body Composition ────────────────────────────────────────── */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...sectionLabelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Body Composition</span>
                    <span style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--text3)", fontWeight: 400, textTransform: "none" }}>
                      {scanLastUpdated ? `Last updated ${scanLastUpdated}` : "No data yet"}
                    </span>
                  </div>

                  {!currentScan ? (
                    <div className="card" style={{ padding: "20px 22px" }}>
                      <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
                        No body scan data yet. When you&apos;re ready, let Iso know and we&apos;ll get your scan scheduled and uploaded.
                      </p>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: "16px 18px" }}>
                      {/* Summary row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 6 }}>Muscle Mass</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
                            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{payload.scan.leanMassLbs !== "--" ? payload.scan.leanMassLbs : "—"}</span>
                            {payload.scan.leanMassLbs !== "--" && <span style={{ fontSize: 10, color: "var(--text3)" }}>lbs</span>}
                          </div>
                          {leanSparkVals.filter((v) => v !== null).length >= 2 && sparklinePath(leanSparkVals, 100, 28) ? (
                            <>
                              <svg viewBox="0 0 100 28" style={{ width: "100%", height: 28, display: "block", marginBottom: 2 }}>
                                <path d={sparklinePath(leanSparkVals, 100, 28)} fill="none" stroke={sentimentColor(leanTrend.sentiment)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {scanSparkTimeLabel && <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 4 }}>{scanSparkTimeLabel}</div>}
                            </>
                          ) : null}
                          {leanFirst !== null && leanLast !== null && (
                            <div style={{ fontSize: 10, color: sentimentColor(leanTrend.sentiment) }}>
                              {trendArrow(leanTrend.direction)} {Math.abs(leanLast - leanFirst).toFixed(1)} lbs since first scan
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 6 }}>Body Fat</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
                            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{payload.scan.bodyFatPct !== "--" ? payload.scan.bodyFatPct : "—"}</span>
                            {payload.scan.bodyFatPct !== "--" && <span style={{ fontSize: 10, color: "var(--text3)" }}>%</span>}
                          </div>
                          {fatSparkVals.filter((v) => v !== null).length >= 2 && sparklinePath(fatSparkVals, 100, 28) ? (
                            <>
                              <svg viewBox="0 0 100 28" style={{ width: "100%", height: 28, display: "block", marginBottom: 2 }}>
                                <path d={sparklinePath(fatSparkVals, 100, 28)} fill="none" stroke={sentimentColor(fatTrend.sentiment)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {scanSparkTimeLabel && <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 4 }}>{scanSparkTimeLabel}</div>}
                            </>
                          ) : null}
                          {fatFirst !== null && fatLast !== null && (
                            <div style={{ fontSize: 10, color: sentimentColor(fatTrend.sentiment) }}>
                              {trendArrow(fatTrend.direction)} {Math.abs(fatLast - fatFirst).toFixed(1)}% since first scan
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Dustin's Analysis — before trend label */}
                      {(currentScan || prevScan) && (
                        <div style={{ background: "rgba(196,131,26,0.06)", border: "1px solid rgba(196,131,26,0.18)", borderRadius: "var(--r-sm)", padding: "10px 14px", marginBottom: 8 }}>
                          <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(196,131,26,0.8)", marginBottom: 4 }}>Dustin&apos;s Analysis</div>
                          <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{scanInsight(currentScan, prevScan)}</p>
                        </div>
                      )}

                      {/* Trend label — below analysis, sentiment color */}
                      {(leanFirst !== null || fatFirst !== null) && (
                        <div style={{ fontSize: 10, color: sentimentColor(leanTrend.sentiment), fontWeight: 500, marginBottom: 10 }}>
                          {trendArrow(leanTrend.direction)} {leanTrend.sentiment === "neutral" ? "Recent trend" : leanTrend.direction === "up" ? "Trending up" : "Trending down"}
                        </div>
                      )}

                      {/* View Details toggle */}
                      <button type="button" style={detailBtnStyle} onClick={() => setProgressExpandBody((v) => !v)}>
                        {progressExpandBody ? "Hide details ↑" : "View details ↓"}
                      </button>

                      {/* ── Expanded: full Fit3D data ─────────────────────────────── */}
                      {progressExpandBody && (
                        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>All metrics</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 16 }}>
                            {scanMetrics.map((m) => {
                              const change = scanPctChange(m.raw, m.prevRaw);
                              const color = scanChangeColor(change, m.good);
                              const arrow = change ? (change.direction === "up" ? "↑" : "↓") : null;
                              return (
                                <div key={m.label} className="metric-row" style={{ borderRight: "none" }}>
                                  <div className="metric-label">{m.label}</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                                      {m.value}{m.value !== "--" && m.unit ? m.unit : ""}
                                    </span>
                                    {change && (
                                      <span style={{ fontSize: 11, color, fontWeight: 500 }}>{arrow} {change.display}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {(payload.scan.headForwardIn !== "--" || payload.scan.shoulderForwardIn !== "--") && (
                            <>
                              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>Posture</div>
                              <div style={{ marginBottom: 16 }}>
                                <div className="metric-row"><div className="metric-label">Head forward</div><div className="metric-val">{payload.scan.headForwardIn}&quot;</div></div>
                                <div className="metric-row"><div className="metric-label">Shoulder forward</div><div className="metric-val">{payload.scan.shoulderForwardIn}&quot;</div></div>
                                <div className="metric-row"><div className="metric-label">Hip forward</div><div className="metric-val">{payload.scan.hipForwardIn}&quot;</div></div>
                              </div>
                            </>
                          )}

                          {scansAsc.length > 0 && (
                            <>
                              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>Scan history</div>
                              <div style={{ overflowX: "auto", marginBottom: 8 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                  <thead>
                                    <tr>
                                      {["Date", "Lean (lbs)", "Fat %", "Weight (lbs)", "Shape"].map((h) => (
                                        <th key={h} style={{ textAlign: "left", padding: "4px 8px 8px 0", color: "var(--text3)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[...scansAsc].reverse().map((scan, i) => (
                                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                                        <td style={{ padding: "7px 8px 7px 0", color: "var(--text3)", whiteSpace: "nowrap" }}>{scan.scanDate}</td>
                                        <td style={{ padding: "7px 8px 7px 0", color: "var(--text)", fontWeight: 500 }}>{scan.leanMassLbs}</td>
                                        <td style={{ padding: "7px 8px 7px 0", color: "var(--text)", fontWeight: 500 }}>{scan.bodyFatPct}%</td>
                                        <td style={{ padding: "7px 8px 7px 0", color: "var(--text)" }}>{scan.weightLbs}</td>
                                        <td style={{ padding: "7px 8px 7px 0", color: "var(--text)" }}>{scan.bodyShapeRating}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}

                          {scansAsc.length >= 2 && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                              {[
                                { label: "Lean mass", vals: leanSparkVals, trend: leanTrend },
                                { label: "Body fat %", vals: fatSparkVals, trend: fatTrend },
                                { label: "Weight", vals: wtSparkVals, trend: makeTrend("none") },
                              ].map((chart) => {
                                const validCount = chart.vals.filter((v) => v !== null).length;
                                const path = validCount >= 2 ? sparklinePath(chart.vals, 100, 36) : "";
                                return (
                                  <div key={chart.label} style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{chart.label}</div>
                                    {path ? (
                                      <>
                                        <svg viewBox="0 0 100 36" style={{ width: "100%", height: 36, display: "block", marginBottom: 2 }}>
                                          <path d={path} fill="none" stroke={sentimentColor(chart.trend.sentiment)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        {scanSparkTimeLabel && <div style={{ fontSize: 9, color: "var(--text3)" }}>{scanSparkTimeLabel}</div>}
                                      </>
                                    ) : (
                                      <div style={{ height: 36, display: "flex", alignItems: "center" }}>
                                        <span style={{ fontSize: 10, color: "var(--text3)" }}>Not enough data</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── 3. Strength ────────────────────────────────────────────────── */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...sectionLabelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Strength</span>
                    <span style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--text3)", fontWeight: 400, textTransform: "none" }}>
                      {strengthLastUpdated ? `Last updated ${strengthLastUpdated}` : "No data yet"}
                    </span>
                  </div>

                  {arxGroups.length === 0 ? (
                    <div className="card" style={{ padding: "20px 22px" }}>
                      <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
                        No strength data yet. Connect your ARX account in{" "}
                        <Link href="/dashboard/settings" style={{ color: "#9dcc3a", textDecoration: "none" }}>Settings →</Link>
                      </p>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: "16px 18px" }}>
                      {/* Top 3 exercises */}
                      <div style={{ marginBottom: 14 }}>
                        {top3Exercises.map((ex, idx) => (
                          <div key={ex.exercise} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: idx < top3Exercises.length - 1 ? "1px solid var(--border)" : "none" }}>
                            <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>{ex.exercise}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{Math.round(ex.value)}</span>
                              <span style={{ fontSize: 9, color: "var(--text3)" }}>lbs</span>
                              {ex.trend.direction !== "none" && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: sentimentColor(ex.trend.sentiment) }}>
                                  {trendArrow(ex.trend.direction)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Dustin's Analysis — before trend label */}
                      <div style={{ background: "rgba(196,131,26,0.06)", border: "1px solid rgba(196,131,26,0.18)", borderRadius: "var(--r-sm)", padding: "10px 14px", marginBottom: 8 }}>
                        <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(196,131,26,0.8)", marginBottom: 4 }}>Dustin&apos;s Analysis</div>
                        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{buildArxInsight(arxGroups)}</p>
                      </div>

                      {/* Trend label — below analysis, sentiment color */}
                      {strengthTrend && (
                        <div style={{ fontSize: 10, color: sentimentColor(strengthTrend.sentiment), fontWeight: 500, marginBottom: 10 }}>
                          {trendArrow(strengthTrend.direction)} {strengthTrend.sentiment === "neutral" ? "Recent trend" : strengthTrend.direction === "up" ? "Trending up" : "Trending down"}
                        </div>
                      )}

                      <button type="button" style={detailBtnStyle} onClick={() => setProgressExpandStrength((v) => !v)}>
                        {progressExpandStrength ? "Hide details ↑" : `View all ${arxGroups.length} exercise${arxGroups.length !== 1 ? "s" : ""} ↓`}
                      </button>

                      {progressExpandStrength && (
                        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                          {latestArxDate && latestArxByEx.size > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
                                Last workout · {new Date(latestArxDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </div>
                              {Array.from(latestArxByEx.entries()).map(([ex, vals]) => {
                                const ratio = vals.conc && vals.ecc ? vals.ecc / vals.conc : null;
                                return (
                                  <div key={ex} style={{ display: "flex", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                                    <div style={{ flex: 1, fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>{ex}</div>
                                    <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text3)" }}>
                                      {vals.conc != null && <span>Conc <b style={{ color: "var(--text)" }}>{Math.round(vals.conc)} lbs</b></span>}
                                      {vals.ecc != null && <span>Ecc <b style={{ color: "var(--text)" }}>{Math.round(vals.ecc)} lbs</b></span>}
                                      {ratio != null && <span style={{ color: eccRatioLabel(ratio).color }}>{ratio.toFixed(2)}×</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Dual-bar output chart */}
                          {latestConcByEx.length > 1 && maxBarAll > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>Output by exercise</div>
                              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--text3)" }}>
                                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#4A7C59" }} /> Concentric
                                </span>
                                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--text3)" }}>
                                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--text3)", opacity: 0.45 }} /> Eccentric
                                </span>
                              </div>
                              {[...latestConcByEx].sort((a, b) => b.value - a.value).map(({ exercise, value }) => {
                                const eccVal = latestEccByEx.find((e) => e.exercise === exercise)?.value ?? 0;
                                return (
                                  <div key={exercise} style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>{exercise}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                      <div style={{ flex: 1, height: 5, background: "var(--bg2)", borderRadius: 3, overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${(value / maxBarAll) * 100}%`, background: "#4A7C59", borderRadius: 3 }} />
                                      </div>
                                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text)", minWidth: 52, textAlign: "right" }}>{value > 0 ? `${Math.round(value)} lbs` : "—"}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <div style={{ flex: 1, height: 5, background: "var(--bg2)", borderRadius: 3, overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${(eccVal / maxBarAll) * 100}%`, background: "var(--text3)", opacity: 0.45, borderRadius: 3 }} />
                                      </div>
                                      <span style={{ fontSize: 10, color: "var(--text3)", minWidth: 52, textAlign: "right" }}>{eccVal > 0 ? `${Math.round(eccVal)} lbs` : "—"}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>All exercises</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {arxGroups.map(({ exercise, sessions }) => {
                              const latest = sessions[0];
                              const conc = latest?.concentricMax ?? null;
                              const ecc = latest?.eccentricMax ?? null;
                              const ratio = conc && ecc ? ecc / conc : null;
                              const ratioInfo = ratio !== null ? eccRatioLabel(ratio) : null;
                              const pr = conc !== null ? Math.max(...sessions.map((s) => s.concentricMax ?? 0)) : 0;
                              const isPR = conc !== null && conc >= pr && sessions.length > 1;
                              const isTopPerformer = exercise === topPerformerExercise;
                              // Sparkline — hide if < 2 data points
                              const sparkSessions = sessions.slice(0, 12).reverse();
                              const sparkVals = sparkSessions.map((s) => s.concentricMax);
                              const validSparkCount = sparkVals.filter((v) => v !== null).length;
                              const path = validSparkCount >= 2 ? sparklinePath(sparkVals, 100, 28) : "";
                              // Sentiment-based color (neutral = gray by default)
                              const sparkFirst = sparkVals.find((v) => v !== null) ?? null;
                              const sparkLast = [...sparkVals].reverse().find((v) => v !== null) ?? null;
                              const sparkDir: "up" | "down" | "none" =
                                sparkFirst !== null && sparkLast !== null
                                  ? sparkLast > sparkFirst ? "up" : sparkLast < sparkFirst ? "down" : "none"
                                  : "none";
                              const exTrend = makeTrend(sparkDir);
                              // Time range label
                              const sparkTimeLabel = (() => {
                                if (sparkSessions.length < 2) return null;
                                const oldest = sparkSessions[0]?.sessionDate?.slice(0, 10);
                                const newest = sparkSessions[sparkSessions.length - 1]?.sessionDate?.slice(0, 10);
                                if (!oldest || !newest || oldest === newest) return null;
                                const months = Math.round((new Date(newest).getTime() - new Date(oldest).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                                return months >= 1 ? `last ${months} month${months !== 1 ? "s" : ""}` : null;
                              })();
                              const isSelected = selectedArxExercise === exercise;
                              return (
                                <div key={exercise} className="card"
                                  style={{ padding: "14px 16px", cursor: "pointer", border: isSelected ? "1px solid rgba(74,124,89,0.38)" : undefined, background: isSelected ? "rgba(157,204,58,0.04)" : undefined }}
                                  onClick={() => setSelectedArxExercise(isSelected ? null : exercise)}>
                                  {/* Header: name + badges */}
                                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{exercise}</div>
                                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                      {isTopPerformer && <span style={{ fontSize: 9, background: "rgba(74,124,89,0.12)", color: "#4A7C59", border: "1px solid rgba(74,124,89,0.28)", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.08em" }}>Top performer</span>}
                                      {isPR && <span style={{ fontSize: 9, background: "rgba(74,124,89,0.12)", color: "#4A7C59", border: "1px solid rgba(74,124,89,0.28)", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.08em" }}>PR</span>}
                                    </div>
                                  </div>
                                  {/* Conc / Ecc tiles */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                                    <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "7px 10px" }}>
                                      <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Concentric</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{conc !== null ? Math.round(conc) : "--"} <span style={{ fontSize: 9, color: "var(--text3)" }}>lbs</span></div>
                                    </div>
                                    <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "7px 10px" }}>
                                      <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Eccentric</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{ecc !== null ? Math.round(ecc) : "--"} <span style={{ fontSize: 9, color: "var(--text3)" }}>lbs</span></div>
                                    </div>
                                  </div>
                                  {/* Ecc:Conc ratio + explanation */}
                                  {ratioInfo && ratio !== null && (
                                    <div style={{ marginBottom: 8 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, color: "var(--text3)" }}>Ecc:Conc</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: ratioInfo.color }}>{ratio.toFixed(2)}×</span>
                                        <span style={{ fontSize: 9, color: ratioInfo.color, background: `${ratioInfo.color}18`, border: `1px solid ${ratioInfo.color}40`, borderRadius: 4, padding: "1px 5px" }}>{ratioInfo.label}</span>
                                      </div>
                                      <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.5 }}>{eccRatioExplanation(ratio)}</div>
                                    </div>
                                  )}
                                  {/* Sparkline + time label */}
                                  {path ? (
                                    <>
                                      <svg viewBox="0 0 100 28" style={{ width: "100%", height: 28, display: "block", marginBottom: 2 }}>
                                        <path d={path} fill="none" stroke={sentimentColor(exTrend.sentiment)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      {sparkTimeLabel && <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 6 }}>{sparkTimeLabel}</div>}
                                    </>
                                  ) : null}
                                  {/* View history footer */}
                                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
                                    <span style={{ fontSize: 10, color: "#4A7C59", fontWeight: 500 }}>
                                      {isSelected ? "Close ↑" : "View history →"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── 4. Cardio ──────────────────────────────────────────────────── */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...sectionLabelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Cardio</span>
                    <span style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--text3)", fontWeight: 400, textTransform: "none" }}>
                      {cardioLastUpdated ? `Last updated ${cardioLastUpdated}` : "No data yet"}
                    </span>
                  </div>

                  {allCarol.length === 0 ? (
                    <div className="card" style={{ padding: "20px 22px" }}>
                      <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
                        No cardio data yet. Connect your CAROL account in{" "}
                        <Link href="/dashboard/settings" style={{ color: "#9dcc3a", textDecoration: "none" }}>Settings →</Link>
                      </p>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: "16px 18px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Est. VO2 Max</div>
                          {vo2 && vo2Cat ? (
                            <>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                                <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{vo2.toFixed(0)}</span>
                                <span style={{ fontSize: 9, color: "var(--text3)" }}>ml/kg/min</span>
                              </div>
                              <div style={{ height: 3, background: "var(--bg2)", borderRadius: 2, marginBottom: 4, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${vo2Cat.barPct}%`, background: vo2Cat.color, borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 10, color: vo2Cat.color, fontWeight: 600 }}>{vo2Cat.label}</span>
                            </>
                          ) : (
                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text2)" }}>—</div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Aerobic Power</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{latestManp ? Math.round(latestManp) : "—"}</span>
                            {latestManp ? <span style={{ fontSize: 9, color: "var(--text3)" }}>W MANP</span> : null}
                          </div>
                          {manpTrendLabel ? (
                            <div style={{ fontSize: 10, color: manpTrendColor, fontWeight: 500 }}>{manpTrendLabel}</div>
                          ) : (
                            <div style={{ fontSize: 10, color: "var(--text3)" }}>
                              {rehitWithManp.length < 2 ? "More REHIT sessions needed" : "Building…"}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>This Month</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{carolThisMonth}</span>
                            <span style={{ fontSize: 9, color: "var(--text3)" }}>sessions</span>
                          </div>
                          {carolPrevMonth > 0 ? (
                            <div style={{ fontSize: 10, color: carolThisMonth >= carolPrevMonth ? "#4A7C59" : "var(--text3)" }}>
                              {carolThisMonth >= carolPrevMonth ? "↑" : "↓"} vs {carolPrevMonth} last month
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: "var(--text3)" }}>{allCarol.length} total rides</div>
                          )}
                        </div>
                      </div>

                      <div style={{ background: "rgba(196,131,26,0.06)", border: "1px solid rgba(196,131,26,0.18)", borderRadius: "var(--r-sm)", padding: "10px 14px", marginBottom: 10 }}>
                        <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(196,131,26,0.8)", marginBottom: 4 }}>Dustin&apos;s Analysis</div>
                        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{buildCarolInsight(allCarol, payload.scan.weightLbs)}</p>
                      </div>

                      <button type="button" style={detailBtnStyle} onClick={() => setProgressExpandCardio((v) => !v)}>
                        {progressExpandCardio ? "Hide details ↑" : `View all ${allCarol.length} ride${allCarol.length !== 1 ? "s" : ""} ↓`}
                      </button>

                      {progressExpandCardio && (
                        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                          {rehitWithManp.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>REHIT performance</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                                <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                                  <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Latest MANP</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{latestManp ? Math.round(latestManp) : "—"} <span style={{ fontSize: 9, color: "var(--text3)" }}>W</span></div>
                                  {manpTrendLabel && <div style={{ fontSize: 10, color: manpTrendColor, marginTop: 3 }}>{manpTrendLabel}</div>}
                                </div>
                                <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                                  <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Est. VO2 Max</div>
                                  {vo2 && vo2Cat ? (
                                    <>
                                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{vo2.toFixed(0)} <span style={{ fontSize: 9, color: "var(--text3)" }}>ml/kg/min</span></div>
                                      <div style={{ fontSize: 10, color: vo2Cat.color, marginTop: 3 }}>{vo2Cat.label}</div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: 14, color: "var(--text3)" }}>—</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>All rides</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {allCarol.slice(0, 50).map((row, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                                <div>
                                  <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>{RIDE_TYPE_LABELS[row.rideType] ?? row.rideType.replace(/_/g, " ")}</div>
                                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{row.sessionDate}</div>
                                </div>
                                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text3)", textAlign: "right" }}>
                                  {carolNum(row.manp) !== null && carolNum(row.manp)! > 0 && <span>MANP <b style={{ color: "var(--text)" }}>{row.manp}</b></span>}
                                  {carolNum(row.avgSprintPower) !== null && carolNum(row.avgSprintPower)! > 0 && <span>Avg <b style={{ color: "var(--text)" }}>{Math.round(carolNum(row.avgSprintPower)!)}W</b></span>}
                                  {carolNum(row.heartRateMax) !== null && carolNum(row.heartRateMax)! > 0 && <span>HR <b style={{ color: "var(--text)" }}>{row.heartRateMax}</b></span>}
                                </div>
                              </div>
                            ))}
                            {allCarol.length > 50 && (
                              <div style={{ fontSize: 11, color: "var(--text3)", paddingTop: 8 }}>Showing 50 of {allCarol.length} rides</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── 5. Consistency ─────────────────────────────────────────────── */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...sectionLabelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Consistency</span>
                    <span style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--text3)", fontWeight: 400, textTransform: "none" }}>
                      {consistLastUpdated ? `Last updated ${consistLastUpdated}` : "No data yet"}
                    </span>
                  </div>
                  <div className="card" style={{ padding: "16px 18px" }}>
                    {(() => {
                      const chartW = 280;
                      const chartH = 72;
                      const barGap = 3;
                      const barW = (chartW - barGap * (consistWeeks.length - 1)) / consistWeeks.length;
                      const refY = targetPerWeek > 0 ? chartH - (targetPerWeek / consistMax) * chartH : null;
                      return (
                        <>
                          <div style={{ overflowX: "auto", marginBottom: 10 }}>
                            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: chartH, display: "block", overflow: "visible" }}>
                              {consistWeeks.map((week, i) => {
                                const barH = week.count > 0 ? Math.max(3, (week.count / consistMax) * chartH) : 0;
                                const x = i * (barW + barGap);
                                const y = chartH - barH;
                                return (
                                  <rect key={week.start} x={x.toFixed(1)} y={y.toFixed(1)}
                                    width={barW.toFixed(1)} height={barH.toFixed(1)}
                                    fill={week.isCurrent ? "#4A7C59" : "var(--text3)"}
                                    fillOpacity={week.isCurrent ? 1 : 0.38} rx="2" />
                                );
                              })}
                              {refY !== null && targetPerWeek > 0 && (
                                <>
                                  <line x1="0" y1={refY.toFixed(1)} x2={chartW} y2={refY.toFixed(1)}
                                    stroke="var(--text3)" strokeWidth="1" strokeDasharray="4 3" />
                                  <text x={chartW - 2} y={(refY - 3).toFixed(1)} textAnchor="end"
                                    fontSize="8" fill="var(--text3)">Your target</text>
                                </>
                              )}
                            </svg>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text3)" }}>
                            Averaging <b style={{ color: "var(--text)" }}>{avgPerWeek}</b> sessions / week over 12 weeks
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        <div id="view-recovery" className="content" style={{ display: mode === "member" && memberView === "recovery" ? "block" : "none" }}>
          <div className="sec-header">
            <div className="sec-title">Recovery</div>
            <Link className="btn btn-lime btn-sm" href="/dashboard/recovery">
              Log Recovery
            </Link>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">Recovery sessions</div></div>
              <div className="recovery-grid">
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.infraredSauna}</div><div className="rec-label">Infrared sauna</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.coldPlunge}</div><div className="rec-label">Cold plunge</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.nxpro}</div><div className="rec-label">NxPro</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.compression}</div><div className="rec-label">Compression</div></div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Other sessions</div></div>
              <div className="recovery-grid">
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.vasper}</div><div className="rec-label">Vasper</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.katalyst}</div><div className="rec-label">Katalyst</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.proteus}</div><div className="rec-label">Proteus</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.quickboard}</div><div className="rec-label">Quickboard</div></div>
              </div>
            </div>
          </div>
        </div>

        <div id="view-wearables" className="content" style={{ display: mode === "member" && memberView === "wearables" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Wearables</div></div>
          <div className="card">
            <div className="card-header"><div className="card-title">Today&apos;s data</div></div>
            <div className="wearable-metrics">
              <div className="wm-item"><div className="wm-label">Whoop recovery</div><div className="wm-val">{payload.wearables.whoopRecovery}</div></div>
              <div className="wm-item"><div className="wm-label">Oura readiness</div><div className="wm-val">{payload.wearables.ouraReadiness}</div></div>
              <div className="wm-item"><div className="wm-label">HRV</div><div className="wm-val">{payload.wearables.hrvMs}</div></div>
              <div className="wm-item"><div className="wm-label">Sleep</div><div className="wm-val">{payload.wearables.sleepHours}</div></div>
            </div>
          </div>
        </div>

        <div
          id="view-messages"
          className="content"
          style={{
            display:
              (mode === "member" && memberView === "messages") ||
              (mode === "coach" && coachView === "messages")
                ? "block"
                : "none",
          }}
        >
          <div className="sec-header"><div className="sec-title">Messages</div></div>
          <div className="card" style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 460 }}>
            <div style={{ borderRight: "1px solid var(--border)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text3)" }}>
                Inbox
              </div>
              {mode === "coach" ? (
                effectiveCoachRecipients.length ? (
                  effectiveCoachRecipients.map((member) => (
                    <button
                      key={member.id}
                      className={`msg-thread ${selectedCoachRecipientId === member.id ? "unread" : ""}`}
                      style={{ width: "100%", border: "none", textAlign: "left", background: "transparent" }}
                      onClick={() => {
                        setSelectedCoachRecipientId(member.id);
                        void loadMessages(true, member.id);
                      }}
                      type="button"
                    >
                      <div className="msg-av" style={{ background: "var(--lime-dim)", color: "var(--lime)" }}>
                        {initialsFromName(member.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="msg-from">{member.name}</div>
                        <div className="msg-preview">
                          {selectedCoachRecipientId === member.id
                            ? messages[messages.length - 1]?.body || "Open thread"
                            : "Open thread"}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: 16, color: "var(--text3)", fontSize: 12 }}>
                    No members available.
                  </div>
                )
              ) : (
                <div className={`msg-thread ${unreadCount > 0 ? "unread" : ""}`}>
                  <div className="msg-av" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
                    {initialsFromName(peerName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="msg-from">{peerName}</div>
                    <div className="msg-preview">{messages[messages.length - 1]?.body || "No messages yet"}</div>
                  </div>
                  <div className="msg-time">{formatMessageTime(messages[messages.length - 1]?.created_at || "")}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div className="msg-av" style={{ width: 36, height: 36, fontSize: 13, background: "var(--amber-dim)", color: "var(--amber)" }}>
                  {initialsFromName(peerName)}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{peerName}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    {mode === "coach" ? "Member · Iso Club" : "Head Coach · Iso Club"}
                  </div>
                </div>
              </div>

              <div ref={threadRef} style={{ flex: 1, overflowY: "auto", maxHeight: 360 }}>
                {messages.length ? (
                  messages.map((message) => {
                    const outbound = String(message.sender_id || "") === String(payload.memberId || "");
                    return (
                      <div
                        key={message.id}
                        style={{
                          display: "flex",
                          justifyContent: outbound ? "flex-end" : "flex-start",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            background: outbound ? "rgba(201,240,85,0.12)" : "var(--bg3)",
                            border: `1px solid ${outbound ? "rgba(201,240,85,0.35)" : "var(--border)"}`,
                            borderRadius: "var(--r-sm)",
                            padding: "10px 12px",
                            maxWidth: 460,
                          }}
                        >
                          <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 6px 0" }}>{message.body}</p>
                          <div style={{ fontSize: 10, color: "var(--text3)", textAlign: outbound ? "right" : "left" }}>
                            {formatMessageTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ color: "var(--text3)" }}>
                    {mode === "coach"
                      ? "No messages yet. Send a note to start this thread."
                      : "No messages yet. Send Dustin a note to start the thread."}
                  </p>
                )}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder={mode === "coach" ? "Message member…" : "Reply to Dustin…"}
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                />
                <button className="btn btn-lime" type="button" onClick={() => void sendMessage()} disabled={sendingMessage}>
                  Send
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: messagesStatus.includes("sent") ? "var(--lime)" : "var(--text3)" }}>
                {messagesStatus}
              </div>
            </div>
          </div>
        </div>

        <div id="view-reports" className="content" style={{ display: mode === "member" && memberView === "reports" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Reports from Dustin</div></div>
          <div className="card" style={{ maxWidth: 580 }}>
            {payload.reports.length ? (
              payload.reports.map((report) => (
                <div className="report-item" key={report.title}>
                  <div>
                    <div className="report-name">{report.title}</div>
                  </div>
                  <button className="btn btn-sm" style={{ marginLeft: "auto" }} type="button">
                    View
                  </button>
                </div>
              ))
            ) : (
              <div className="card-body"><p style={{ color: "var(--text3)" }}>No reports available yet.</p></div>
            )}
          </div>
        </div>

        <div id="view-schedule" className="content" style={{ display: mode === "member" && memberView === "schedule" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Schedule</div></div>
          <div className="card">
            <div className="card-header"><div className="card-title">Upcoming</div></div>
            {payload.bookings.length ? (
              payload.bookings.map((booking) => (
                <div className="sched-item" key={booking.label}>
                  <div className="sched-info">
                    <div className="sched-name">{booking.label}</div>
                  </div>
                  <span className="tag tag-lime">{booking.status}</span>
                </div>
              ))
            ) : (
              <div className="card-body"><p style={{ color: "var(--text3)" }}>No upcoming bookings.</p></div>
            )}
          </div>
        </div>

        <div id="coach-morning" className="content" style={{ display: mode === "coach" && coachView === "morning" ? "block" : "none" }}>
          <div className="coach-morning">
            <div className="cm-title">Good morning, {firstNameFromName(displayName)}.</div>
            <div className="cm-sub">Today&apos;s member readiness snapshot.</div>
            <div className="cm-stats">
              <div className="cm-stat"><div className="cm-stat-val">{payload.coach.todayCount}</div><div className="cm-stat-label">In today</div></div>
              <div className="cm-stat"><div className="cm-stat-val" style={{ color: "var(--coral)" }}>{payload.coach.lowRecoveryCount}</div><div className="cm-stat-label">Low recovery</div></div>
              <div className="cm-stat"><div className="cm-stat-val" style={{ color: "var(--lime)" }}>{payload.coach.readyCount}</div><div className="cm-stat-label">Ready to train</div></div>
            </div>
          </div>
          {/* At-risk members */}
          {payload.coachAtRisk.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "#C4831A", marginBottom: 10 }}>⚠ Members Needing Attention</div>
              {payload.coachAtRisk.map((m) => (
                <div key={m.id} style={{ background: "rgba(232,168,56,0.07)", border: "1px solid rgba(232,168,56,0.25)", borderRadius: "var(--r-sm)", padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{m.name}</div>
                    {m.reasons.map((r, i) => <div key={i} style={{ fontSize: 11, color: "#C4831A" }}>{r}</div>)}
                  </div>
                  <button type="button" className="btn btn-sm" style={{ fontSize: 10, flexShrink: 0 }} onClick={() => { setSelectedCoachRecipientId(m.id); setCoachView("messages"); setMode("coach"); void loadMessages(true, m.id); }}>Message →</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <div className="sec-header"><div className="sec-title">Flags to review</div></div>
            {(payload.coach.alerts.length ? payload.coach.alerts : ["No current alerts."]).map((alert, index) => (
              <div className="alert alert-warn" key={`${alert}-${index}`}>{alert}</div>
            ))}
          </div>
        </div>

        <div id="coach-members" className="content" style={{ display: mode === "coach" && coachView === "members" ? "block" : "none" }}>
          {/* Review screen — shown when coach clicks a review_requested member */}
          {reviewMemberId ? (() => {
            const diffChanged = reviewDiff.filter((d) => d.oldValue !== d.newValue);
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 13, padding: 0 }}
                    onClick={() => {
                      setReviewMemberId(null);
                      setReviewNotifId(null);
                      setReviewDiff([]);
                      setReviewRecommendation(null);
                      setReviewRecommendationReason(null);
                      setReviewCoachNote("");
                      setReviewProtocolChanged(false);
                      setReviewConfirmMsg(null);
                    }}
                  >← Back to members</button>
                </div>
                <div className="sec-header">
                  <div className="sec-title">Protocol review requested</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{reviewMemberName}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {/* Left — diff */}
                  <div className="card" style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, color: "var(--text3)", marginBottom: 14 }}>What changed</div>
                    {diffChanged.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--text3)" }}>No prior answers on file — all fields are new.</p>
                    ) : (
                      <>
                        {diffChanged.map((d) => (
                          <div key={d.field} style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 4 }}>{d.label}</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, color: "var(--text3)", textDecoration: "line-through" }}>{d.oldValue}</span>
                              <span style={{ fontSize: 11, color: "var(--text3)" }}>→</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{d.newValue}</span>
                            </div>
                          </div>
                        ))}
                        {reviewDiff.filter((d) => d.oldValue === d.newValue).length > 0 && (
                          <div>
                            <button
                              type="button"
                              style={{ fontSize: 11, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}
                              onClick={() => setReviewDiffCollapsed(!reviewDiffCollapsed)}
                            >
                              {reviewDiffCollapsed ? "▶" : "▼"} Unchanged fields
                            </button>
                            {!reviewDiffCollapsed && (
                              <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: "2px solid var(--border)" }}>
                                {reviewDiff.filter((d) => d.oldValue === d.newValue).map((d) => (
                                  <div key={d.field} style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>
                                    <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>{d.label}:</span>{" "}
                                    <span>{d.newValue}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right — recommendation */}
                  <div className="card" style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, color: "var(--text3)", marginBottom: 14 }}>System recommendation</div>
                    {reviewRecommendation ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{reviewRecommendation}</div>
                        {reviewRecommendationReason && (
                          <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>{reviewRecommendationReason}</p>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text3)" }}>No recommendation available.</p>
                    )}

                    {/* Protocol change toggle */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 14 }}>
                        <input
                          type="checkbox"
                          checked={reviewProtocolChanged}
                          onChange={(e) => setReviewProtocolChanged(e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: "var(--lime)" }}
                        />
                        <span style={{ fontSize: 13, color: "var(--text2)" }}>Assign updated protocol</span>
                      </label>

                      {reviewProtocolChanged && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>Select protocol</div>
                          <select
                            className="form-input"
                            style={{ width: "100%", fontSize: 12 }}
                            value={reviewNewProtocolId}
                            onChange={(e) => setReviewNewProtocolId(e.target.value)}
                          >
                            <option value="">— choose —</option>
                            {coachProtocols.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6, marginTop: 10 }}>Days per week</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {[1,2,3,4,5,6].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setReviewNewDays(reviewNewDays === n ? null : n)}
                                style={{ width: 30, height: 30, borderRadius: "50%", fontSize: 11, fontWeight: 600, cursor: "pointer", background: reviewNewDays === n ? "var(--lime)" : "var(--bg3)", border: `1px solid ${reviewNewDays === n ? "var(--lime)" : "var(--border)"}`, color: reviewNewDays === n ? "#0b0c09" : "var(--text3)" }}
                              >{n}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Coach note */}
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>Coach note (required)</div>
                      <textarea
                        className="form-input"
                        style={{ width: "100%", minHeight: 70, resize: "vertical", fontSize: 12, marginBottom: 12, boxSizing: "border-box" }}
                        placeholder="Note visible to the member…"
                        value={reviewCoachNote}
                        onChange={(e) => setReviewCoachNote(e.target.value)}
                      />

                      {reviewConfirmMsg && (
                        <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 6, marginBottom: 10, background: reviewConfirmMsg.ok ? "rgba(74,124,89,0.08)" : "rgba(184,64,64,0.08)", color: reviewConfirmMsg.ok ? "#4A7C59" : "#B84040", border: `1px solid ${reviewConfirmMsg.ok ? "rgba(74,124,89,0.2)" : "rgba(184,64,64,0.2)"}` }}>
                          {reviewConfirmMsg.text}
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn btn-lime"
                        disabled={confirmingReview || !reviewCoachNote.trim() || (reviewProtocolChanged && !reviewNewProtocolId)}
                        onClick={async () => {
                          if (!reviewCoachNote.trim()) return;
                          setConfirmingReview(true);
                          setReviewConfirmMsg(null);
                          try {
                            await postJson("/api/coach/review-confirm", {
                              member_id: reviewMemberId,
                              notification_id: reviewNotifId,
                              protocol_changed: reviewProtocolChanged,
                              new_protocol_id: reviewProtocolChanged ? reviewNewProtocolId : undefined,
                              new_days_per_week: reviewProtocolChanged ? reviewNewDays : undefined,
                              coach_notes: reviewCoachNote,
                            });
                            setReviewConfirmMsg({ text: "Confirmed — member notified.", ok: true });
                            // Mark notification read in local state
                            if (reviewNotifId) {
                              setCoachNotifs((prev) => prev.map((n) => n.id === reviewNotifId ? { ...n, is_read: true } : n));
                              setNotifUnreadCount((c) => Math.max(0, c - 1));
                            }
                            setTimeout(() => {
                              setReviewMemberId(null);
                              setReviewNotifId(null);
                              setReviewDiff([]);
                              setReviewCoachNote("");
                              setReviewProtocolChanged(false);
                              setReviewConfirmMsg(null);
                            }, 2000);
                          } catch (err) {
                            setReviewConfirmMsg({ text: err instanceof Error ? err.message : "Failed to confirm.", ok: false });
                          } finally {
                            setConfirmingReview(false);
                          }
                        }}
                      >
                        {confirmingReview ? "Confirming…" : reviewProtocolChanged ? "Update protocol and notify member" : "Confirm — no changes needed"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : (
          <>
          <div className="sec-header"><div className="sec-title">All members</div></div>
          {/* Needs attention — review_requested and awaiting_protocol members */}
          {(() => {
            const attention = payload.coach.members.filter(
              (m) => m.member_status === "review_requested" || m.member_status === "awaiting_protocol",
            );
            if (attention.length === 0) return null;
            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, color: "var(--text3)", marginBottom: 10 }}>Needs attention</div>
                <div className="card">
                  {attention.map((member) => {
                    const isReview = member.member_status === "review_requested";
                    const daysAgo = member.review_requested_at
                      ? Math.floor((Date.now() - new Date(member.review_requested_at).getTime()) / 86400000)
                      : null;
                    const matchingNotif = coachNotifs.find(
                      (n) => n.member_id === member.id && n.type === "protocol_review_requested" && !n.is_read,
                    ) ?? coachNotifs.find(
                      (n) => n.member_id === member.id && n.type === "protocol_review_requested",
                    );
                    return (
                      <div
                        key={member.id}
                        className="metric-row"
                        style={{ cursor: isReview ? "pointer" : "default" }}
                        onClick={() => {
                          if (!isReview) return;
                          setReviewMemberId(member.id);
                          setReviewMemberName(member.name);
                          setReviewNotifId(matchingNotif?.id ?? null);
                          setReviewDiff(matchingNotif?.payload?.diff ?? []);
                          setReviewRecommendation(matchingNotif?.payload?.recommendation ?? null);
                          setReviewRecommendationReason(matchingNotif?.payload?.recommendation_reason ?? null);
                          setReviewCoachNote("");
                          setReviewProtocolChanged(false);
                          setReviewConfirmMsg(null);
                          setReviewDiffCollapsed(true);
                          // Load protocols for the dropdown if not loaded
                          if (coachProtocols.length === 0) {
                            void getJson<{ protocols: CoachProtocol[] }>("/api/coach/protocols")
                              .then((r) => { if (Array.isArray(r.protocols)) setCoachProtocols(r.protocols); })
                              .catch(() => {/* silent */});
                          }
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{member.name}</span>
                            {isReview && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(139,105,20,0.12)", color: "#8B6914", border: "1px solid rgba(139,105,20,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Review requested
                              </span>
                            )}
                            {member.member_status === "awaiting_protocol" && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(74,124,89,0.12)", color: "#4A7C59", border: "1px solid rgba(74,124,89,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Awaiting protocol
                              </span>
                            )}
                          </div>
                          {isReview && daysAgo !== null && (
                            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                              {daysAgo === 0 ? "Today" : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{member.tier}</div>
                        {isReview && <div style={{ fontSize: 11, color: "#8B6914" }}>Review →</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <div className="card">
            {payload.coach.members.length ? (
              payload.coach.members
                .filter((m) => m.member_status !== "review_requested" && m.member_status !== "awaiting_protocol")
                .map((member) => (
                <div className="metric-row" key={member.id}>
                  <div className="metric-label">{member.name}</div>
                  <div className="metric-label">{member.tier}</div>
                  <div className="metric-label">Recovery {member.recovery}</div>
                  <div className="metric-label">Muscle {member.muscle}</div>
                  <div className="metric-label">{member.session}</div>
                </div>
              ))
            ) : (
              <div className="card-body"><p style={{ color: "var(--text3)" }}>No members available.</p></div>
            )}
          </div>
          </>)}
        </div>

        <div id="coach-log" className="content" style={{ display: mode === "coach" && coachView === "log" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Log Session</div></div>
          <div className="card"><div className="card-body">Use this panel to log training sessions from the coach dashboard.</div></div>
        </div>

        <div id="coach-protocols" className="content" style={{ display: mode === "coach" && coachView === "protocols" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Protocol Library</div></div>

          {/* ── Tier filter ───────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {([["all", "All"] as const, ...(Object.entries(PROTOCOL_TIER_LABELS) as [ProtocolTier, string][])]).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setProtocolTierFilter(k as ProtocolTier | "all")}
                style={{
                  fontSize: 11, padding: "5px 12px", borderRadius: "var(--r-sm)", cursor: "pointer",
                  background: protocolTierFilter === k ? "rgba(157,204,58,0.15)" : "var(--bg3)",
                  border: `1px solid ${protocolTierFilter === k ? "rgba(157,204,58,0.4)" : "var(--border)"}`,
                  color: protocolTierFilter === k ? "var(--lime)" : "var(--text3)",
                  fontWeight: protocolTierFilter === k ? 600 : 400,
                }}
              >{v}</button>
            ))}
          </div>

          {/* ── Protocol cards ───────────────────────────────────────────── */}
          {coachProtocols.length === 0 ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <p style={{ color: "var(--text3)" }}>No protocols found. Run <code>protocols_tables.sql</code> in your Supabase SQL editor to seed the protocol library.</p>
              </div>
            </div>
          ) : (() => {
            // Deduplicate by name client-side (keep first occurrence)
            const seen = new Set<string>();
            const unique = coachProtocols.filter((p) => {
              if (seen.has(p.name)) return false;
              seen.add(p.name);
              return true;
            });
            const filtered = unique.filter((p) => {
              if (protocolTierFilter === "all") return true;
              return normalizeProtocolTier(p.tier) === protocolTierFilter;
            });
            if (filtered.length === 0) {
              return <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20, padding: "12px 0" }}>No protocols match the selected tier.</div>;
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {filtered.map((proto) => {
                  const tier = normalizeProtocolTier(proto.tier);
                  const isExpanded = expandedProtocolId === proto.id;
                  const isSelected = assignProtocolId === proto.id;
                  const days = protocolDaysCache[proto.id];
                  const isLoadingDays = loadingProtocolDays === proto.id;
                  const freqOptions = tier === "healthspan_elite" ? [3,4,5,6] : [1,2,3,4,5,6];
                  const selectedFreq = protocolFreqSelection[proto.id] ?? proto.days_per_week ?? freqOptions[Math.floor(freqOptions.length / 2)];
                  return (
                    <div
                      key={proto.id}
                      style={{
                        background: isSelected ? "rgba(157,204,58,0.06)" : "var(--bg2)",
                        border: `1px solid ${isSelected ? "rgba(157,204,58,0.35)" : "var(--border2)"}`,
                        borderRadius: "var(--r)",
                        overflow: "hidden",
                      }}
                    >
                      {/* Card header */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{proto.name}</span>
                            {tier && (
                              <span style={{ fontSize: 9, background: tier === "healthspan_elite" ? "rgba(168,85,240,0.15)" : "rgba(157,204,58,0.1)", color: tier === "healthspan_elite" ? "#a855f0" : "var(--lime)", border: `1px solid ${tier === "healthspan_elite" ? "rgba(168,85,240,0.4)" : "rgba(157,204,58,0.3)"}`, borderRadius: 3, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                                {PROTOCOL_TIER_LABELS[tier]}
                              </span>
                            )}
                            <span style={{ fontSize: 9, background: "rgba(255,255,255,0.05)", color: "var(--text3)", borderRadius: 3, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {formatTargetSystem(proto.target_system ?? "")}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: "var(--text3)", margin: "0 0 10px 0", lineHeight: 1.5 }}>{proto.description}</p>

                          {/* Frequency selector */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Days/week:</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {freqOptions.map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setProtocolFreqSelection((prev) => ({ ...prev, [proto.id]: n }))}
                                  style={{
                                    width: 28, height: 28, borderRadius: "50%", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                    background: selectedFreq === n ? "var(--lime)" : "var(--bg3)",
                                    border: `1px solid ${selectedFreq === n ? "var(--lime)" : "var(--border)"}`,
                                    color: selectedFreq === n ? "#0b0c09" : "var(--text3)",
                                    transition: "all 0.15s",
                                  }}
                                >{n}</button>
                              ))}
                            </div>
                            <span style={{ fontSize: 10, color: "var(--text3)" }}>×/wk{tier === "healthspan_elite" ? " (Elite: 3–6 required)" : ""}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => {
                              const next = isExpanded ? null : proto.id;
                              setExpandedProtocolId(next);
                              if (next && !protocolDaysCache[proto.id]) {
                                setLoadingProtocolDays(proto.id);
                                void getJson<{ days: ProtocolDay[] }>(`/api/coach/protocol-days?protocol_id=${proto.id}`)
                                  .then((r) => { setProtocolDaysCache((prev) => ({ ...prev, [proto.id]: r.days ?? [] })); })
                                  .catch(() => { setProtocolDaysCache((prev) => ({ ...prev, [proto.id]: [] })); })
                                  .finally(() => setLoadingProtocolDays(null));
                              }
                            }}
                            style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", color: "var(--text3)", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}
                          >
                            {isExpanded ? "Collapse" : "View days"}
                          </button>
                          <button
                            type="button"
                            className={isSelected ? "btn btn-lime btn-sm" : "btn btn-sm"}
                            onClick={() => setAssignProtocolId(isSelected ? "" : proto.id)}
                            style={{ fontSize: 11 }}
                          >
                            {isSelected ? "✓ Selected" : "Select"}
                          </button>
                        </div>
                      </div>

                      {/* Science rationale */}
                      {proto.science_rationale && (
                        <div style={{ padding: "0 16px 12px" }}>
                          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
                            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 6 }}>Science Rationale</div>
                            <p style={{ fontSize: 12, color: "var(--text2)", margin: 0, lineHeight: 1.65 }}>{proto.science_rationale}</p>
                          </div>
                        </div>
                      )}

                      {/* Day breakdown */}
                      {isExpanded && (
                        <div style={{ padding: "0 16px 14px" }}>
                          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 10 }}>
                            Session Breakdown — {selectedFreq}x / week
                          </div>
                          {/* Legend */}
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                            {[
                              { style: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text2)" }, label: "Core" },
                              { style: { background: "rgba(85,184,240,0.18)", border: "1px solid rgba(85,184,240,0.6)", color: "#55b8f0" }, label: "Cold plunge — recommended" },
                              { style: { background: "transparent", border: "1px dashed rgba(85,184,240,0.5)", color: "#55b8f0" }, label: "Cold plunge — optional" },
                              { style: { background: "rgba(240,112,85,0.12)", border: "1px solid rgba(240,112,85,0.4)", color: "#f07055" }, label: "Never after ARX/Katalyst" },
                              { style: { background: "transparent", border: "1px dashed rgba(255,255,255,0.2)", color: "var(--text3)" }, label: "Optional add-on" },
                              { style: { background: "rgba(168,85,240,0.15)", border: "1px solid rgba(168,85,240,0.5)", color: "#a855f0" }, label: "NxPro (Elite)" },
                              { style: { background: "rgba(240,185,85,0.15)", border: "1px solid rgba(240,185,85,0.5)", color: "#f0b955" }, label: "Proteus" },
                            ].map((item) => (
                              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ fontSize: 9, borderRadius: 3, padding: "1px 6px", ...item.style }}>eg</span>
                                <span style={{ fontSize: 9, color: "var(--text3)" }}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                          {isLoadingDays ? (
                            <div style={{ fontSize: 12, color: "var(--text3)", padding: "8px 0" }}>Loading days…</div>
                          ) : !days || days.length === 0 ? (
                            <div style={{ fontSize: 12, color: "var(--text3)", padding: "8px 0" }}>No day-level data for this protocol yet.</div>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                              {days.slice(0, selectedFreq).map((day) => (
                                <div key={day.id} style={{ background: "var(--bg3)", borderRadius: "var(--r-sm)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{day.dayName}</div>
                                  <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 8, lineHeight: 1.4 }}>{day.dayTheme}</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {day.activities.length === 0 ? (
                                      <span style={{ fontSize: 10, color: "var(--text3)", fontStyle: "italic" }}>Rest</span>
                                    ) : day.activities.map((act) => {
                                      const tagStyle = equipmentTagStyle(act.type, act.coldPlunge, act.isOptional);
                                      return (
                                        <span key={act.id} title={act.name} style={{ fontSize: 10, borderRadius: 3, padding: "2px 7px", lineHeight: 1.5, ...tagStyle }}>
                                          {act.durationMinutes > 0 ? `${act.name} (${act.durationMinutes}m)` : act.name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Assign form ──────────────────────────────────────────────── */}
          {(() => {
            const assignedProto = coachProtocols.find((p) => p.id === assignProtocolId);
            const assignTier = normalizeProtocolTier(assignedProto?.tier);
            const assignFreqOptions = assignTier === "healthspan_elite" ? [3,4,5,6] : [1,2,3,4,5,6];
            const assignFreq = assignProtocolId ? (protocolFreqSelection[assignProtocolId] ?? assignedProto?.days_per_week ?? 3) : null;
            return (
          <div className="card">
            <div className="card-header"><div className="card-title">Assign to member</div></div>
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 6 }}>Member</label>
                <select
                  className="form-input"
                  value={assignMemberId}
                  onChange={(e) => setAssignMemberId(e.target.value)}
                >
                  <option value="">Select member…</option>
                  {(allMembers.length > 0 ? allMembers : effectiveCoachRecipients).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{("tier" in m && m.tier) ? ` — ${m.tier}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 6 }}>Protocol</label>
                <select
                  className="form-input"
                  value={assignProtocolId}
                  onChange={(e) => setAssignProtocolId(e.target.value)}
                >
                  <option value="">Select protocol…</option>
                  {(() => {
                    const seen = new Set<string>();
                    return coachProtocols.filter((p) => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
                  })().map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.tier ? ` — ${PROTOCOL_TIER_LABELS[normalizeProtocolTier(p.tier) ?? "longevity"] ?? p.tier}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 6 }}>Start date</label>
                <input
                  className="form-input"
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>Note to member</label>
                <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 6, lineHeight: 1.5 }}>This appears at the top of their protocol tab, signed with your name. Keep it personal and specific to them.</div>
                <textarea
                  className="form-input"
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. Focus on driving through the full range on leg press — your eccentric is strong, let's match it on the way down."
                  value={assignCoachNotes}
                  onChange={(e) => setAssignCoachNotes(e.target.value)}
                  style={{ width: "100%", resize: "vertical", boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "right", marginTop: 3 }}>{assignCoachNotes.length}/300</div>
              </div>
              {assignProtocolId && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 8 }}>
                    Days per week{assignTier === "healthspan_elite" ? " (Elite: 3–6 required)" : ""}
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {assignFreqOptions.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setProtocolFreqSelection((prev) => ({ ...prev, [assignProtocolId]: n }))}
                        style={{
                          width: 36, height: 36, borderRadius: "50%", fontSize: 13, fontWeight: 600, cursor: "pointer",
                          background: assignFreq === n ? "var(--lime)" : "var(--bg3)",
                          border: `1px solid ${assignFreq === n ? "var(--lime)" : "var(--border)"}`,
                          color: assignFreq === n ? "#0b0c09" : "var(--text3)",
                          transition: "all 0.15s",
                        }}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: "0 20px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="btn btn-lime btn-sm"
                type="button"
                disabled={isAssigning || !assignMemberId || !assignProtocolId}
                onClick={async () => {
                  if (!assignMemberId || !assignProtocolId) return;
                  setIsAssigning(true);
                  setAssignStatus("Assigning…");
                  try {
                    await postJson("/api/coach/protocols", {
                      action: "assign",
                      member_id: assignMemberId,
                      protocol_id: assignProtocolId,
                      start_date: assignStartDate,
                      coach_notes: assignCoachNotes || undefined,
                      days_per_week: assignFreq ?? undefined,
                    });
                    setAssignStatus(`✓ Assigned ${assignedProto?.name ?? "protocol"}${assignFreq ? ` at ${assignFreq}x/week` : ""} successfully.`);
                    setAssignMemberId("");
                    setAssignProtocolId("");
                    setAssignCoachNotes("");
                  } catch (err) {
                    setAssignStatus(err instanceof Error ? err.message : "Failed to assign protocol.");
                  } finally {
                    setIsAssigning(false);
                  }
                }}
              >
                {isAssigning ? "Assigning…" : `Assign${assignedProto && assignFreq ? ` ${assignedProto.name} — ${assignFreq}x/wk` : ""}`}
              </button>
              {assignStatus && (
                <span style={{ fontSize: 12, color: assignStatus.startsWith("✓") ? "#4A7C59" : "#B84040" }}>
                  {assignStatus}
                </span>
              )}
            </div>
          </div>
            );
          })()}

          {/* Member goals section — shown when a member is selected */}
          {assignMemberId && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header"><div className="card-title">Member Goals</div></div>
              {loadingMemberGoals ? (
                <div className="card-body" style={{ color: "var(--text3)", fontSize: 12 }}>Loading goals…</div>
              ) : (
                <div style={{ padding: "8px 20px 16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {(["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const).map((gt) => {
                      const isOn = memberGoals[gt] ?? false;
                      return (
                        <div key={gt} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                          <span style={{ fontSize: 12, color: "var(--text2)" }}>{GOAL_DEFS[gt]?.name ?? gt}</span>
                          <button
                            type="button"
                            onClick={() => { void handleGoalToggle(gt, assignMemberId); }}
                            style={{ width: 40, height: 22, borderRadius: 11, background: isOn ? "#4A7C59" : "var(--bg3)", border: `2px solid ${isOn ? "#4A7C59" : "var(--border)"}`, cursor: "pointer", padding: 0, position: "relative", transition: "all 0.2s", flexShrink: 0 }}
                          >
                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: isOn ? 20 : 2, transition: "left 0.2s" }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {/* Protocol recommendation + quick-assign */}
                  {(() => {
                    const active = Object.entries(memberGoals).filter(([, v]) => v).map(([k]) => k);
                    const rec = recommendProtocol(active);
                    if (!rec || active.length === 0) return null;
                    const recProtocol = coachProtocols.find((p) => p.name === rec);
                    return (
                      <div style={{ background: "rgba(74,124,89,0.06)", border: "1px solid rgba(74,124,89,0.18)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
                        <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 8 }}>
                          Based on goals: recommend <strong style={{ color: "var(--text)" }}>{rec}</strong>
                        </div>
                        {recProtocol && (
                          <button
                            type="button"
                            className="btn btn-lime btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => setAssignProtocolId(recProtocol.id)}
                          >
                            Use {rec} →
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Session notes — shown when a member is selected */}
          {assignMemberId && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header"><div className="card-title">Session Notes</div></div>
              <div style={{ padding: "12px 20px 16px" }}>
                <textarea className="form-input" style={{ width: "100%", minHeight: 80, resize: "vertical", marginBottom: 10, boxSizing: "border-box" }} placeholder="Add a session note for this member…" value={coachNoteText} onChange={(e) => setCoachNoteText(e.target.value)} />
                <button type="button" className="btn btn-lime btn-sm" disabled={savingNote || !coachNoteText.trim()}
                  onClick={async () => {
                    if (!coachNoteText.trim() || savingNote) return;
                    setSavingNote(true);
                    try {
                      await postJson("/api/coach/session-notes", { member_id: assignMemberId, note: coachNoteText.trim() });
                      setMemberNotes((prev) => [{ id: Date.now().toString(), note: coachNoteText.trim(), created_at: new Date().toISOString() }, ...prev.slice(0, 4)]);
                      setCoachNoteText("");
                    } catch { /* silent */ } finally { setSavingNote(false); }
                  }}>
                  {savingNote ? "Saving…" : "Save Note"}
                </button>
                {memberNotes.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recent notes</div>
                    {memberNotes.map((n) => (
                      <div key={n.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                        <p style={{ fontSize: 12.5, color: "var(--text2)", margin: 0, lineHeight: 1.55 }}>{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Week View modal ────────────────────────────────────────────── */}
        {weekViewOpen && (
          <div style={{ position: "fixed", inset: 0, background: "#1C2B1E", zIndex: 2000, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1C2B1E" }}>This week&apos;s plan</div>
              <button type="button" style={{ background: "none", border: "none", color: "#6B7B6E", cursor: "pointer", fontSize: 20, padding: 0 }} onClick={() => { setWeekViewOpen(false); setWeekViewDay(null); }}>✕</button>
            </div>
            {weekPlan.length === 0 ? (
              <div style={{ padding: 32, color: "#6B7B6E", fontSize: 13 }}>Run protocol_days.sql in Supabase to load your week plan.</div>
            ) : weekViewDay !== null ? (
              /* Single day expanded */
              (() => {
                const day = weekPlan.find((d) => d.dayOfWeek === weekViewDay);
                if (!day) return null;
                return (
                  <div style={{ padding: "20px 24px", maxWidth: 600, margin: "0 auto" }}>
                    <button type="button" style={{ background: "none", border: "none", color: "#4A7C59", cursor: "pointer", fontSize: 12, padding: "0 0 16px 0", display: "block" }} onClick={() => setWeekViewDay(null)}>← Back to week</button>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#1C2B1E", marginBottom: 4, fontFamily: "Georgia, serif" }}>{day.dayName} — {day.dayTheme}</div>
                    <p style={{ fontSize: 13, color: "#6B7B6E", lineHeight: 1.6, marginBottom: 20 }}>{day.dayDescription}</p>
                    {day.activities.map((act, i) => (
                      <div key={act.id} style={{ background: "rgba(28,43,30,0.03)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#1C2B1E" }}>{i + 1}. {act.name}</span>
                          <span style={{ fontSize: 12, color: "#6B7B6E" }}>{act.durationMinutes} min</span>
                        </div>
                        <p style={{ fontSize: 12.5, color: "#6B7B6E", margin: 0, lineHeight: 1.5 }}>{act.description}</p>
                        {act.isOptional && <div style={{ fontSize: 11, color: "rgba(157,204,58,0.6)", marginTop: 6 }}>Optional</div>}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: "#6B7B6E", marginTop: 12 }}>Total: ~{day.totalMinutes} minutes</div>
                  </div>
                );
              })()
            ) : (
              /* Week overview */
              <div>
                {/* Customization notes from Dustin */}
                {weekPlanMeta.customizationNotes && (
                  <div style={{ margin: "8px 16px 0", background: "rgba(220,180,100,0.08)", border: "1px solid rgba(196,131,26,0.18)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(196,131,26,0.8)", marginBottom: 6 }}>Dustin&apos;s notes for your plan</div>
                    <p style={{ fontSize: 12.5, color: "#c4c0b4", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>&ldquo;{weekPlanMeta.customizationNotes}&rdquo;</p>
                  </div>
                )}
                <div style={{ padding: "8px 0" }}>
                  {weekPlan.map((day) => {
                    const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
                    const isToday = day.dayOfWeek === todayDow;
                    const override = weekPlanMeta.overrides.find((o) => o.protocolDayId === day.id);
                    const actSummary = day.activities.map((a) => a.name).join(" · ");
                    return (
                      <div key={day.dayOfWeek} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 20px 10px", background: isToday ? "rgba(157,204,58,0.05)" : "transparent" }}>
                          <button type="button" onClick={() => setWeekViewDay(day.dayOfWeek)}
                            style={{ flex: 1, background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0, display: "flex", gap: 16, alignItems: "flex-start" }}>
                            <div style={{ width: 32, flexShrink: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? "#4A7C59" : "#1C2B1E" }}>{day.dayName.slice(0, 3)}</div>
                              {isToday && <div style={{ fontSize: 8, color: "#4A7C59", textTransform: "uppercase" }}>Today</div>}
                              {override && <div style={{ fontSize: 8, color: "#C4831A" }}>Moved</div>}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1C2B1E", marginBottom: 3 }}>{day.dayTheme}</div>
                              <div style={{ fontSize: 11, color: "#6B7B6E" }}>{actSummary || "Rest"}</div>
                              {override && <div style={{ fontSize: 10, color: "#C4831A", marginTop: 2 }}>→ moved to {DAY_NAMES[override.overrideDow]}</div>}
                            </div>
                            <div style={{ marginLeft: "auto", fontSize: 11, color: "#6B7B6E", flexShrink: 0 }}>{day.totalMinutes > 0 ? `~${day.totalMinutes}m` : ""}</div>
                          </button>
                        </div>
                        {/* Move to different day */}
                        {day.activities.length > 0 && (
                          <div style={{ padding: "0 20px 10px" }}>
                            {dayPickerOpen.day?.id === day.id ? (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "#6B7B6E" }}>Move to:</span>
                                {[1,2,3,4,5,6,7].filter((d) => d !== day.dayOfWeek).map((d) => (
                                  <button key={d} type="button"
                                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#E8E2D9", border: "1px solid rgba(255,255,255,0.1)", color: "#c4c0b4", cursor: "pointer", opacity: movingDay ? 0.6 : 1 }}
                                    disabled={movingDay}
                                    onClick={async () => {
                                      setMovingDay(true);
                                      try {
                                        await fetch("/api/member/schedule-override", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocol_day_id: day.id, original_day_of_week: day.dayOfWeek, override_day_of_week: d }) });
                                        setWeekPlanMeta((prev) => ({ ...prev, overrides: [...prev.overrides.filter((o) => o.protocolDayId !== day.id), { protocolDayId: day.id, originalDow: day.dayOfWeek, overrideDow: d }] }));
                                        setDayPickerOpen({ day: null });
                                      } catch { /* */ } finally { setMovingDay(false); }
                                    }}>
                                    {DAY_NAMES[d].slice(0, 3)}
                                  </button>
                                ))}
                                <button type="button" style={{ fontSize: 11, color: "#6B7B6E", background: "none", border: "none", cursor: "pointer" }} onClick={() => setDayPickerOpen({ day: null })}>Cancel</button>
                                {override && (
                                  <button type="button" style={{ fontSize: 11, color: "#B84040", background: "none", border: "none", cursor: "pointer" }}
                                    onClick={async () => { setMovingDay(true); try { await fetch("/api/member/schedule-override", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocol_day_id: day.id }) }); setWeekPlanMeta((prev) => ({ ...prev, overrides: prev.overrides.filter((o) => o.protocolDayId !== day.id) })); setDayPickerOpen({ day: null }); } catch { /* */ } finally { setMovingDay(false); } }}>
                                    Reset to {DAY_NAMES[day.dayOfWeek].slice(0,3)}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button type="button" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                onClick={() => setDayPickerOpen({ day })}>
                                Move to different day →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ARX exercise history overlay */}
        {selectedArxExercise && (() => {
          const exSessions = payload.arxSessions.filter((s) => s.exercise === selectedArxExercise).slice(0, 200);
          const byDate = new Map<string, { conc: number | null; ecc: number | null; date: string }>();
          for (const s of exSessions) {
            const d = s.sessionDate.slice(0, 10);
            const cur = byDate.get(d);
            if (!cur || (s.concentricMax ?? 0) > (cur.conc ?? 0)) byDate.set(d, { conc: s.concentricMax, ecc: s.eccentricMax, date: d });
          }
          const rows = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
          const rowsAsc = [...rows].reverse();
          const sparkValsH = rowsAsc.map((r) => r.conc);
          const pathH = sparklinePath(sparkValsH, 200, 40);
          const allConc = rows.map((r) => r.conc ?? 0).filter((v) => v > 0);
          const prConc = allConc.length ? Math.max(...allConc) : 0;
          return (
            <div style={{ position: "fixed", inset: 0, background: "var(--bg2)", zIndex: 2000, display: "flex", flexDirection: "column", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg2)" }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 3 }}>Exercise History</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{selectedArxExercise}</div>
                </div>
                <button type="button" style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 22, padding: "4px 8px", lineHeight: 1 }} onClick={() => setSelectedArxExercise(null)}>✕</button>
              </div>

              <div style={{ flex: 1, padding: "20px 20px 32px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                  <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>PR</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#4A7C59" }}>{prConc > 0 ? `${Math.round(prConc)} lbs` : "—"}</div>
                    <div style={{ fontSize: 9, color: "var(--text3)" }}>concentric</div>
                  </div>
                  <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Sessions</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{rows.length}</div>
                    <div style={{ fontSize: 9, color: "var(--text3)" }}>total</div>
                  </div>
                  <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Last</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{rows[0]?.conc != null ? `${Math.round(rows[0].conc)}` : "—"}</div>
                    <div style={{ fontSize: 9, color: "var(--text3)" }}>lbs conc</div>
                  </div>
                </div>

                {/* Progression chart */}
                {pathH && (
                  <div style={{ background: "var(--bg2)", borderRadius: "var(--r)", padding: "14px 16px", marginBottom: 20 }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>Concentric max progression</div>
                    <svg viewBox="0 0 200 40" style={{ width: "100%", height: 44, display: "block", marginBottom: 6 }}>
                      <path d={pathH} fill="none" stroke="#4A7C59" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: "var(--text3)" }}>{rowsAsc[0]?.conc != null ? `${Math.round(rowsAsc[0].conc)} lbs` : ""}</span>
                      <span style={{ fontSize: 10, color: "var(--text3)" }}>→</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#4A7C59" }}>{rows[0]?.conc != null ? `${Math.round(rows[0].conc)} lbs today` : ""}</span>
                    </div>
                  </div>
                )}

                {/* Session log */}
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>Session log</div>
                <div style={{ background: "var(--bg2)", borderRadius: "var(--r)" }}>
                  {rows.map((r, i) => {
                    const ratio = r.conc && r.ecc ? r.ecc / r.conc : null;
                    const isPR = r.conc != null && r.conc === prConc;
                    const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                    return (
                      <div key={r.date} style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: i > 0 ? "1px solid var(--border)" : "none", background: isPR ? "rgba(157,204,58,0.04)" : "transparent" }}>
                        <div style={{ fontSize: 12, color: "var(--text3)", flexShrink: 0, width: 110 }}>{dateLabel}</div>
                        <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {r.conc != null && <span style={{ fontSize: 13, color: "var(--text2)" }}>Conc <b style={{ color: isPR ? "#4A7C59" : "var(--text)" }}>{Math.round(r.conc)} lbs</b></span>}
                          {r.ecc != null && <span style={{ fontSize: 13, color: "var(--text2)" }}>Ecc <b style={{ color: "var(--text)" }}>{Math.round(r.ecc)} lbs</b></span>}
                          {ratio != null && <span style={{ fontSize: 12, color: eccRatioLabel(ratio).color }}>{ratio.toFixed(2)}×</span>}
                        </div>
                        {isPR && <span style={{ fontSize: 10, fontWeight: 700, color: "#4A7C59", flexShrink: 0 }}>PR</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Core activity guardrail modal */}
        {guardrailItem && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) { setGuardrailItem(null); setGuardrailSent(false); } }}>
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "24px", maxWidth: 400, width: "100%" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>This is a core part of your protocol</div>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, marginBottom: 14 }}>
                Removing {guardrailItem.type === "arx" ? "strength training" : "CAROL REHIT sprint intervals"} from your plan affects your results significantly. These sessions are the foundation of everything else in your protocol.
              </p>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, marginBottom: 16 }}>Want to request an adjustment from Dustin?</p>
              {guardrailSent ? (
                <div style={{ fontSize: 13, color: "#4A7C59", fontWeight: 500, marginBottom: 12 }}>✓ Request sent. Dustin will review and follow up.</div>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-sm" disabled={sendingGuardrail}
                    onClick={async () => {
                      setSendingGuardrail(true);
                      try {
                        await fetch("/api/member/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "protocol_adjustment_request", message: `Member requested to remove ${guardrailItem.label} from their plan.` }) });
                        setGuardrailSent(true);
                      } catch { /* */ } finally { setSendingGuardrail(false); }
                    }}>
                    {sendingGuardrail ? "Sending…" : "Send request to Dustin"}
                  </button>
                  <button type="button" className="btn btn-lime btn-sm" onClick={() => { setGuardrailItem(null); setGuardrailSent(false); }}>
                    Keep in my plan
                  </button>
                </div>
              )}
              {guardrailSent && (
                <button type="button" className="btn btn-sm" style={{ marginTop: 10, fontSize: 11 }} onClick={() => { setGuardrailItem(null); setGuardrailSent(false); }}>Close</button>
              )}
            </div>
          </div>
        )}

        {/* Protocol request modal */}
        {showProtocolModal && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowProtocolModal(false); }}
          >
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "24px", maxWidth: 480, width: "100%" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Request Protocol Adjustment</div>
              <p style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 14, lineHeight: 1.6 }}>Tell Dustin what you&apos;d like to change and why. He&apos;ll review and update your protocol.</p>
              {protocolRequestSent ? (
                <div style={{ color: "#4A7C59", fontSize: 13, fontWeight: 500, padding: "12px 0" }}>
                  ✓ Request sent. Dustin will review and update your protocol.
                </div>
              ) : (
                <>
                  <textarea
                    className="form-input"
                    style={{ width: "100%", minHeight: 100, resize: "vertical", marginBottom: 14, boxSizing: "border-box" }}
                    placeholder="e.g. I'd like to add more cardio sessions and reduce the recovery target — I've been feeling good and want to push harder."
                    value={protocolRequestText}
                    onChange={(e) => setProtocolRequestText(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-lime btn-sm"
                      disabled={sendingProtocolRequest || !protocolRequestText.trim()}
                      onClick={async () => {
                        if (!protocolRequestText.trim() || sendingProtocolRequest) return;
                        setSendingProtocolRequest(true);
                        try {
                          await postJson("/api/member/notifications", { type: "protocol_change_request", message: protocolRequestText.trim() });
                          setProtocolRequestSent(true);
                          setProtocolRequestText("");
                        } catch { /* silent */ } finally { setSendingProtocolRequest(false); }
                      }}
                    >
                      {sendingProtocolRequest ? "Sending…" : "Send Request"}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setShowProtocolModal(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Coach notifications panel */}
        {notifPanelOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setNotifPanelOpen(false)} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 380, maxWidth: "100vw", background: "var(--bg2)", borderLeft: "1px solid var(--border)", zIndex: 1000, overflowY: "auto", boxShadow: "-6px 0 24px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Notifications</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {coachNotifs.some((n) => !n.is_read) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ fontSize: 10 }}
                      onClick={async () => {
                        try {
                          await postJson("/api/coach/notifications", { mark_all_read: true });
                          setCoachNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
                          setNotifUnreadCount(0);
                        } catch { /* silent */ }
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                  <button type="button" style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 18, padding: 0 }} onClick={() => setNotifPanelOpen(false)}>✕</button>
                </div>
              </div>
              {coachNotifs.length === 0 ? (
                <div style={{ padding: 24, color: "var(--text3)", fontSize: 13 }}>No notifications yet.</div>
              ) : (
                coachNotifs.map((notif) => (
                  <div key={notif.id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: notif.is_read ? "transparent" : "rgba(157,204,58,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{notif.member_name}</span>
                        {!notif.is_read && <span style={{ marginLeft: 8, fontSize: 9, background: "#4A7C59", color: "#1C2B1E", borderRadius: 3, padding: "1px 5px", fontWeight: 700 }}>NEW</span>}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text3)", whiteSpace: "nowrap" }}>
                        {new Date(notif.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                      {notif.type === "protocol_review_requested" ? "Profile review request"
                        : notif.type === "protocol_change_request" ? "Protocol change request"
                        : "General"}
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 10px 0" }}>{notif.message}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!notif.is_read && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: 10 }}
                          onClick={async () => {
                            try {
                              await postJson("/api/coach/notifications", { notification_id: notif.id });
                              setCoachNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
                              setNotifUnreadCount((c) => Math.max(0, c - 1));
                            } catch { /* silent */ }
                          }}
                        >
                          Mark read
                        </button>
                      )}
                      {notif.type === "protocol_review_requested" && (
                        <button
                          type="button"
                          className="btn btn-lime btn-sm"
                          style={{ fontSize: 10 }}
                          onClick={() => {
                            setReviewMemberId(notif.member_id);
                            setReviewMemberName(notif.member_name);
                            setReviewNotifId(notif.id);
                            setReviewDiff(notif.payload?.diff ?? []);
                            setReviewRecommendation(notif.payload?.recommendation ?? null);
                            setReviewRecommendationReason(notif.payload?.recommendation_reason ?? null);
                            setReviewCoachNote("");
                            setReviewProtocolChanged(false);
                            setReviewConfirmMsg(null);
                            setReviewDiffCollapsed(true);
                            setCoachView("members");
                            setMode("coach");
                            setNotifPanelOpen(false);
                            if (coachProtocols.length === 0) {
                              void getJson<{ protocols: CoachProtocol[] }>("/api/coach/protocols")
                                .then((r) => { if (Array.isArray(r.protocols)) setCoachProtocols(r.protocols); })
                                .catch(() => {/* silent */});
                            }
                          }}
                        >
                          Review profile →
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: 10 }}
                        onClick={() => {
                          setSelectedCoachRecipientId(notif.member_id);
                          setCoachView("messages");
                          setMode("coach");
                          setNotifPanelOpen(false);
                          void loadMessages(true, notif.member_id);
                        }}
                      >
                        Message member →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export type { DashboardPayload, MemberSection, CoachSection };
