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
  | "schedule";

type CoachSection = "morning" | "members" | "messages" | "log" | "protocols";

type CarolSession = {
  sessionDate: string;
  rideNumber: string;
  rideType: string;
  fitnessScore: string;
  peakPowerWatts: string;
  avgSprintPower: string;
  manp: string;
  caloriesInclEpoc: string;
  caloriesActive: string;
  heartRateMax: string;
  heartRateAvg: string;
  durationSeconds: string;
  calories: string;
  maxHr: string;
};

type RecoveryModality = "cold_plunge" | "infrared_sauna" | "compression_therapy" | "nxpro";

type RecoveryGoals = {
  cold_plunge: number;
  infrared_sauna: number;
  compression_therapy: number;
  nxpro: number;
};

type RecoverySummary = {
  month: string;
  monthLabel: string;
  protocolName: string;
  goals: RecoveryGoals;
  counts: RecoveryGoals;
  days: Array<{ date: string; modalities: RecoveryModality[] }>;
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
    overall: string;
  };
  carolHistory: Array<{ label: string; value: string }>;
  carolSessions: CarolSession[];
  arxHistory: Array<{ label: string; value: string }>;
  scan: {
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
    headForwardIn: string;
    shoulderForwardIn: string;
    hipForwardIn: string;
  };
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
  recoverySummary: RecoverySummary;
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
  };
  bookings: Array<{ label: string; status: string }>;
  reports: Array<{ title: string }>;
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

const DEFAULT_RECOVERY_GOALS: RecoveryGoals = {
  cold_plunge: 6,
  infrared_sauna: 8,
  compression_therapy: 4,
  nxpro: 4,
};

const RECOVERY_MODALITY_CONFIG: Array<{
  key: RecoveryModality;
  label: string;
  cssColor: string;
}> = [
  { key: "cold_plunge", label: "Cold Plunge", cssColor: "var(--blue)" },
  { key: "infrared_sauna", label: "Infrared Sauna", cssColor: "var(--amber)" },
  { key: "compression_therapy", label: "Compression Boots", cssColor: "var(--purple)" },
  { key: "nxpro", label: "NxPro", cssColor: "var(--teal)" },
];

type TrendPoint = {
  label: string;
  value: number;
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

function monthKeyFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(monthKey: string): string {
  const [rawYear, rawMonth] = monthKey.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftMonth(monthKey: string, delta: number): string {
  const [rawYear, rawMonth] = monthKey.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKeyFromDate(new Date());
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKeyFromDate(next);
}

function normalizeRecoveryModality(value: unknown): RecoveryModality | null {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return null;
  if (key === "cold_plunge" || key === "cold plunge") return "cold_plunge";
  if (key === "infrared_sauna" || key === "infrared sauna" || key === "sauna") return "infrared_sauna";
  if (key === "compression_therapy" || key === "compression therapy" || key === "compression") return "compression_therapy";
  if (key === "nxpro") return "nxpro";
  return null;
}

function numberOrZero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return 0;
}

function parseRecoveryGoals(raw: unknown): RecoveryGoals {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_RECOVERY_GOALS };
  }
  const row = raw as Record<string, unknown>;
  const coldPlunge = numberOrZero(row.cold_plunge ?? row.coldPlunge ?? row["cold plunge"]);
  const infraredSauna = numberOrZero(row.infrared_sauna ?? row.infraredSauna ?? row.sauna ?? row["infrared sauna"]);
  const compression = numberOrZero(row.compression_therapy ?? row.compressionTherapy ?? row.compression);
  const nxpro = numberOrZero(row.nxpro ?? row.nxPro);
  if (!coldPlunge || !infraredSauna || !compression || !nxpro) {
    return { ...DEFAULT_RECOVERY_GOALS };
  }
  return {
    cold_plunge: coldPlunge,
    infrared_sauna: infraredSauna,
    compression_therapy: compression,
    nxpro,
  };
}

