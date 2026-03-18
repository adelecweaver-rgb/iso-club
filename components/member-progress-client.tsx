"use client";

import Link from "next/link";
import { useState } from "react";
import type { DashboardPayload } from "@/components/dashboard-react-client";

const GOAL_DEFS: Record<string, { name: string }> = {
  gain_muscle: { name: "Gain Muscle" },
  lose_fat: { name: "Lose Body Fat" },
  improve_cardio: { name: "Improve Cardio Fitness" },
  attendance: { name: "Stay Consistent" },
};


const GOAL_NAMES_LONG: Record<string, string> = {
  gain_muscle: "Gain Muscle",
  lose_fat: "Lose Body Fat",
  improve_cardio: "Improve Cardio Fitness",
  attendance: "Stay Consistent",
};

export function MemberProgressClient({ payload }: { payload: DashboardPayload }) {
  const [localGoals, setLocalGoals] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { gain_muscle: false, lose_fat: false, improve_cardio: false, attendance: false };
    for (const gt of payload.goals.activeGoals) init[gt] = true;
    return init;
  });
  const [savingGoal, setSavingGoal] = useState<string | null>(null);

  async function handleGoalToggle(goalType: string) {
    const newVal = !localGoals[goalType];
    setSavingGoal(goalType);
    setLocalGoals((prev) => ({ ...prev, [goalType]: newVal }));
    try {
      await fetch("/api/member/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal_type: goalType, is_active: newVal }) });
    } catch { setLocalGoals((prev) => ({ ...prev, [goalType]: !newVal })); }
    finally { setSavingGoal(null); }
  }

  const dirIcon = (d: string) => d === "up" ? " ↑" : d === "down" ? " ↓" : "";
  const activeGoalTypes = (["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const).filter((gt) => localGoals[gt]);

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: "24px 20px", maxWidth: 720, margin: "0 auto" }}>
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none" }}>← Back to Dashboard</Link>
      </div>

      {/* ── Vitality Age ──────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, rgba(157,204,58,0.06) 0%, rgba(157,204,58,0.02) 100%)", border: "1px solid rgba(157,204,58,0.2)", borderRadius: 16, padding: "28px 28px 24px", marginBottom: 24 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(157,204,58,0.7)", marginBottom: 12 }}>Your Vitality Age</div>
        {payload.vitalityAge.hasEnoughData && payload.vitalityAge.estimated !== null ? (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 72, fontWeight: 800, color: "#edeae0", lineHeight: 1, fontFamily: "Georgia, serif" }}>{payload.vitalityAge.estimated}</div>
              <div style={{ paddingBottom: 8, color: "#9b9889", fontSize: 13 }}>years old (functionally)</div>
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
                {payload.vitalityAge.trend > 0
                  ? `↑ Improved ${payload.vitalityAge.trend} year${payload.vitalityAge.trend !== 1 ? "s" : ""} since last calculation`
                  : `↓ Up ${Math.abs(payload.vitalityAge.trend)} year${Math.abs(payload.vitalityAge.trend) !== 1 ? "s" : ""} since last calculation`}
              </div>
            )}
          </>
        ) : (
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#6b6a5e", marginBottom: 8 }}>—</div>
            <p style={{ fontSize: 13, color: "#9b9889", margin: 0, lineHeight: 1.6 }}>
              Complete your first Fit3D scan and CAROL session to calculate your Vitality Age.
            </p>
          </div>
        )}
      </div>

      {/* ── Goal Progress Cards ────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9b9889", marginBottom: 14 }}>Goal Progress</div>

        {/* Goal toggles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {(["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const).map((gt) => {
            const isOn = localGoals[gt] ?? false;
            return (
              <button key={gt} type="button"
                onClick={() => { void handleGoalToggle(gt); }}
                disabled={savingGoal === gt}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: isOn ? "rgba(157,204,58,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${isOn ? "rgba(157,204,58,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", opacity: savingGoal === gt ? 0.6 : 1 }}>
                <span style={{ fontSize: 12, color: "#edeae0" }}>{GOAL_DEFS[gt]?.name ?? gt}</span>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: isOn ? "#9dcc3a" : "rgba(255,255,255,0.1)", position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: isOn ? 19 : 3, transition: "left 0.15s" }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress detail cards */}
        {activeGoalTypes.length === 0 ? (
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px" }}>
            <p style={{ fontSize: 13, color: "#9b9889", margin: 0 }}>Toggle on the goals you&apos;re tracking above to see your progress.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {activeGoalTypes.map((gt) => {
              const det = payload.goalDetails[gt];
              const upC = "#9dcc3a"; const downC = "#e05252"; const neutC = "#e8a838";
              const stColor = det.status === "on_track" || det.status === "improving" ? upC : det.status === "maintaining" || det.status === "behind" ? neutC : det.status === "declining" || det.status === "off_track" ? downC : "#6b6a5e";
              return (
                <div key={gt} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#edeae0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{GOAL_NAMES_LONG[gt]}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: stColor, background: `${stColor}20`, borderRadius: 4, padding: "2px 8px" }}>{det.statusLabel}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#9b9889", marginBottom: 4 }}>Since joining</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#edeae0" }}>{det.sinceJoining}{dirIcon(det.sinceJoiningDir)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#9b9889", marginBottom: 4 }}>This month</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#edeae0" }}>{det.thisMonth}{dirIcon(det.thisMonthDir)}</div>
                    </div>
                  </div>
                  {det.encouragement && (
                    <div style={{ fontSize: 11, color: "#9b9889", marginTop: 10, lineHeight: 1.5, fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>{det.encouragement}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
