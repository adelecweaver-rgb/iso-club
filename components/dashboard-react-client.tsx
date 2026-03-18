"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MemberSection =
  | "dashboard"
  | "protocol"
  | "carol"
  | "arx"
  | "scans"
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
    arxPerWeek: number;
    carolPerWeek: number;
    recoveryPerMonth: number;
    carolRideTypes: string[];
    arxExercises: string[];
    coachNotes: string;
    startDate: string;
    compliance: { arxThisWeek: number; carolThisWeek: number; recoveryThisMonth: number };
  };
  bookings: Array<{ label: string; status: string }>;
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
  return change.direction === goodDirection ? "#9dcc3a" : "#e05252";
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
  if (vo2 >= 55) return { label: "Excellent", color: "#9dcc3a", barPct };
  if (vo2 >= 50) return { label: "Very Good", color: "#9dcc3a", barPct };
  if (vo2 >= 44) return { label: "Good", color: "#9dcc3a", barPct };
  if (vo2 >= 35) return { label: "Average", color: "#e8a838", barPct };
  return { label: "Below Average", color: "#e05252", barPct };
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
  if (ratio >= 1.3) return { label: "Excellent", color: "#9dcc3a" };
  if (ratio >= 1.15) return { label: "Good", color: "#9dcc3a" };
  if (ratio >= 1.0) return { label: "Developing", color: "#e8a838" };
  return { label: "Review form", color: "#e05252" };
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
  if (direction === "positive") return "#9dcc3a";
  if (direction === "neutral") return "#e8a838";
  if (direction === "negative") return "#e05252";
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



function recommendProtocol(activeGoals: string[]): string | null {
  const g = new Set(activeGoals);
  if (g.size === 0) return null;
  if ((g.has("gain_muscle") && g.has("lose_fat") && g.has("improve_cardio")) || g.size >= 4) return "Longevity Protocol";
  if (g.has("gain_muscle") && g.has("improve_cardio")) return "Longevity Protocol";
  if (g.has("gain_muscle") && g.has("lose_fat")) return "Metabolic Reset";
  if (g.has("lose_fat")) return "Metabolic Reset";
  if (g.has("improve_cardio")) return "Cardio Focus";
  return "Strength Foundation";
}

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

function isChecklistBlockedToday(
  item: ChecklistItem,
  c: DashboardPayload["checklistCompletions"],
  local: Record<string, boolean>,
): boolean {
  if (isChecklistItemDone(item, c, local)) return true;
  if (item.type === "arx") return c.arxTodayLogged;
  if (item.type === "carol") return c.carolTodayTypes.includes(item.subtype);
  if (item.type === "recovery") return c.recoveryTodayModalities.includes(item.subtype);
  return false;
}


function formatTargetSystem(s: string): string {
  const map: Record<string, string> = { muscle: "Muscle", cardio: "Cardio", metabolic: "Metabolic", recovery: "Recovery", performance: "Performance" };
  return map[s] ?? s;
}

