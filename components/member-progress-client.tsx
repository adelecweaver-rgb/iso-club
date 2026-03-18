"use client";

import Link from "next/link";
import type { DashboardPayload } from "@/components/dashboard-react-client";

// ── Sparkline helper ──────────────────────────────────────────────────────────
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

function dirColor(dir: "up" | "down" | "none", goodDir: "up" | "down"): string {
  if (dir === "none") return "#9b9889";
  return dir === goodDir ? "#9dcc3a" : "#e05252";
}

function dirArrow(dir: "up" | "down" | "none"): string {
  return dir === "up" ? " ↑" : dir === "down" ? " ↓" : "";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MemberProgressClient({ payload }: { payload: DashboardPayload }) {
  const scansAsc = [...payload.scanHistory].reverse();
  const carolAsc = [...payload.carolSessions].reverse();

  const leanVals = scansAsc.map((s) => s.leanMassLbsRaw ?? null);
  const fatVals = scansAsc.map((s) => s.bodyFatPctRaw ?? null);
  const powerVals = carolAsc.map((s) => {
    const v = parseFloat(s.peakPowerWatts);
    return Number.isFinite(v) && v > 0 ? v : null;
  });

  const firstLean = leanVals.find((v) => v !== null);
  const lastLean = [...leanVals].reverse().find((v) => v !== null);
  const firstFat = fatVals.find((v) => v !== null);
  const lastFat = [...fatVals].reverse().find((v) => v !== null);
  const firstPow = powerVals.find((v) => v !== null);
  const lastPow = [...powerVals].reverse().find((v) => v !== null);

  const peakPower = payload.carolSessions.length
    ? Math.max(...payload.carolSessions.map((s) => parseFloat(s.peakPowerWatts) || 0))
    : 0;
  const latestManp = payload.carolSessions.find((s) => parseFloat(s.manp) > 0);

  const totalSessions =
    (payload.carolSessions.length > 0 ? payload.carolSessions.length : 0) +
    (payload.arxSessions.length > 0 ? payload.arxSessions.length : 0);

  const gm = payload.goalDetails.gain_muscle;
  const lf = payload.goalDetails.lose_fat;
  const ic = payload.goalDetails.improve_cardio;
  const att = payload.goalDetails.attendance;

  // Card background by direction
  const cardBg = (dir: "up" | "down" | "none", good: "up" | "down") => {
    if (dir === "none") return "var(--bg3)";
    return dir === good ? "rgba(157,204,58,0.04)" : "rgba(224,82,82,0.04)";
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>

      {/* Back */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: "#9b9889", textDecoration: "none" }}>← Back to Dashboard</Link>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#edeae0", marginBottom: 6, fontFamily: "Georgia, serif" }}>Healthspan Progress</div>
        <div style={{ fontSize: 14, color: "#9b9889", marginBottom: 4 }}>Your body&apos;s story since joining Iso Club</div>
        {payload.memberSince && (
          <div style={{ fontSize: 12, color: "rgba(157,204,58,0.6)", fontWeight: 500 }}>Member since {payload.memberSince}</div>
        )}
      </div>

      {/* ── Section 1: Vitality Age ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#9b9889", marginBottom: 14 }}>Vitality Age</div>
        <div style={{ background: "linear-gradient(135deg, rgba(157,204,58,0.07) 0%, rgba(157,204,58,0.02) 100%)", border: "1px solid rgba(157,204,58,0.2)", borderRadius: 16, padding: "24px 28px" }}>
          {payload.vitalityAge.hasEnoughData && payload.vitalityAge.estimated !== null ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 10 }}>
                <div style={{ fontSize: 64, fontWeight: 800, color: "#edeae0", lineHeight: 1, fontFamily: "Georgia, serif" }}>
                  {payload.vitalityAge.estimated}
                </div>
                <div style={{ paddingBottom: 8, color: "#9b9889", fontSize: 13 }}>years old (functionally)</div>
              </div>
              {payload.vitalityAge.difference !== null && payload.vitalityAge.difference !== 0 && (
                <div style={{ fontSize: 15, color: payload.vitalityAge.difference > 0 ? "#9dcc3a" : "#e05252", fontWeight: 500, marginBottom: payload.vitalityAge.trend !== null ? 4 : 0 }}>
                  {payload.vitalityAge.difference > 0
                    ? `You're functioning ${payload.vitalityAge.difference} year${payload.vitalityAge.difference !== 1 ? "s" : ""} younger than your age`
                    : `Vitality age is ${Math.abs(payload.vitalityAge.difference)} year${Math.abs(payload.vitalityAge.difference) !== 1 ? "s" : ""} above chronological age`}
                </div>
              )}
              {payload.vitalityAge.trend !== null && payload.vitalityAge.trend !== 0 && (
                <div style={{ fontSize: 12, color: payload.vitalityAge.trend > 0 ? "#9dcc3a" : "#e05252" }}>
                  {payload.vitalityAge.trend > 0
                    ? `↑ Improved ${payload.vitalityAge.trend} year${payload.vitalityAge.trend !== 1 ? "s" : ""} since joining`
                    : `↓ Up ${Math.abs(payload.vitalityAge.trend)} year${Math.abs(payload.vitalityAge.trend) !== 1 ? "s" : ""} since last calculation`}
                </div>
              )}
            </>
          ) : (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#6b6a5e", marginBottom: 8 }}>—</div>
              <p style={{ fontSize: 13, color: "#9b9889", margin: 0, lineHeight: 1.6 }}>
                Complete your first Fit3D scan and CAROL session to calculate your Vitality Age.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: The 4 key metrics ─────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#9b9889", marginBottom: 14 }}>The 4 key metrics</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>

          {/* Muscle */}
          <div style={{ background: cardBg(gm.sinceJoiningDir, "up"), border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9b9889", marginBottom: 12 }}>Muscle</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#edeae0", marginBottom: 12 }}>
              {payload.scan.leanMassLbs !== "--" ? `${payload.scan.leanMassLbs} lbs` : "—"}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#9b9889", marginLeft: 6 }}>lean mass</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9b9889" }}>Since joining</span>
                <span style={{ fontWeight: 600, color: dirColor(gm.sinceJoiningDir, "up") }}>{gm.sinceJoining}{dirArrow(gm.sinceJoiningDir)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9b9889" }}>Last month</span>
                <span style={{ fontWeight: 500, color: dirColor(gm.thisMonthDir, "up") }}>{gm.thisMonth}{dirArrow(gm.thisMonthDir)}</span>
              </div>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>Data source: Fit3D</div>
          </div>

          {/* Body Fat */}
          <div style={{ background: cardBg(lf.sinceJoiningDir, "down"), border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9b9889", marginBottom: 12 }}>Body Fat</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#edeae0", marginBottom: 12 }}>
              {payload.scan.bodyFatPct !== "--" ? `${payload.scan.bodyFatPct}%` : "—"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9b9889" }}>Since joining</span>
                <span style={{ fontWeight: 600, color: dirColor(lf.sinceJoiningDir, "down") }}>{lf.sinceJoining}{dirArrow(lf.sinceJoiningDir)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9b9889" }}>Last month</span>
                <span style={{ fontWeight: 500, color: dirColor(lf.thisMonthDir, "down") }}>{lf.thisMonth}{dirArrow(lf.thisMonthDir)}</span>
              </div>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>Data source: Fit3D</div>
          </div>

          {/* Cardio */}
          <div style={{ background: cardBg(ic.sinceJoiningDir, "up"), border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9b9889", marginBottom: 12 }}>Cardio Power</div>
            <div style={{ marginBottom: 12 }}>
              {peakPower > 0 && (
                <div style={{ fontSize: 22, fontWeight: 800, color: "#edeae0", lineHeight: 1.2 }}>{Math.round(peakPower)}W peak</div>
              )}
              {latestManp && (
                <div style={{ fontSize: 13, color: "#9b9889", marginTop: 2 }}>{latestManp.manp} MANP</div>
              )}
              {peakPower === 0 && <div style={{ fontSize: 22, fontWeight: 800, color: "#6b6a5e" }}>—</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9b9889" }}>Since joining</span>
                <span style={{ fontWeight: 600, color: dirColor(ic.sinceJoiningDir, "up") }}>{ic.sinceJoining}{dirArrow(ic.sinceJoiningDir)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9b9889" }}>Last month</span>
                <span style={{ fontWeight: 500, color: dirColor(ic.thisMonthDir, "up") }}>{ic.thisMonth}{dirArrow(ic.thisMonthDir)}</span>
              </div>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>Data source: CAROL</div>
          </div>

          {/* Consistency */}
          <div style={{ background: cardBg(att.sinceJoiningDir, "up"), border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9b9889", marginBottom: 12 }}>Consistency</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#edeae0", marginBottom: 12 }}>
              {totalSessions > 0 ? totalSessions : "—"}
              {totalSessions > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: "#9b9889", marginLeft: 6 }}>total sessions</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9b9889" }}>This month</span>
                <span style={{ fontWeight: 600, color: dirColor(att.thisMonthDir, "up") }}>{att.thisMonth}{dirArrow(att.thisMonthDir)}</span>
              </div>
              {payload.longestStreakWeeks > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#9b9889" }}>Longest streak</span>
                  <span style={{ fontWeight: 500, color: "#9dcc3a" }}>{payload.longestStreakWeeks} week{payload.longestStreakWeeks !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>Data source: ARX + CAROL + Recovery</div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Trend charts ──────────────────────────────────────────── */}
      {(leanVals.some((v) => v !== null) || fatVals.some((v) => v !== null) || powerVals.some((v) => v !== null)) && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#9b9889", marginBottom: 14 }}>Trends</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "Lean Mass", vals: leanVals, unit: "lbs", first: firstLean, last: lastLean, goodTrend: "up" as const },
              { label: "Body Fat", vals: fatVals, unit: "%", first: firstFat, last: lastFat, goodTrend: "down" as const },
              { label: "Peak Power", vals: powerVals, unit: "W", first: firstPow, last: lastPow, goodTrend: "up" as const },
            ].map((chart) => {
              const path = sparklinePath(chart.vals, 100, 40);
              const isGoodTrend =
                chart.first != null && chart.last != null
                  ? chart.goodTrend === "up" ? (chart.last as number) >= (chart.first as number) : (chart.last as number) <= (chart.first as number)
                  : true;
              const lineColor = chart.first == null ? "#9b9889" : isGoodTrend ? "#9dcc3a" : "#e05252";
              return (
                <div key={chart.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 14px 10px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9b9889", marginBottom: 8 }}>{chart.label}</div>
                  {path ? (
                    <>
                      <svg viewBox="0 0 100 40" style={{ width: "100%", height: 40, display: "block", marginBottom: 6 }}>
                        <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 9, color: "#9b9889" }}>
                          {chart.first != null ? (chart.unit === "W" ? `${Math.round(chart.first as number)}W` : chart.unit === "%" ? `${(chart.first as number).toFixed(1)}%` : `${(chart.first as number).toFixed(1)} lbs`) : "—"}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: lineColor }}>
                          {chart.last != null ? (chart.unit === "W" ? `${Math.round(chart.last as number)}W` : chart.unit === "%" ? `${(chart.last as number).toFixed(1)}%` : `${(chart.last as number).toFixed(1)} lbs`) : "—"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ height: 40, display: "flex", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#6b6a5e" }}>Not enough data</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section 4: Milestones ────────────────────────────────────────────── */}
      {payload.milestones.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#9b9889", marginBottom: 14 }}>Milestones</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {payload.milestones.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 16, width: 24, flexShrink: 0, textAlign: "center" }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#edeae0", fontWeight: 500 }}>{m.label}</div>
                </div>
                <div style={{ fontSize: 11, color: "#9b9889", whiteSpace: "nowrap", flexShrink: 0 }}>{m.dateLabel}</div>
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  );
}