function normalizeRecoverySummary(summary: unknown, fallbackMonth: string): RecoverySummary | null {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  const row = summary as Record<string, unknown>;
  const countsRaw = row.counts;
  const countsRecord = countsRaw && typeof countsRaw === "object" ? (countsRaw as Record<string, unknown>) : {};
  const daysRaw = Array.isArray(row.days) ? row.days : [];
  return {
    month: typeof row.month === "string" && /^\d{4}-\d{2}$/.test(row.month) ? row.month : fallbackMonth,
    monthLabel:
      typeof row.monthLabel === "string" && row.monthLabel.trim().length > 0
        ? row.monthLabel
        : typeof row.month_label === "string" && row.month_label.trim().length > 0
          ? row.month_label
          : monthLabelFromKey(fallbackMonth),
    protocolName:
      typeof row.protocolName === "string"
        ? row.protocolName
        : typeof row.protocol_name === "string"
          ? row.protocol_name
          : "",
    goals: parseRecoveryGoals(row.goals),
    counts: {
      cold_plunge: numberOrZero(countsRecord.cold_plunge),
      infrared_sauna: numberOrZero(countsRecord.infrared_sauna),
      compression_therapy: numberOrZero(countsRecord.compression_therapy),
      nxpro: numberOrZero(countsRecord.nxpro),
    },
    days: daysRaw
      .map((day) => {
        if (!day || typeof day !== "object" || Array.isArray(day)) return null;
        const item = day as Record<string, unknown>;
        const date = typeof item.date === "string" ? item.date : "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        const modalities = Array.isArray(item.modalities)
          ? item.modalities
              .map((modality) => normalizeRecoveryModality(modality))
              .filter((modality): modality is RecoveryModality => Boolean(modality))
          : [];
        return { date, modalities };
      })
      .filter((day): day is { date: string; modalities: RecoveryModality[] } => Boolean(day)),
  };
}

function buildInitialRecoverySummary(payload: DashboardPayload, monthKey: string): RecoverySummary {
  const existing = normalizeRecoverySummary(payload.recoverySummary, monthKey);
  if (existing) return existing;
  return {
    month: monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    protocolName: payload.protocol.name || "",
    goals: { ...DEFAULT_RECOVERY_GOALS },
    counts: {
      cold_plunge: numberOrZero(payload.recoveryCounts.coldPlunge),
      infrared_sauna: numberOrZero(payload.recoveryCounts.infraredSauna),
      compression_therapy: numberOrZero(payload.recoveryCounts.compression),
      nxpro: numberOrZero(payload.recoveryCounts.nxpro),
    },
    days: [],
  };
}

function buildRecoveryCalendarCells(
  monthKey: string,
  dayRows: Array<{ date: string; modalities: RecoveryModality[] }>,
): Array<{ date: string | null; day: number | null; modalities: RecoveryModality[] }> {
  const [rawYear, rawMonth] = monthKey.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return [];

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekdayOffset = firstDay.getUTCDay();
  const dayMap = new Map(dayRows.map((day) => [day.date, day.modalities]));
  const cells: Array<{ date: string | null; day: number | null; modalities: RecoveryModality[] }> = [];

  for (let i = 0; i < weekdayOffset; i += 1) {
    cells.push({ date: null, day: null, modalities: [] });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day, modalities: dayMap.get(date) ?? [] });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, modalities: [] });
  }

  return cells;
}