function formatExerciseName(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  const [checklistLogging, setChecklistLogging] = useState<string | null>(null);

  const handleChecklistItem = useCallback(async (item: ChecklistItem, c: DashboardPayload["checklistCompletions"]) => {
    if (isChecklistItemDone(item, c, checklistChecked)) return;
    if (checklistLogging) return;
    setChecklistLogging(item.id);
    try {
      const res = await fetch("/api/member/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, subtype: item.subtype }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; already_logged?: boolean };
      if (res.ok || json.already_logged) {
        setChecklistChecked((prev) => ({ ...prev, [item.id]: true }));
        if (item.type === "arx") { c.arxWeekDates.push(c.todayDate); c.arxTodayLogged = true; }
        else if (item.type === "carol") { c.carolWeekTypes.push(item.subtype); c.carolTodayTypes.push(item.subtype); }
        else if (item.type === "recovery") { c.recoveryWeekModalities.push(item.subtype); c.recoveryTodayModalities.push(item.subtype); }
      }
    } finally {
      setChecklistLogging(null);
    }
  }, [checklistChecked, checklistLogging]);
  const [coachProtocols, setCoachProtocols] = useState<Array<{ id: string; name: string; target_system: string; description: string }>>([]);
  const [allMembers, setAllMembers] = useState<Array<{ id: string; name: string; tier: string }>>([]);
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
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [protocolRequestText, setProtocolRequestText] = useState("");
  const [sendingProtocolRequest, setSendingProtocolRequest] = useState(false);
  const [protocolRequestSent, setProtocolRequestSent] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [coachNotifs, setCoachNotifs] = useState<Array<{ id: string; member_id: string; member_name: string; type: string; message: string; is_read: boolean; created_at: string }>>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifLoaded, setNotifLoaded] = useState(false);
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
        if (coachProtocols.length === 0) {
          const res = await getJson<{ protocols: typeof coachProtocols }>("/api/coach/protocols");
          if (Array.isArray(res.protocols)) setCoachProtocols(res.protocols);
        }
        if (allMembers.length === 0) {
          const res = await getJson<{ members: typeof allMembers }>("/api/coach/members");
          if (Array.isArray(res.members)) setAllMembers(res.members);
        }
      } catch { /* tables may not exist yet */ }
    })();
  }, [coachView, isCoachAccount, mode, coachProtocols.length, allMembers.length]);

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
          <div className="logo-word">
            Iso<em>.</em>
          </div>
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
            <div className="nav-group-label">Overview</div>
            <button className={activeMemberView("dashboard")} onClick={() => setMemberSection("dashboard")} type="button">
              Dashboard
            </button>
            <button className={activeMemberView("goals")} onClick={() => setMemberSection("goals")} type="button">
              My Goals
            </button>
            <button className={activeMemberView("protocol")} onClick={() => setMemberSection("protocol")} type="button">
              My Protocol
            </button>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">Machine Data</div>
            <button className={activeMemberView("carol")} onClick={() => setMemberSection("carol")} type="button">
              CAROL
            </button>
            <button className={activeMemberView("arx")} onClick={() => setMemberSection("arx")} type="button">
              ARX Strength
            </button>
            <button className={activeMemberView("scans")} onClick={() => setMemberSection("scans")} type="button">
              Body Scans
            </button>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">Recovery</div>
            <button className={activeMemberView("recovery")} onClick={() => setMemberSection("recovery")} type="button">
              Recovery
            </button>
            <button className={activeMemberView("wearables")} onClick={() => setMemberSection("wearables")} type="button">
              Wearables
            </button>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">Connect</div>
            <button className={activeMemberView("messages")} onClick={() => setMemberSection("messages")} type="button">
              Messages
              {messageBadge ? <span className="nav-badge">{messageBadge}</span> : null}
            </button>
            <button className={activeMemberView("reports")} onClick={() => setMemberSection("reports")} type="button">
              Reports
            </button>
            <button className={activeMemberView("schedule")} onClick={() => setMemberSection("schedule")} type="button">
              Schedule
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
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-tier">{payload.tier}</div>
            </div>
          </div>
          <div className="wearable-dots">
            <div className="w-dot connected">
              <div className="w-dot-circle" />
              Whoop
            </div>
            <div className="w-dot connected">
              <div className="w-dot-circle" />
              Oura
            </div>
          </div>
          <button
            className="btn btn-sm"
            type="button"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => {
              void handleSignOut();
            }}
          >
            Sign Out
          </button>
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
                <Link className="btn btn-sm" href="/dashboard/upload">
                  Upload Data
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
                  <span style={{ position: "absolute", top: -4, right: -4, background: "#e05252", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
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

          {/* ── Section 1: Vitality Age ─────────────────────────────────── */}
          <div style={{ background: "linear-gradient(135deg, rgba(157,204,58,0.06) 0%, rgba(157,204,58,0.02) 100%)", border: "1px solid rgba(157,204,58,0.2)", borderRadius: "var(--r)", padding: "28px 28px 24px", marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(157,204,58,0.7)", marginBottom: 12 }}>Your Vitality Age</div>
            {payload.vitalityAge.hasEnoughData && payload.vitalityAge.estimated !== null ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 10 }}>
                  <div style={{ fontSize: 72, fontWeight: 800, color: "var(--text)", lineHeight: 1, fontFamily: "Georgia, serif" }}>{payload.vitalityAge.estimated}</div>
                  <div style={{ paddingBottom: 8, color: "var(--text3)", fontSize: 13 }}>years old (functionally)</div>
                </div>
                {payload.vitalityAge.difference !== null && payload.vitalityAge.difference !== 0 && (
                  <div style={{ fontSize: 14, color: payload.vitalityAge.difference > 0 ? "#9dcc3a" : "#e05252", fontWeight: 500, marginBottom: 6 }}>
                    {payload.vitalityAge.difference > 0
                      ? `You're functioning ${payload.vitalityAge.difference} year${payload.vitalityAge.difference !== 1 ? "s" : ""} younger than your age`
                      : `Vitality age is ${Math.abs(payload.vitalityAge.difference)} year${Math.abs(payload.vitalityAge.difference) !== 1 ? "s" : ""} above chronological age`}
                  </div>
                )}
                {payload.vitalityAge.trend !== null && payload.vitalityAge.trend !== 0 && (
                  <div style={{ fontSize: 12, color: payload.vitalityAge.trend > 0 ? "#9dcc3a" : "#e05252" }}>
                    {payload.vitalityAge.trend > 0 ? `↑ Improved ${payload.vitalityAge.trend} year${payload.vitalityAge.trend !== 1 ? "s" : ""} since last calculation` : `↓ Up ${Math.abs(payload.vitalityAge.trend)} year${Math.abs(payload.vitalityAge.trend) !== 1 ? "s" : ""} since last calculation`}
                  </div>
                )}
              </>
            ) : (
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text3)", marginBottom: 8 }}>—</div>
                <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
                  Complete your first Fit3D scan and CAROL session to calculate your Vitality Age.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setMemberSection("carol")}>Connect CAROL →</button>
                  <button type="button" className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setMemberSection("scans")}>View Scans →</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: This Week's Wins ─────────────────────────────── */}
          {payload.wins.length > 0 && (
            <div style={{ background: "rgba(220,180,100,0.07)", border: "1px solid rgba(220,180,100,0.2)", borderRadius: "var(--r)", padding: "18px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(220,180,100,0.7)", marginBottom: 14 }}>This week&apos;s wins</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {payload.wins.map((win, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: win.isMilestone ? 16 : 13, flexShrink: 0, marginTop: win.isMilestone ? -1 : 0 }}>{win.icon}</span>
                    <span style={{ fontSize: 13, color: win.isMilestone ? "var(--text)" : "var(--text2)", fontWeight: win.isMilestone ? 600 : 400, lineHeight: 1.5 }}>{win.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 3: Goal Progress Cards ──────────────────────────── */}
          {(() => {
            const activeGoalTypes = (["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const).filter((gt) => localGoals[gt]);
            if (activeGoalTypes.length === 0) {
              return (
                <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "16px 20px", marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 10 }}>No goals set yet.</div>
                  <button type="button" className="btn btn-sm" onClick={() => setMemberSection("goals")}>Set your goals →</button>
                </div>
              );
            }
            const GOAL_NAMES_LONG: Record<string, string> = { gain_muscle: "Gain Muscle", lose_fat: "Lose Body Fat", improve_cardio: "Improve Cardio Fitness", attendance: "Stay Consistent" };
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
                {activeGoalTypes.map((gt) => {
                  const det = payload.goalDetails[gt];
                  const upColor = "#9dcc3a"; const downColor = "#e05252"; const neutColor = "#e8a838";
                  const statusColor = det.status === "on_track" || det.status === "improving" ? upColor : det.status === "maintaining" || det.status === "behind" ? neutColor : det.status === "declining" || det.status === "off_track" ? downColor : "var(--text3)";
                  const dirIcon = (d: string) => d === "up" ? " ↑" : d === "down" ? " ↓" : "";
                  return (
                    <div key={gt} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{GOAL_NAMES_LONG[gt]}</div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>Since joining</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{det.sinceJoining}{dirIcon(det.sinceJoiningDir)}</div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>This month</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{det.thisMonth}{dirIcon(det.thisMonthDir)}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`, borderRadius: 3, padding: "1px 6px" }}>{det.statusLabel}</span>
                        </div>
                      </div>
                      {det.encouragement && (
                        <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5, fontStyle: "italic", borderTop: "1px solid var(--border)", paddingTop: 8 }}>{det.encouragement}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Section 4: This Week's Checklist ────────────────────────── */}
          {payload.protocol.targetSystem && (() => {
            const cl = generateChecklist(payload.protocol);
            const c = payload.checklistCompletions;
            const doneCount = cl.filter((item) => isChecklistItemDone(item, c, checklistChecked)).length;
            const groups = [
              { key: "strength", label: "Strength", items: cl.filter((i) => i.category === "strength") },
              { key: "cardio", label: "Cardio", items: cl.filter((i) => i.category === "cardio") },
              { key: "recovery", label: "Recovery", items: cl.filter((i) => i.category === "recovery") },
            ].filter((g) => g.items.length > 0);
            return (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ padding: "14px 20px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>This week — {doneCount} of {cl.length} completed</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{c.weekStartDate}</div>
                  </div>
                  <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${cl.length > 0 ? (doneCount / cl.length) * 100 : 0}%`, background: "#9dcc3a", borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                </div>
                <div style={{ padding: "0 20px 14px" }}>
                  {groups.map((group) => (
                    <div key={group.key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text3)", marginBottom: 6 }}>{group.label}</div>
                      {group.items.map((item) => {
                        const done = isChecklistItemDone(item, c, checklistChecked);
                        const blocked = isChecklistBlockedToday(item, c, checklistChecked);
                        const isLogging = checklistLogging === item.id;
                        return (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                            <button type="button" onClick={() => { void handleChecklistItem(item, c); }} disabled={isLogging || (blocked && !done)}
                              style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, padding: 0, background: done ? "#9dcc3a" : "transparent", border: `2px solid ${done ? "#9dcc3a" : blocked ? "var(--border)" : "rgba(157,204,58,0.5)"}`, cursor: done || (blocked && !done) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", opacity: isLogging ? 0.5 : 1 }}>
                              {done && <span style={{ color: "#0b0c09", fontSize: 10, fontWeight: 800 }}>✓</span>}
                              {isLogging && <span style={{ color: "var(--text3)", fontSize: 9 }}>…</span>}
                            </button>
                            <span style={{ fontSize: 12.5, color: done ? "var(--text3)" : "var(--text2)", textDecoration: done ? "line-through" : "none", transition: "all 0.2s" }}>{item.label}</span>
                            {blocked && !done && <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: "auto" }}>today ✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Section 5: Note from Dustin ─────────────────────────────── */}
          {payload.sessionNote && (
            <div style={{ background: "rgba(220,180,100,0.05)", border: "1px solid rgba(220,180,100,0.15)", borderRadius: "var(--r)", padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(220,180,100,0.8)" }}>Note from Dustin</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{payload.sessionNote.date}</div>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>&ldquo;{payload.sessionNote.text}&rdquo;</p>
            </div>
          )}

        </div>

        <div id="view-goals" className="content" style={{ display: mode === "member" && memberView === "goals" ? "block" : "none" }}>
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
                      style={{ width: 44, height: 24, borderRadius: 12, background: isActive ? "#9dcc3a" : "var(--bg3)", border: `2px solid ${isActive ? "#9dcc3a" : "var(--border)"}`, cursor: "pointer", padding: 0, position: "relative", transition: "all 0.2s", flexShrink: 0, opacity: isSaving ? 0.5 : 1 }}
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
                      <div style={{ height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
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
              <div style={{ background: "rgba(157,204,58,0.06)", border: "1px solid rgba(157,204,58,0.25)", borderRadius: "var(--r)", padding: "18px 20px" }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(157,204,58,0.7)", marginBottom: 8 }}>Protocol Recommendation</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                  Based on your goals, we recommend: <span style={{ color: "#9dcc3a" }}>{rec}</span>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.6, margin: "0 0 14px 0" }}>{reason}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {protocolRequested ? (
                    <span style={{ fontSize: 12, color: "#9dcc3a", fontWeight: 500 }}>✓ Request sent to Dustin</span>
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
            const hasNewProtocol = !!p.targetSystem;

            return (
              <>
                <div className="sec-header"><div className="sec-title">My Protocol</div></div>

                {hasNewProtocol && (
                  <div style={{ background: "rgba(220,180,100,0.07)", border: "1px solid rgba(220,180,100,0.2)", borderRadius: "var(--r)", padding: "14px 18px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,180,100,0.7)", marginBottom: 6 }}>Note from Dustin</div>
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: 0 }}>
                      Based on your goals and time commitment, you&apos;re on the <strong style={{ color: "var(--text)" }}>{p.name}</strong> track. Follow the weekly targets below and reach out if you want to adjust the intensity or focus.
                    </p>
                  </div>
                )}

                {hasNewProtocol ? (
                  <>
                    {/* Protocol header card */}
                    <div className="card" style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px 12px" }}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{p.name}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 10, background: "rgba(157,204,58,0.12)", color: "#9dcc3a", border: "1px solid rgba(157,204,58,0.3)", borderRadius: 4, padding: "2px 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              {formatTargetSystem(p.targetSystem)}
                            </span>
                            {p.startDate && <span style={{ fontSize: 11, color: "var(--text3)" }}>Started {p.startDate}</span>}
                          </div>
                        </div>
                        <span className="tag tag-lime">Active</span>
                      </div>

                      {/* Weekly checklist */}
                      {(() => {
                        const checklist = generateChecklist(p);
                        const c = payload.checklistCompletions;
                        const doneCount = checklist.filter((item) => isChecklistItemDone(item, c, checklistChecked)).length;
                        const groups: Array<{ key: string; label: string; items: ChecklistItem[] }> = [
                          { key: "strength", label: "Strength", items: checklist.filter((i) => i.category === "strength") },
                          { key: "cardio", label: "Cardio", items: checklist.filter((i) => i.category === "cardio") },
                          { key: "recovery", label: "Recovery", items: checklist.filter((i) => i.category === "recovery") },
                        ].filter((g) => g.items.length > 0);

                        return (
                          <div style={{ padding: "0 20px 16px" }}>
                            {/* Progress summary */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                              <div style={{ fontSize: 12, color: "var(--text3)" }}>
                                Week of {c.weekStartDate}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: doneCount === checklist.length && checklist.length > 0 ? "#9dcc3a" : "var(--text2)" }}>
                                {doneCount} of {checklist.length} completed this week
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%`, background: "#9dcc3a", borderRadius: 2, transition: "width 0.3s ease" }} />
                            </div>

                            {groups.map((group) => (
                              <div key={group.key} style={{ marginBottom: 18 }}>
                                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text3)", marginBottom: 8 }}>{group.label}</div>
                                {group.items.map((item) => {
                                  const done = isChecklistItemDone(item, c, checklistChecked);
                                  const blockedToday = isChecklistBlockedToday(item, c, checklistChecked);
                                  const isLogging = checklistLogging === item.id;
                                  return (
                                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                                      <button
                                        type="button"
                                        onClick={() => { void handleChecklistItem(item, c); }}
                                        disabled={isLogging || (blockedToday && !done)}
                                        style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: "50%",
                                          background: done ? "#9dcc3a" : "transparent",
                                          border: `2px solid ${done ? "#9dcc3a" : blockedToday ? "var(--border)" : "rgba(157,204,58,0.5)"}`,
                                          cursor: done || (blockedToday && !done) ? "default" : "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                          transition: "all 0.2s",
                                          opacity: isLogging ? 0.5 : 1,
                                          padding: 0,
                                        }}
                                      >
                                        {done && <span style={{ color: "#0b0c09", fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                        {isLogging && <span style={{ color: "var(--text3)", fontSize: 9 }}>…</span>}
                                      </button>
                                      <span style={{ fontSize: 13, color: done ? "var(--text3)" : "var(--text2)", textDecoration: done ? "line-through" : "none", transition: "all 0.2s" }}>
                                        {item.label}
                                      </span>
                                      {blockedToday && !done && (
                                        <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: "auto" }}>already logged today</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Focus grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                      {/* CAROL ride types */}
                      <div className="card" style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>CAROL — Ride types to focus on</div>
                        {p.carolRideTypes.length > 0 ? p.carolRideTypes.map((rt) => (
                          <div key={rt} style={{ fontSize: 12, color: "var(--text2)", padding: "4px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "#9dcc3a" }}>→</span> {rt.replace(/_/g, " ")}
                          </div>
                        )) : <div style={{ fontSize: 12, color: "var(--text3)" }}>No specific ride types</div>}
                      </div>

                      {/* ARX exercises */}
                      <div className="card" style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>ARX — Priority exercises</div>
                        {p.arxExercises.length > 0 ? p.arxExercises.map((ex) => (
                          <div key={ex} style={{ fontSize: 12, color: "var(--text2)", padding: "4px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "#9dcc3a" }}>→</span> {formatExerciseName(ex)}
                          </div>
                        )) : <div style={{ fontSize: 12, color: "var(--text3)" }}>No specific exercises</div>}
                      </div>
                    </div>

                    {/* Coach notes */}
                    {p.coachNotes && (
                      <div style={{ background: "rgba(220,180,100,0.07)", border: "1px solid rgba(220,180,100,0.2)", borderRadius: "var(--r)", padding: "14px 18px" }}>
                        <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,180,100,0.7)", marginBottom: 6 }}>Notes from Dustin</div>
                        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: 0 }}>{p.coachNotes}</p>
                      </div>
                    )}

                    {/* Change Protocol section */}
                    <div className="card" style={{ marginTop: 14, padding: "16px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Change Protocol</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => { setShowProtocolModal(true); setProtocolRequestSent(false); setProtocolRequestText(""); }}
                        >
                          Request Protocol Adjustment
                        </button>
                        <a
                          href="https://theiso.club/book"
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-lime btn-sm"
                          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          ✦ Book a 1:1 with Dustin
                        </a>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
                        Want a quick adjustment? Request a free protocol review. Need a deeper look at your data and goals? Book a personalized 1:1 consultation with Dustin.
                      </p>
                    </div>
                  </>
                ) : (
                  /* Legacy protocol display */
                  <div className="card">
                    <div className="track-hero">
                      <div style={{ flex: 1 }}>
                        <div className="track-name">{p.name || "Protocol"}</div>
                        <div className="track-meta">Week {p.weekCurrent} of {p.weekTotal}</div>
                      </div>
                      <span className="tag tag-lime">Active</span>
                    </div>
                    {p.sessions.length ? (
                      p.sessions.map((session, index) => (
                        <div key={`${session.name}-${index}`} className="session-item">
                          <div className="s-num">{index + 1}</div>
                          <div className="s-info">
                            <div className="s-name">{session.name}</div>
                            <div className="s-detail">{session.detail}</div>
                          </div>
                          <div className="s-dur">{session.duration} min</div>
                        </div>
                      ))
                    ) : (
                      <div className="card-body"><p style={{ color: "var(--text3)" }}>No protocol assigned yet. Ask your coach to assign one.</p></div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div id="view-carol" className="content" style={{ display: mode === "member" && memberView === "carol" ? "block" : "none" }}>
          {(() => {
            const allCarol = Array.isArray(payload.carolSessions) ? payload.carolSessions : [];
            const rehitSessions = allCarol.filter((s) => normalizeCarolTabKey(s.rideType) === "rehit");
            const rehitWithManp = rehitSessions.filter((s) => (carolNum(s.manp) ?? 0) > 0);
            const latestManp = carolNum(rehitWithManp[0]?.manp ?? "");
            const weightLbs = carolNum(payload.scan.weightLbs);
            const vo2 = latestManp && weightLbs ? estimateVo2Max(latestManp, weightLbs) : null;
            const vo2Cat = vo2 ? vo2Category(vo2) : null;
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
            const sessionsThisMonth = allCarol.filter((s) => s.sessionDate >= monthStart).length;
            const sessionsPrevMonth = allCarol.filter((s) => s.sessionDate >= prevMonthStart && s.sessionDate < monthStart).length;

            // MANP trend
            let manpTrendLabel = "";
            let manpTrendColor = "var(--text3)";
            if (rehitWithManp.length >= 6) {
              const recentAvg = rehitWithManp.slice(0, 3).reduce((s, r) => s + (carolNum(r.manp) ?? 0), 0) / 3;
              const olderAvg = rehitWithManp.slice(3, 6).reduce((s, r) => s + (carolNum(r.manp) ?? 0), 0) / 3;
              if (olderAvg > 0) {
                const pct = ((recentAvg - olderAvg) / olderAvg) * 100;
                if (pct > 3) { manpTrendLabel = `↑ ${pct.toFixed(0)}%`; manpTrendColor = "#9dcc3a"; }
                else if (pct < -3) { manpTrendLabel = `↓ ${Math.abs(pct).toFixed(0)}%`; manpTrendColor = "#e05252"; }
                else { manpTrendLabel = "Stable"; manpTrendColor = "var(--text3)"; }
              }
            } else if (rehitWithManp.length >= 2) {
              manpTrendLabel = "Building history…";
            }

            return (
              <>
                <div className="sec-header">
                  <div className="sec-title">CAROL Rides</div>
                  <Link className="btn btn-sm" href="/member/connect/carol">
                    ↩ Load CAROL data
                  </Link>
                </div>

                {/* Empty state */}
                {allCarol.length === 0 && (
                  <div className="card" style={{ marginBottom: 16, textAlign: "center", padding: "32px 24px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>No CAROL data yet</div>
                    <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20, lineHeight: 1.6 }}>
                      Connect your CAROL account to see your ride history, MANP fitness score, and estimated VO2 max.
                    </p>
                    <Link className="btn btn-lime btn-sm" href="/member/connect/carol">
                      Connect CAROL account →
                    </Link>
                  </div>
                )}

                {/* Health snapshot */}
                {allCarol.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
                    {/* VO2 Max */}
                    <div className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>Est. VO2 Max</div>
                      {vo2 && vo2Cat ? (
                        <>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{vo2.toFixed(0)}</span>
                            <span style={{ fontSize: 10, color: "var(--text3)" }}>ml/kg/min</span>
                          </div>
                          <div style={{ height: 4, background: "var(--bg3)", borderRadius: 2, marginBottom: 6, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${vo2Cat.barPct}%`, background: vo2Cat.color, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 10, color: vo2Cat.color, fontWeight: 600 }}>{vo2Cat.label}</span>
                        </>
                      ) : (
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>--</div>
                          <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.5 }}>
                            {latestManp ? "Complete a body scan to estimate" : "Needs REHIT data"}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* MANP / Aerobic power */}
                    <div className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>Aerobic Power (MANP)</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{latestManp ? Math.round(latestManp) : "--"}</span>
                        {latestManp ? <span style={{ fontSize: 10, color: "var(--text3)" }}>W</span> : null}
                      </div>
                      {manpTrendLabel ? (
                        <span style={{ fontSize: 11, color: manpTrendColor, fontWeight: 500 }}>{manpTrendLabel} vs prior sessions</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>{rehitSessions.length < 2 ? "More REHIT sessions needed" : "Trend building…"}</span>
                      )}
                    </div>

                    {/* Training consistency */}
                    <div className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 6 }}>This Month</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{sessionsThisMonth}</span>
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>sessions</span>
                      </div>
                      {sessionsPrevMonth > 0 ? (
                        <span style={{ fontSize: 11, color: sessionsThisMonth >= sessionsPrevMonth ? "#9dcc3a" : "var(--text3)" }}>
                          {sessionsThisMonth >= sessionsPrevMonth ? "↑" : "↓"} vs {sessionsPrevMonth} last month
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>{allCarol.length} rides total</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Dustin's Analysis */}
                {allCarol.length > 0 && (
                  <div style={{ background: "rgba(220,180,100,0.07)", border: "1px solid rgba(220,180,100,0.2)", borderRadius: "var(--r)", padding: "14px 18px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,180,100,0.7)", marginBottom: 6 }}>Dustin&apos;s Analysis</div>
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: 0 }}>
                      {buildCarolInsight(allCarol, payload.scan.weightLbs)}
                    </p>
                  </div>
                )}

                {/* Tab filter + stat cards + ride history */}
                {allCarol.length > 0 && (
                  <>
                    <div className="tabs">
                      <button className={`tab ${carolTab === "rehit" ? "active" : ""}`} onClick={() => setCarolTab("rehit")} type="button">REHIT</button>
                      <button className={`tab ${carolTab === "fat_burn" ? "active" : ""}`} onClick={() => setCarolTab("fat_burn")} type="button">Fat Burn</button>
                      <button className={`tab ${carolTab === "free_custom" ? "active" : ""}`} onClick={() => setCarolTab("free_custom")} type="button">Free &amp; Custom</button>
                      <button className={`tab ${carolTab === "fitness_tests" ? "active" : ""}`} onClick={() => setCarolTab("fitness_tests")} type="button">Fitness Tests</button>
                    </div>
                    <div className="grid-4" style={{ marginBottom: 16 }}>
                      <div className="stat-card"><div className="stat-label">MANP</div><div className="stat-val">{latestCarol?.manp || "--"}</div></div>
                      <div className="stat-card amber"><div className="stat-label">Avg sprint power</div><div className="stat-val">{peakAvgSprintPower > 0 ? Math.round(peakAvgSprintPower) : "--"}</div></div>
                      <div className="stat-card blue"><div className="stat-label">Total rides</div><div className="stat-val">{memberCarolRows.length}</div></div>
                      <div className="stat-card"><div className="stat-label">Last max HR</div><div className="stat-val">{latestCarol?.heartRateMax || "--"}</div></div>
                    </div>
                    <div className="card">
                      <div className="card-header"><div className="card-title">Ride history</div></div>
                      {memberCarolRows.length ? (
                        memberCarolRows.slice(0, 25).map((row) => (
                          <div className="metric-row" key={`${row.sessionDate}-${row.sequentialNumber}`}>
                            <div className="metric-label">
                              {row.sessionDate || "Recent"} · Ride #{row.sequentialNumber}
                            </div>
                            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--text3)" }}>MANP <b style={{ color: "var(--text)" }}>{row.manp}</b></span>
                              <span style={{ fontSize: 11, color: "var(--text3)" }}>Avg Sprint <b style={{ color: "var(--text)" }}>{row.avgSprintPower}W</b></span>
                              <span style={{ fontSize: 11, color: "var(--text3)" }}>Cal+EPOC <b style={{ color: "var(--text)" }}>{row.caloriesInclEpoc}</b></span>
                              <span style={{ fontSize: 11, color: "var(--text3)" }}>Max HR <b style={{ color: "var(--text)" }}>{row.heartRateMax}</b></span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="card-body"><p style={{ color: "var(--text3)" }}>No rides logged for this tab yet.</p></div>
                      )}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>

        <div id="view-arx" className="content" style={{ display: mode === "member" && memberView === "arx" ? "block" : "none" }}>
          {(() => {
            const arxGroups = buildArxByExercise(payload.arxSessions);
            const totalSessions = payload.arxSessions.length;
            const allConc = payload.arxSessions.map((s) => s.concentricMax ?? 0);
            const peakOutput = allConc.length ? Math.max(...allConc) : 0;
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            const sessionsThisMonth = payload.arxSessions.filter((s) => s.sessionDate >= monthStart).length;
            const peakExercise = arxGroups[0]?.exercise ?? "--";

            // Latest concentric per exercise for comparison bars
            const latestConc = arxGroups.map(({ exercise, sessions }) => ({
              exercise,
              value: sessions[0]?.concentricMax ?? 0,
            }));
            const maxConc = latestConc.reduce((m, e) => Math.max(m, e.value), 0);

            return (
              <>
                <div className="sec-header">
                  <div className="sec-title">ARX Strength</div>
                  <Link className="btn btn-sm" href="/member/connect/arx">
                    ↩ Load ARX data
                  </Link>
                </div>

                {/* Summary cards */}
                <div className="grid-4" style={{ marginBottom: 16 }}>
                  <div className="stat-card"><div className="stat-label">Total sessions</div><div className="stat-val">{totalSessions || "--"}</div></div>
                  <div className="stat-card amber"><div className="stat-label">Peak concentric</div><div className="stat-val">{peakOutput > 0 ? Math.round(peakOutput) : "--"}</div></div>
                  <div className="stat-card blue"><div className="stat-label">This month</div><div className="stat-val">{sessionsThisMonth}</div></div>
                  <div className="stat-card"><div className="stat-label">Top exercise</div><div className="stat-val" style={{ fontSize: 13 }}>{peakExercise}</div></div>
                </div>

                {/* Coaching insight */}
                {totalSessions > 0 && (
                  <div style={{ background: "rgba(220,180,100,0.07)", border: "1px solid rgba(220,180,100,0.2)", borderRadius: "var(--r)", padding: "14px 18px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,180,100,0.7)", marginBottom: 6 }}>Dustin&apos;s Analysis</div>
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: 0 }}>{buildArxInsight(arxGroups)}</p>
                  </div>
                )}

                {/* Per-exercise cards */}
                {arxGroups.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 16 }}>
                    {arxGroups.map(({ exercise, sessions }) => {
                      const latest = sessions[0];
                      const conc = latest?.concentricMax ?? null;
                      const ecc = latest?.eccentricMax ?? null;
                      const ratio = conc && ecc ? ecc / conc : null;
                      const ratioInfo = ratio !== null ? eccRatioLabel(ratio) : null;
                      const pr = conc !== null ? Math.max(...sessions.map((s) => s.concentricMax ?? 0)) : 0;
                      const isPR = conc !== null && conc >= pr && sessions.length > 1;
                      // Sparkline: last 12 sessions ascending
                      const sparkVals = sessions.slice(0, 12).reverse().map((s) => s.concentricMax);
                      const sparkFirst = sparkVals.find((v) => v !== null) ?? null;
                      const sparkLast = [...sparkVals].reverse().find((v) => v !== null) ?? null;
                      const trending = sparkFirst !== null && sparkLast !== null && sparkLast > sparkFirst;
                      const path = sparklinePath(sparkVals, 100, 32);

                      return (
                        <div key={exercise} className="card" style={{ padding: "16px 18px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{exercise}</div>
                              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</div>
                            </div>
                            {isPR && <span style={{ fontSize: 9, background: "rgba(157,204,58,0.15)", color: "#9dcc3a", border: "1px solid rgba(157,204,58,0.3)", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.08em" }}>PR</span>}
                          </div>

                          {/* Conc / Ecc row */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                            <div style={{ background: "var(--bg3)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
                              <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Concentric</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{conc !== null ? Math.round(conc) : "--"}</div>
                              <div style={{ fontSize: 9, color: "var(--text3)" }}>lbs</div>
                            </div>
                            <div style={{ background: "var(--bg3)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
                              <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Eccentric</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{ecc !== null ? Math.round(ecc) : "--"}</div>
                              <div style={{ fontSize: 9, color: "var(--text3)" }}>lbs</div>
                            </div>
                          </div>

                          {/* Ecc:Conc ratio */}
                          {ratioInfo && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: "var(--text3)" }}>Ecc:Conc</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: ratioInfo.color }}>{ratio!.toFixed(2)}×</div>
                              <span style={{ fontSize: 10, color: ratioInfo.color, background: `${ratioInfo.color}18`, border: `1px solid ${ratioInfo.color}40`, borderRadius: 4, padding: "1px 6px" }}>{ratioInfo.label}</span>
                            </div>
                          )}

                          {/* Sparkline */}
                          {path ? (
                            <div>
                              <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Concentric trend</div>
                              <svg viewBox="0 0 100 32" style={{ width: "100%", height: 32, display: "block" }}>
                                <path d={path} fill="none" stroke={trending ? "#9dcc3a" : "#e05252"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: "center", padding: "32px 24px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>No ARX data yet</div>
                    <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20, lineHeight: 1.6 }}>
                      Export your workout history from the ARX member portal and upload it here to see your strength analytics.
                    </p>
                    <Link className="btn btn-lime btn-sm" href="/member/connect/arx">
                      Import ARX data →
                    </Link>
                  </div>
                )}

                {/* Exercise comparison */}
                {latestConc.length > 1 && maxConc > 0 && (
                  <div className="card">
                    <div className="card-header"><div className="card-title">Latest output by exercise</div></div>
                    <div style={{ padding: "8px 0" }}>
                      {latestConc.sort((a, b) => b.value - a.value).map(({ exercise, value }) => (
                        <div key={exercise} style={{ padding: "6px 20px 6px 20px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11.5, color: "var(--text2)" }}>{exercise}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)" }}>{value > 0 ? `${Math.round(value)} lbs` : "--"}</span>
                          </div>
                          <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(value / maxConc) * 100}%`, background: "#9dcc3a", borderRadius: 3, transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div id="view-scans" className="content" style={{ display: mode === "member" && memberView === "scans" ? "block" : "none" }}>
          {(() => {
            const current = payload.scanHistory[0];
            const previous = payload.scanHistory[1];
            const scansAsc = [...payload.scanHistory].reverse();

            const metrics: Array<{
              label: string;
              value: string;
              raw: number | null;
              prevRaw: number | null;
              good: "up" | "down" | "neutral";
              unit?: string;
            }> = [
              { label: "Weight", value: payload.scan.weightLbs, raw: current?.weightLbsRaw ?? null, prevRaw: previous?.weightLbsRaw ?? null, good: "neutral", unit: "lbs" },
              { label: "Body fat %", value: payload.scan.bodyFatPct, raw: current?.bodyFatPctRaw ?? null, prevRaw: previous?.bodyFatPctRaw ?? null, good: "down", unit: "%" },
              { label: "Lean mass", value: payload.scan.leanMassLbs, raw: current?.leanMassLbsRaw ?? null, prevRaw: previous?.leanMassLbsRaw ?? null, good: "up", unit: "lbs" },
              { label: "Fat mass", value: payload.scan.fatMassLbs, raw: current?.fatMassLbsRaw ?? null, prevRaw: previous?.fatMassLbsRaw ?? null, good: "down", unit: "lbs" },
              { label: "Body shape", value: payload.scan.bodyShapeRating, raw: current?.bodyShapeRatingRaw ?? null, prevRaw: previous?.bodyShapeRatingRaw ?? null, good: "up" },
              { label: "Waist", value: payload.scan.waistIn, raw: current?.waistInRaw ?? null, prevRaw: previous?.waistInRaw ?? null, good: "down", unit: "\"" },
              { label: "Hips", value: payload.scan.hipsIn, raw: current?.hipsInRaw ?? null, prevRaw: previous?.hipsInRaw ?? null, good: "down", unit: "\"" },
            ];

            const bfSparkVals = scansAsc.map((s) => s.bodyFatPctRaw);
            const leanSparkVals = scansAsc.map((s) => s.leanMassLbsRaw);
            const wtSparkVals = scansAsc.map((s) => s.weightLbsRaw);
            const bfFirst = bfSparkVals.find((v) => v !== null) ?? null;
            const bfLast = [...bfSparkVals].reverse().find((v) => v !== null) ?? null;
            const leanFirst = leanSparkVals.find((v) => v !== null) ?? null;
            const leanLast = [...leanSparkVals].reverse().find((v) => v !== null) ?? null;

            return (
              <>
                <div className="sec-header">
                  <div className="sec-title">
                    Body Composition{payload.scan.scanDate ? ` — Last scan: ${payload.scan.scanDate}` : ""}
                  </div>
                </div>

                {/* AI insight */}
                <div style={{ background: "rgba(220,180,100,0.07)", border: "1px solid rgba(220,180,100,0.2)", borderRadius: "var(--r)", padding: "14px 18px", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,180,100,0.7)", marginBottom: 6 }}>Dustin&apos;s Analysis</div>
                  <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, margin: 0 }}>
                    {scanInsight(current, previous)}
                  </p>
                </div>

                {/* Metrics grid */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="card-header"><div className="card-title">Metrics</div></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                    {metrics.map((m) => {
                      const change = scanPctChange(m.raw, m.prevRaw);
                      const color = scanChangeColor(change, m.good);
                      const arrow = change ? (change.direction === "up" ? "↑" : "↓") : null;
                      return (
                        <div key={m.label} className="metric-row" style={{ borderRight: "none" }}>
                          <div className="metric-label">{m.label}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
                              {m.value}{m.value !== "--" && m.unit ? m.unit : ""}
                            </span>
                            {change && (
                              <span style={{ fontSize: 11, color, fontWeight: 500 }}>
                                {arrow} {change.display}
                              </span>
                            )}
                            {!change && previous && (
                              <span style={{ fontSize: 11, color: "var(--text3)" }}>—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Posture */}
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="card-header"><div className="card-title">Posture analysis</div></div>
                  <div className="metric-row"><div className="metric-label">Head forward</div><div className="metric-val">{payload.scan.headForwardIn}&quot;</div></div>
                  <div className="metric-row"><div className="metric-label">Shoulder forward</div><div className="metric-val">{payload.scan.shoulderForwardIn}&quot;</div></div>
                  <div className="metric-row"><div className="metric-label">Hip forward</div><div className="metric-val">{payload.scan.hipForwardIn}&quot;</div></div>
                </div>

                {/* Timeline */}
                {scansAsc.length > 0 && (
                  <div className="card" style={{ marginBottom: 14 }}>
                    <div className="card-header"><div className="card-title">Scan journey</div></div>
                    <div style={{ padding: "8px 16px 20px", overflowX: "auto" }}>
                      <div style={{ position: "relative", height: 130, minWidth: Math.max(scansAsc.length * 90, 280) }}>
                        {/* Line segments */}
                        {scansAsc.length > 1 && scansAsc.slice(1).map((scan, i) => {
                          const prev = scansAsc[i];
                          const fatDown = (scan.bodyFatPctRaw ?? 99) < (prev.bodyFatPctRaw ?? 99);
                          const leftPct = (i / (scansAsc.length - 1)) * 100;
                          const widthPct = (1 / (scansAsc.length - 1)) * 100;
                          return (
                            <div key={i} style={{ position: "absolute", top: 20, left: `${leftPct}%`, width: `${widthPct}%`, height: 2, background: fatDown ? "#9dcc3a" : "#e05252" }} />
                          );
                        })}
                        {/* Dots */}
                        {scansAsc.map((scan, i) => {
                          const leftPct = scansAsc.length === 1 ? 50 : (i / (scansAsc.length - 1)) * 100;
                          const isActive = activeScanDot === i;
                          return (
                            <div key={i} style={{ position: "absolute", left: `${leftPct}%`, top: 12, transform: "translateX(-50%)" }}>
                              <button
                                type="button"
                                onClick={() => setActiveScanDot(isActive ? null : i)}
                                style={{ width: 16, height: 16, borderRadius: "50%", background: isActive ? "#9dcc3a" : "var(--bg3)", border: "2px solid #9dcc3a", cursor: "pointer", padding: 0, display: "block" }}
                              />
                              <div style={{ fontSize: 9, marginTop: 6, color: "var(--text3)", whiteSpace: "nowrap", textAlign: "center", transform: "translateX(-30%)" }}>
                                {scan.scanDate}
                              </div>
                              {isActive && (
                                <div style={{ position: "absolute", top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "10px 14px", zIndex: 20, whiteSpace: "nowrap", boxShadow: "0 6px 24px rgba(0,0,0,0.35)" }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{scan.scanDate}</div>
                                  <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 3 }}>Weight: <b>{scan.weightLbs} lbs</b></div>
                                  <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 3 }}>Body fat: <b>{scan.bodyFatPct}%</b></div>
                                  <div style={{ fontSize: 11, color: "var(--text2)" }}>Lean mass: <b>{scan.leanMassLbs} lbs</b></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sparklines */}
                {scansAsc.length >= 2 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    {[
                      { label: "Body fat %", vals: bfSparkVals, current: current?.bodyFatPct, good: "down" as const, first: bfFirst, last: bfLast },
                      { label: "Lean mass", vals: leanSparkVals, current: current?.leanMassLbs, good: "up" as const, first: leanFirst, last: leanLast },
                      { label: "Weight", vals: wtSparkVals, current: current?.weightLbs, good: "neutral" as const, first: null, last: null },
                    ].map((chart) => {
                      const path = sparklinePath(chart.vals, 100, 36);
                      const trendGood =
                        chart.good === "neutral" ? true :
                        chart.good === "down" ? (chart.last ?? 0) <= (chart.first ?? 0) :
                        (chart.last ?? 0) >= (chart.first ?? 0);
                      const lineColor = chart.good === "neutral" ? "var(--text3)" : trendGood ? "#9dcc3a" : "#e05252";
                      return (
                        <div key={chart.label} className="card" style={{ padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>{chart.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{chart.current ?? "--"}</div>
                          {path ? (
                            <svg viewBox="0 0 100 36" style={{ width: "100%", height: 36, display: "block" }}>
                              <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <div style={{ height: 36, display: "flex", alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--text3)" }}>Not enough data</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "#e8a838", marginBottom: 10 }}>⚠ Members Needing Attention</div>
              {payload.coachAtRisk.map((m) => (
                <div key={m.id} style={{ background: "rgba(232,168,56,0.07)", border: "1px solid rgba(232,168,56,0.25)", borderRadius: "var(--r-sm)", padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{m.name}</div>
                    {m.reasons.map((r, i) => <div key={i} style={{ fontSize: 11, color: "#e8a838" }}>{r}</div>)}
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
          <div className="sec-header"><div className="sec-title">All members</div></div>
          <div className="card">
            {payload.coach.members.length ? (
              payload.coach.members.map((member) => (
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
        </div>

        <div id="coach-log" className="content" style={{ display: mode === "coach" && coachView === "log" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Log Session</div></div>
          <div className="card"><div className="card-body">Use this panel to log training sessions from the coach dashboard.</div></div>
        </div>

        <div id="coach-protocols" className="content" style={{ display: mode === "coach" && coachView === "protocols" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Assign Protocol</div></div>

          {/* Protocol library */}
          {coachProtocols.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
              {coachProtocols.map((proto) => (
                <div
                  key={proto.id}
                  onClick={() => setAssignProtocolId(proto.id)}
                  style={{ cursor: "pointer", background: assignProtocolId === proto.id ? "rgba(157,204,58,0.08)" : "var(--bg2)", border: `1px solid ${assignProtocolId === proto.id ? "#9dcc3a" : "var(--border)"}`, borderRadius: "var(--r)", padding: "12px 14px" }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{proto.name}</div>
                  <span style={{ fontSize: 9, background: "rgba(157,204,58,0.1)", color: "#9dcc3a", border: "1px solid rgba(157,204,58,0.25)", borderRadius: 3, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {formatTargetSystem(proto.target_system ?? "")}
                  </span>
                  <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{proto.description}</p>
                </div>
              ))}
            </div>
          )}

          {coachProtocols.length === 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <p style={{ color: "var(--text3)" }}>No protocols found. Run <code>protocols_tables.sql</code> in your Supabase SQL editor to create the protocol library.</p>
              </div>
            </div>
          )}

          {/* Assignment form */}
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
                  {coachProtocols.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatTargetSystem(p.target_system ?? "")}</option>
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
              <div>
                <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 6 }}>Coach notes (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Focus on eccentric phase on ARX"
                  value={assignCoachNotes}
                  onChange={(e) => setAssignCoachNotes(e.target.value)}
                />
              </div>
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
                    });
                    setAssignStatus("✓ Protocol assigned successfully.");
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
                {isAssigning ? "Assigning…" : "Assign Protocol"}
              </button>
              {assignStatus && (
                <span style={{ fontSize: 12, color: assignStatus.startsWith("✓") ? "#9dcc3a" : "#e05252" }}>
                  {assignStatus}
                </span>
              )}
            </div>
          </div>

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
                        <div key={gt} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg3)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                          <span style={{ fontSize: 12, color: "var(--text2)" }}>{GOAL_DEFS[gt]?.name ?? gt}</span>
                          <button
                            type="button"
                            onClick={() => { void handleGoalToggle(gt, assignMemberId); }}
                            style={{ width: 40, height: 22, borderRadius: 11, background: isOn ? "#9dcc3a" : "var(--bg3)", border: `2px solid ${isOn ? "#9dcc3a" : "var(--border)"}`, cursor: "pointer", padding: 0, position: "relative", transition: "all 0.2s", flexShrink: 0 }}
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
                      <div style={{ background: "rgba(157,204,58,0.06)", border: "1px solid rgba(157,204,58,0.2)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
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
                <div style={{ color: "#9dcc3a", fontSize: 13, fontWeight: 500, padding: "12px 0" }}>
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
                        {!notif.is_read && <span style={{ marginLeft: 8, fontSize: 9, background: "#9dcc3a", color: "#0b0c09", borderRadius: 3, padding: "1px 5px", fontWeight: 700 }}>NEW</span>}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text3)", whiteSpace: "nowrap" }}>
                        {new Date(notif.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                      {notif.type === "protocol_change_request" ? "Protocol change request" : "General"}
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 10px 0" }}>{notif.message}</p>
                    <div style={{ display: "flex", gap: 8 }}>
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
