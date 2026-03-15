"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
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

type CoachSection = "morning" | "members" | "log" | "protocols";

type CarolSession = {
  sessionDate: string;
  rideNumber: string;
  rideType: string;
  fitnessScore: string;
  peakPowerWatts: string;
  calories: string;
  maxHr: string;
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
  const { user } = useUser();
  const [mode, setMode] = useState<"member" | "coach">(
    role === "member" ? "member" : route === "coach" ? "coach" : "member",
  );
  const [memberView, setMemberView] = useState<MemberSection>(initialMemberView);
  const [coachView, setCoachView] = useState<CoachSection>(initialCoachView);
  const [carolTab, setCarolTab] = useState<"rehit" | "fat_burn" | "free_custom" | "fitness_tests">(
    "rehit",
  );
  const [coachName, setCoachName] = useState("Dustin");
  const [coachId, setCoachId] = useState(payload.coachId ?? "");
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
    async (markRead: boolean) => {
      try {
        const response = await getJson<{
          coach?: { id?: string; full_name?: string };
          unread_count?: number;
          messages?: MessageItem[];
        }>(`/api/messages/inbox${markRead ? "?mark_read=1" : ""}`);
        setCoachId(String(response.coach?.id || ""));
        setCoachName(String(response.coach?.full_name || "Dustin"));
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

  useEffect(() => {
    if (role !== "member" || memberView !== "messages") return;
    void loadMessages(true);
  }, [loadMessages, memberView, role]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const sendMemberMessage = useCallback(async () => {
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
      const response = await postJson<{ message?: MessageItem }>("/api/messages/send", {
        recipient_id: coachId || undefined,
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
  }, [coachId, messageDraft, messages, sendingMessage]);

  const messageBadge = unreadCount > 0 ? unreadCount : undefined;

  const activeMemberView = (view: MemberSection): string => (memberView === view ? "nav-item active" : "nav-item");
  const activeCoachView = (view: CoachSection): string => (coachView === view ? "nav-item active" : "nav-item");

  const setMemberSection = (view: MemberSection) => {
    setMode("member");
    setMemberView(view);
  };

  const latestCarol = carolStatRows[0];
  const peakPower = carolStatRows.length
    ? Math.max(...carolStatRows.map((row) => Number(row.peakPowerWatts || 0)))
    : 0;

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
              onClick={() => setMemberSection("messages")}
              type="button"
            >
              Messages
              {unreadCount > 0 ? <span className="notif-dot" /> : null}
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
          <div className="tabs">
            <button className={`tab ${carolTab === "rehit" ? "active" : ""}`} onClick={() => setCarolTab("rehit")} type="button">REHIT</button>
            <button className={`tab ${carolTab === "fat_burn" ? "active" : ""}`} onClick={() => setCarolTab("fat_burn")} type="button">Fat Burn</button>
            <button className={`tab ${carolTab === "free_custom" ? "active" : ""}`} onClick={() => setCarolTab("free_custom")} type="button">Free &amp; Custom</button>
            <button className={`tab ${carolTab === "fitness_tests" ? "active" : ""}`} onClick={() => setCarolTab("fitness_tests")} type="button">Fitness Tests</button>
          </div>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <div className="stat-card"><div className="stat-label">Fitness score</div><div className="stat-val">{latestCarol?.fitnessScore || "--"}</div></div>
            <div className="stat-card amber"><div className="stat-label">Peak power</div><div className="stat-val">{peakPower > 0 ? Math.round(peakPower) : "--"}</div></div>
            <div className="stat-card blue"><div className="stat-label">Total rides</div><div className="stat-val">{memberCarolRows.length}</div></div>
            <div className="stat-card"><div className="stat-label">Last max HR</div><div className="stat-val">{latestCarol?.maxHr || "--"}</div></div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Ride history</div></div>
            {memberCarolRows.length ? (
              memberCarolRows.slice(0, 25).map((row) => (
                <div className="metric-row" key={`${row.sessionDate}-${row.rideNumber}`}>
                  <div className="metric-label">
                    {row.sessionDate || "Recent"} · Ride #{row.rideNumber}
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Score <b style={{ color: "var(--text)" }}>{row.fitnessScore}</b></span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Peak <b style={{ color: "var(--text)" }}>{row.peakPowerWatts}W</b></span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Cal <b style={{ color: "var(--text)" }}>{row.calories}</b></span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Max HR <b style={{ color: "var(--text)" }}>{row.maxHr}</b></span>
                  </div>
                </div>
              ))
            ) : (
              <div className="card-body"><p style={{ color: "var(--text3)" }}>No rides logged for this tab yet.</p></div>
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

        <div id="view-messages" className="content" style={{ display: mode === "member" && memberView === "messages" ? "block" : "none" }}>
          <div className="sec-header"><div className="sec-title">Messages</div></div>
          <div className="card" style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 460 }}>
            <div style={{ borderRight: "1px solid var(--border)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text3)" }}>
                Inbox
              </div>
              <div className={`msg-thread ${unreadCount > 0 ? "unread" : ""}`}>
                <div className="msg-av" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
                  {initialsFromName(coachName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="msg-from">{coachName}</div>
                  <div className="msg-preview">{messages[messages.length - 1]?.body || "No messages yet"}</div>
                </div>
                <div className="msg-time">{formatMessageTime(messages[messages.length - 1]?.created_at || "")}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div className="msg-av" style={{ width: 36, height: 36, fontSize: 13, background: "var(--amber-dim)", color: "var(--amber)" }}>
                  {initialsFromName(coachName)}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{coachName}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Head Coach · Iso Club</div>
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
                  <p style={{ color: "var(--text3)" }}>No messages yet. Send Dustin a note to start the thread.</p>
                )}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Reply to Dustin…"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                />
                <button className="btn btn-lime" type="button" onClick={() => void sendMemberMessage()} disabled={sendingMessage}>
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