function asNumericMetric(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function pickLatestMetric(
  rows: CarolSession[],
  pickers: Array<(row: CarolSession) => string>,
): string {
  for (const row of rows) {
    for (const picker of pickers) {
      const value = picker(row);
      if (asNumericMetric(value) !== null) return value;
    }
  }
  return "--";
}

function formatCarolDateLabel(value: string): string {
  if (!value) return "Recent";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recent";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildTrendPath(points: TrendPoint[], width: number, height: number, padding: number): string {
  if (points.length < 2) return "";
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * innerWidth;
      const y = padding + ((max - point.value) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");
}

function CarolTrendChart({
  title,
  points,
  lineColor,
  unit,
}: {
  title: string;
  points: TrendPoint[];
  lineColor: string;
  unit: string;
}) {
  const width = 560;
  const height = 170;
  const padding = 16;
  const path = buildTrendPath(points, width, height, padding);
  const latest = points.length ? points[points.length - 1] : null;
  const first = points.length ? points[0] : null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-sub">{latest ? `${Math.round(latest.value)}${unit} latest` : "No data yet"}</div>
      </div>
      {points.length >= 2 ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 190 }}>
            <polyline fill="none" stroke="rgba(175,189,165,0.2)" strokeWidth="1" points={`${padding},${height - padding} ${width - padding},${height - padding}`} />
            <polyline fill="none" stroke={lineColor} strokeWidth="2.2" points={path} />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: -6, fontSize: 11, color: "var(--text3)" }}>
            <span>{first?.label || ""}</span>
            <span>{latest?.label || ""}</span>
          </div>
        </>
      ) : (
        <div className="card-body">
          <p style={{ color: "var(--text3)" }}>Not enough sessions to render a trend line yet.</p>
        </div>
      )}
    </div>
  );
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
  route,
  initialMemberView,
  initialCoachView,
}: {
  payload: DashboardPayload;
  role: "member" | "coach";
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
  const [peerName, setPeerName] = useState("Dustin");
  const [peerId, setPeerId] = useState(payload.coachId ?? "");
  const [selectedCoachRecipientId, setSelectedCoachRecipientId] = useState(
    payload.coach.members[0]?.id ?? "",
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesStatus, setMessagesStatus] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const currentRecoveryMonth = useMemo(() => monthKeyFromDate(new Date()), []);
  const initialRecoverySummary = useMemo(
    () => buildInitialRecoverySummary(payload, currentRecoveryMonth),
    [currentRecoveryMonth, payload],
  );
  const [recoveryMonth, setRecoveryMonth] = useState(initialRecoverySummary.month);
  const [recoverySummary, setRecoverySummary] = useState<RecoverySummary>(initialRecoverySummary);
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [selectedRecoveryDate, setSelectedRecoveryDate] = useState<string>("");

  const displayName = useMemo(
    () => displayNameFromClerk(user, payload.displayName || "Member"),
    [payload.displayName, user],
  );
  const greetingName = useMemo(() => firstNameFromName(displayName), [displayName]);
  const userInitials = useMemo(() => initialsFromName(displayName), [displayName]);
  const isCoachAccount = role !== "member";
  const coachMessageRecipients = useMemo(
    () =>
      Array.isArray(payload.coach.members)
        ? payload.coach.members.map((member) => ({
            id: String(member.id || ""),
            name: String(member.name || "Member"),
          }))
        : [],
    [payload.coach.members],
  );

  useEffect(() => {
    if (!isCoachAccount) return;
    if (selectedCoachRecipientId) return;
    const first = coachMessageRecipients[0]?.id ?? "";
    if (first) setSelectedCoachRecipientId(first);
  }, [coachMessageRecipients, isCoachAccount, selectedCoachRecipientId]);

  useEffect(() => {
    if (role === "member") {
      setMode("member");
    }
  }, [role]);

  const allCarolRows = useMemo(() => (Array.isArray(payload.carolSessions) ? payload.carolSessions : []), [payload.carolSessions]);
  const rehitCarolRows = useMemo(
    () => allCarolRows.filter((row) => normalizeCarolTabKey(row.rideType) === "rehit"),
    [allCarolRows],
  );
  const fatBurnCarolRows = useMemo(
    () => allCarolRows.filter((row) => normalizeCarolTabKey(row.rideType) === "fat_burn"),
    [allCarolRows],
  );
  const peakPowerTrend = useMemo(() => {
    return rehitCarolRows
      .slice()
      .reverse()
      .map((row) => {
        const value = asNumericMetric(row.peakPowerWatts);
        if (value === null) return null;
        return { label: formatCarolDateLabel(row.sessionDate), value };
      })
      .filter((point): point is TrendPoint => Boolean(point));
  }, [rehitCarolRows]);
  const manpTrend = useMemo(() => {
    return rehitCarolRows
      .slice()
      .reverse()
      .map((row) => {
        const value = asNumericMetric(row.manp);
        if (value === null) return null;
        return { label: formatCarolDateLabel(row.sessionDate), value };
      })
      .filter((point): point is TrendPoint => Boolean(point));
  }, [rehitCarolRows]);
  const caloriesTrend = useMemo(() => {
    return allCarolRows
      .slice()
      .reverse()
      .map((row) => {
        const value = asNumericMetric(row.caloriesInclEpoc) ?? asNumericMetric(row.caloriesActive);
        if (value === null) return null;
        return { label: formatCarolDateLabel(row.sessionDate), value };
      })
      .filter((point): point is TrendPoint => Boolean(point));
  }, [allCarolRows]);

  const loadMessages = useCallback(
    async (markRead: boolean, targetPeerId?: string) => {
      try {
        const params = new URLSearchParams();
        if (markRead) params.set("mark_read", "1");
        if (targetPeerId && targetPeerId.trim()) params.set("peer_id", targetPeerId.trim());
        const response = await getJson<{
          peer?: { id?: string; full_name?: string; role?: string };
          coach?: { id?: string; full_name?: string };
          unread_count?: number;
          messages?: MessageItem[];
        }>(`/api/messages/inbox${params.toString() ? `?${params.toString()}` : ""}`);
        const resolvedPeerId = String(response.peer?.id || response.coach?.id || "");
        const resolvedPeerName = String(response.peer?.full_name || response.coach?.full_name || "Dustin");
        setPeerId(resolvedPeerId);
        setPeerName(resolvedPeerName);
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
    [],
  );

  const loadRecoverySummary = useCallback(
    async (monthKey: string, silent = false) => {
      if (!silent) setRecoveryLoading(true);
      try {
        const encodedMonth = encodeURIComponent(monthKey);
        const response = await getJson<{ summary?: unknown }>(`/api/recovery/summary?month=${encodedMonth}`);
        const normalized = normalizeRecoverySummary(response.summary, monthKey);
        if (!normalized) {
          throw new Error("Recovery summary was empty.");
        }
        setRecoverySummary(normalized);
        setRecoveryMonth(normalized.month);
        setRecoveryStatus("");
      } catch (error) {
        setRecoveryStatus(error instanceof Error ? error.message : "Unable to load recovery summary.");
      } finally {
        if (!silent) setRecoveryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (role !== "member" || memberView !== "messages") return;
    void loadMessages(true);
  }, [loadMessages, memberView, role]);

  useEffect(() => {
    if (!isCoachAccount || mode !== "coach" || coachView !== "messages") return;
    const targetPeerId = selectedCoachRecipientId || coachMessageRecipients[0]?.id || "";
    if (!targetPeerId) return;
    void loadMessages(true, targetPeerId);
  }, [coachMessageRecipients, coachView, isCoachAccount, loadMessages, mode, selectedCoachRecipientId]);

  useEffect(() => {
    if (role !== "member" || mode !== "member" || memberView !== "recovery") return;
    void loadRecoverySummary(recoveryMonth, true);
  }, [loadRecoverySummary, memberView, mode, recoveryMonth, role]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refreshRecovery = () => {
      if (role === "member" && mode === "member" && memberView === "recovery") {
        void loadRecoverySummary(recoveryMonth, true);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "iso_club_recovery_updated_at") return;
      refreshRecovery();
    };
    const onLogged = () => {
      refreshRecovery();
    };

    window.addEventListener("focus", refreshRecovery);
    window.addEventListener("pageshow", refreshRecovery);
    window.addEventListener("storage", onStorage);
    window.addEventListener("iso-club:recovery-logged", onLogged as EventListener);
    return () => {
      window.removeEventListener("focus", refreshRecovery);
      window.removeEventListener("pageshow", refreshRecovery);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("iso-club:recovery-logged", onLogged as EventListener);
    };
  }, [loadRecoverySummary, memberView, mode, recoveryMonth, role]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

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

  const activeMemberView = (view: MemberSection): string => (memberView === view ? "nav-item active" : "nav-item");
  const activeCoachView = (view: CoachSection): string => (coachView === view ? "nav-item active" : "nav-item");

  const setMemberSection = (view: MemberSection) => {
    setMode("member");
    setMemberView(view);
  };

  const latestRehitPeakPower = useMemo(
    () => pickLatestMetric(rehitCarolRows, [(row) => row.peakPowerWatts]),
    [rehitCarolRows],
  );
  const latestRehitSprintPower = useMemo(
    () => pickLatestMetric(rehitCarolRows, [(row) => row.avgSprintPower]),
    [rehitCarolRows],
  );
  const latestRehitManp = useMemo(
    () => pickLatestMetric(rehitCarolRows, [(row) => row.manp]),
    [rehitCarolRows],
  );
  const latestCaloriesInclEpoc = useMemo(
    () => pickLatestMetric(allCarolRows, [(row) => row.caloriesInclEpoc, (row) => row.caloriesActive, (row) => row.calories]),
    [allCarolRows],
  );
  const latestMaxHr = useMemo(
    () => pickLatestMetric(allCarolRows, [(row) => row.heartRateMax, (row) => row.maxHr, (row) => row.heartRateAvg]),
    [allCarolRows],
  );
  const recoveryCards = useMemo(
    () =>
      RECOVERY_MODALITY_CONFIG.map((item) => {
        const count = recoverySummary.counts[item.key] ?? 0;
        const goal = recoverySummary.goals[item.key] ?? 0;
        return {
          ...item,
          count,
          goal,
          reachedGoal: goal > 0 && count >= goal,
        };
      }),
    [recoverySummary],
  );
  const reachedGoals = useMemo(
    () => recoveryCards.filter((item) => item.reachedGoal),
    [recoveryCards],
  );
  const recoveryCalendarCells = useMemo(
    () => buildRecoveryCalendarCells(recoverySummary.month, recoverySummary.days),
    [recoverySummary.days, recoverySummary.month],
  );
  const selectedRecoveryDay = useMemo(() => {
    if (!selectedRecoveryDate) return null;
    return recoverySummary.days.find((row) => row.date === selectedRecoveryDate) ?? null;
  }, [recoverySummary.days, selectedRecoveryDate]);

  useEffect(() => {
    if (!recoverySummary.days.length) {
      if (selectedRecoveryDate) setSelectedRecoveryDate("");
      return;
    }
    const hasSelected = recoverySummary.days.some((row) => row.date === selectedRecoveryDate);
    if (!hasSelected) {
      setSelectedRecoveryDate(recoverySummary.days[recoverySummary.days.length - 1]?.date ?? "");
    }
  }, [recoverySummary.days, selectedRecoveryDate]);

  const goToPreviousRecoveryMonth = () => {
    const previous = shiftMonth(recoveryMonth, -1);
    setRecoveryMonth(previous);
    void loadRecoverySummary(previous);
  };

  const goToNextRecoveryMonth = () => {
    const next = shiftMonth(recoveryMonth, 1);
    if (next > currentRecoveryMonth) return;
    setRecoveryMonth(next);
    void loadRecoverySummary(next);
  };

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
            ) : null}
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
          <div className="grid-4">
            <div className="stat-card anim d1">
              <div className="stat-label">CAROL fitness score</div>
              <div className="stat-val">{payload.metrics.carolFitness}</div>
            </div>
            <div className="stat-card amber anim d2">
              <div className="stat-label">ARX leg press output</div>
              <div className="stat-val">{payload.metrics.arxOutput}</div>
            </div>
            <div className="stat-card blue anim d3">
              <div className="stat-label">Lean mass</div>
              <div className="stat-val">{payload.metrics.leanMass}</div>
            </div>
            <div className="stat-card teal anim d4">
              <div className="stat-label">Whoop recovery</div>
              <div className="stat-val">{payload.metrics.whoopRecovery}</div>
            </div>
          </div>

          <div className="grid-21">
            <div className="card">
              <div className="track-hero">
                <div style={{ flex: 1 }}>
                  <div className="track-name">{payload.protocol.name || "Strength Foundation Track"}</div>
                  <div className="track-meta">
                    Prescribed by <b>Dustin</b> · Week {payload.protocol.weekCurrent} of {payload.protocol.weekTotal}
                  </div>
                </div>
                <span className="tag tag-lime">Active</span>
              </div>
              {payload.protocol.sessions.length ? (
                payload.protocol.sessions.map((session, index) => (
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
                <div className="card-body">
                  <p style={{ color: "var(--text3)" }}>No protocol sessions assigned yet.</p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Healthspan OS</div>
                    <div className="card-sub">Calculated score: {payload.healthspan.overall}</div>
                  </div>
                </div>
                <div className="os-grid">
                  <div className="os-item"><div className="os-item-top"><span className="os-item-label">Muscle</span><span className="os-item-score">{payload.healthspan.muscle}</span></div></div>
                  <div className="os-item"><div className="os-item-top"><span className="os-item-label">Cardio</span><span className="os-item-score">{payload.healthspan.cardio}</span></div></div>
                  <div className="os-item"><div className="os-item-top"><span className="os-item-label">Metabolic</span><span className="os-item-score">{payload.healthspan.metabolic}</span></div></div>
                  <div className="os-item"><div className="os-item-top"><span className="os-item-label">Structural</span><span className="os-item-score">{payload.healthspan.structural}</span></div></div>
                  <div className="os-item" style={{ gridColumn: "1 / -1" }}><div className="os-item-top"><span className="os-item-label">Recovery</span><span className="os-item-score">{payload.healthspan.recovery}</span></div></div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">From Dustin</div>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.7 }}>
                    Your progress is updating in real time. Open messages to ask questions or get adjustments.
                  </p>
                  <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setMemberSection("messages")} type="button">
                    Reply →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="view-protocol" className="content" style={{ display: mode === "member" && memberView === "protocol" ? "block" : "none" }}>
          <div className="sec-header">
            <div className="sec-title">My Protocol</div>
          </div>
          <div className="card">
            <div className="track-hero">
              <div style={{ flex: 1 }}>
                <div className="track-name">{payload.protocol.name || "Protocol"}</div>
                <div className="track-meta">Week {payload.protocol.weekCurrent} of {payload.protocol.weekTotal}</div>
              </div>
              <span className="tag tag-lime">Active</span>
            </div>
            {payload.protocol.sessions.length ? (
              payload.protocol.sessions.map((session, index) => (
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
              <div className="card-body"><p style={{ color: "var(--text3)" }}>No protocol assigned yet.</p></div>
            )}
          </div>
        </div>

        <div id="view-carol" className="content" style={{ display: mode === "member" && memberView === "carol" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">CAROL Rides</div></div>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <div className="stat-card"><div className="stat-label">Peak Power (REHIT)</div><div className="stat-val">{latestRehitPeakPower}</div></div>
            <div className="stat-card amber"><div className="stat-label">Sprint Power (REHIT)</div><div className="stat-val">{latestRehitSprintPower}</div></div>
            <div className="stat-card blue"><div className="stat-label">MANP (REHIT)</div><div className="stat-val">{latestRehitManp}</div></div>
            <div className="stat-card teal"><div className="stat-label">Calories incl EPOC</div><div className="stat-val">{latestCaloriesInclEpoc}</div></div>
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="stat-card"><div className="stat-label">Max HR</div><div className="stat-val">{latestMaxHr}</div></div>
            <div className="stat-card blue"><div className="stat-label">Ride count</div><div className="stat-val">{allCarolRows.length}</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
            <CarolTrendChart title="Peak power over time (REHIT)" points={peakPowerTrend} lineColor="var(--lime)" unit="W" />
            <CarolTrendChart title="MANP over time (REHIT)" points={manpTrend} lineColor="var(--blue)" unit="" />
            <CarolTrendChart title="Calories incl EPOC over time" points={caloriesTrend} lineColor="var(--amber)" unit="" />
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">REHIT rides</div></div>
              {rehitCarolRows.length ? (
                rehitCarolRows.slice(0, 24).map((row) => (
                  <div className="metric-row" key={`rehit-${row.sessionDate}-${row.rideNumber}`}>
                    <div className="metric-label">{formatCarolDateLabel(row.sessionDate)}</div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>Peak <b style={{ color: "var(--text)" }}>{row.peakPowerWatts}</b></span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>Sprint <b style={{ color: "var(--text)" }}>{row.avgSprintPower}</b></span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>MANP <b style={{ color: "var(--text)" }}>{row.manp}</b></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card-body"><p style={{ color: "var(--text3)" }}>No REHIT sessions yet.</p></div>
              )}
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Fat Burn rides</div></div>
              {fatBurnCarolRows.length ? (
                fatBurnCarolRows.slice(0, 24).map((row) => (
                  <div className="metric-row" key={`fat-${row.sessionDate}-${row.rideNumber}`}>
                    <div className="metric-label">{formatCarolDateLabel(row.sessionDate)}</div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>Duration <b style={{ color: "var(--text)" }}>{row.durationSeconds}</b>s</span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>Calories <b style={{ color: "var(--text)" }}>{row.caloriesActive}</b></span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>Avg HR <b style={{ color: "var(--text)" }}>{row.heartRateAvg}</b></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card-body"><p style={{ color: "var(--text3)" }}>No Fat Burn sessions yet.</p></div>
              )}
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-header"><div className="card-title">All ride history</div></div>
            {allCarolRows.length ? (
              allCarolRows.slice(0, 30).map((row) => (
                <div className="metric-row" key={`all-${row.sessionDate}-${row.rideNumber}`}>
                  <div className="metric-label">{formatCarolDateLabel(row.sessionDate)} · {row.rideType}</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Peak <b style={{ color: "var(--text)" }}>{row.peakPowerWatts}</b></span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>MANP <b style={{ color: "var(--text)" }}>{row.manp}</b></span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>EPOC cal <b style={{ color: "var(--text)" }}>{row.caloriesInclEpoc}</b></span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Max HR <b style={{ color: "var(--text)" }}>{row.heartRateMax}</b></span>
                  </div>
                </div>
              ))
            ) : (
              <div className="card-body"><p style={{ color: "var(--text3)" }}>No rides logged yet.</p></div>
            )}
          </div>
        </div>

        <div id="view-arx" className="content" style={{ display: mode === "member" && memberView === "arx" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">ARX Strength</div></div>
          <div className="card">
            <div className="card-header"><div className="card-title">Exercise history</div></div>
            {payload.arxHistory.length ? (
              payload.arxHistory.map((row) => (
                <div className="metric-row" key={row.label}>
                  <div className="metric-label">{row.label}</div>
                  <div className="metric-val">{row.value}</div>
                </div>
              ))
            ) : (
              <div className="card-body"><p style={{ color: "var(--text3)" }}>No ARX sessions logged yet.</p></div>
            )}
          </div>
        </div>

        <div id="view-scans" className="content" style={{ display: mode === "member" && memberView === "scans" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Body Scans</div></div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">Body composition</div></div>
              <div className="metric-row"><div className="metric-label">Body fat %</div><div className="metric-val">{payload.scan.bodyFatPct}</div></div>
              <div className="metric-row"><div className="metric-label">Weight (lbs)</div><div className="metric-val">{payload.scan.weightLbs}</div></div>
              <div className="metric-row"><div className="metric-label">Lean mass (lbs)</div><div className="metric-val">{payload.scan.leanMassLbs}</div></div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Posture analysis</div></div>
              <div className="metric-row"><div className="metric-label">Head forward</div><div className="metric-val">{payload.scan.headForwardIn}&quot;</div></div>
              <div className="metric-row"><div className="metric-label">Shoulder forward</div><div className="metric-val">{payload.scan.shoulderForwardIn}&quot;</div></div>
              <div className="metric-row"><div className="metric-label">Hip forward</div><div className="metric-val">{payload.scan.hipForwardIn}&quot;</div></div>
            </div>
          </div>
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
              <div className="card-header">
                <div>
                  <div className="card-title">Recovery sessions — {recoverySummary.monthLabel}</div>
                  <div className="card-sub">
                    {recoverySummary.protocolName
                      ? `${recoverySummary.protocolName} goals`
                      : "Default monthly goals"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm" type="button" onClick={goToPreviousRecoveryMonth} aria-label="Previous month">
                    ←
                  </button>
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={goToNextRecoveryMonth}
                    aria-label="Next month"
                    disabled={recoveryMonth >= currentRecoveryMonth}
                  >
                    →
                  </button>
                </div>
              </div>
              <div className="recovery-grid">
                {recoveryCards.map((item) => (
                  <div className="rec-item" key={item.key}>
                    <div className="rec-count" style={{ color: item.cssColor }}>
                      {item.count}
                    </div>
                    <div className="rec-label">{item.label}</div>
                    <div className="rec-goal" style={{ color: item.reachedGoal ? "var(--lime)" : "var(--text3)" }}>
                      {item.count} of {item.goal} this month{item.reachedGoal ? " ✓" : ""}
                    </div>
                  </div>
                ))}
              </div>
              {reachedGoals.length ? (
                <div
                  style={{
                    margin: "0 18px 14px 18px",
                    padding: "10px 12px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid rgba(201,240,85,0.35)",
                    background: "rgba(201,240,85,0.08)",
                    fontSize: 12,
                    color: "var(--lime)",
                  }}
                >
                  Congratulations — goal hit for{" "}
                  {reachedGoals.map((item) => item.label).join(", ")}.
                </div>
              ) : null}
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Recovery calendar</div></div>
              <div style={{ padding: "6px 18px 0 18px", display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} style={{ textAlign: "center" }}>{day}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                  {recoveryCalendarCells.map((cell, index) => (
                    <button
                      key={cell.date ? `${cell.date}-${index}` : `blank-${index}`}
                      type="button"
                      disabled={!cell.date}
                      onClick={() => {
                        if (!cell.date) return;
                        setSelectedRecoveryDate(cell.date);
                      }}
                      style={{
                        minHeight: 46,
                        borderRadius: 8,
                        border:
                          cell.date && selectedRecoveryDate === cell.date
                            ? "1px solid rgba(201,240,85,0.55)"
                            : "1px solid var(--border)",
                        background: "var(--bg3)",
                        color: "var(--text2)",
                        cursor: cell.date ? "pointer" : "default",
                        opacity: cell.date ? 1 : 0.35,
                        padding: "6px 4px",
                      }}
                    >
                      {cell.day ? <div style={{ fontSize: 11 }}>{cell.day}</div> : <div style={{ fontSize: 11 }}>&nbsp;</div>}
                      <div style={{ marginTop: 5, display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                        {cell.modalities.map((modality, dotIndex) => {
                          const config = RECOVERY_MODALITY_CONFIG.find((item) => item.key === modality);
                          return (
                            <span
                              key={`${cell.date ?? "blank"}-${modality}-${dotIndex}`}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: config?.cssColor ?? "var(--text3)",
                                display: "inline-block",
                              }}
                            />
                          );
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding: "12px 18px 0 18px", fontSize: 12, color: "var(--text2)" }}>
                {selectedRecoveryDay ? (
                  <>
                    <span style={{ color: "var(--text3)" }}>
                      {new Date(selectedRecoveryDay.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      :
                    </span>{" "}
                    {selectedRecoveryDay.modalities
                      .map((modality) => RECOVERY_MODALITY_CONFIG.find((item) => item.key === modality)?.label ?? modality)
                      .join(", ")}
                  </>
                ) : (
                  "Tap a day to see logged modalities."
                )}
              </div>
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Other sessions</div></div>
              <div className="recovery-grid">
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.vasper}</div><div className="rec-label">Vasper</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.katalyst}</div><div className="rec-label">Katalyst</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.proteus}</div><div className="rec-label">Proteus</div></div>
                <div className="rec-item"><div className="rec-count">{payload.recoveryCounts.quickboard}</div><div className="rec-label">Quickboard</div></div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Status</div></div>
              <div className="card-body" style={{ fontSize: 12, color: "var(--text3)" }}>
                {recoveryLoading ? "Refreshing recovery data..." : "Recovery data is up to date."}
                {recoveryStatus ? (
                  <div style={{ marginTop: 8, color: "var(--coral)" }}>{recoveryStatus}</div>
                ) : null}
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
                coachMessageRecipients.length ? (
                  coachMessageRecipients.map((member) => (
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
          <div className="sec-header"><div className="sec-title">Protocols</div></div>
          <div className="card"><div className="card-body">Create and manage member protocols here.</div></div>
        </div>
      </main>
    </div>
  );
}

export type { DashboardPayload, MemberSection, CoachSection };
