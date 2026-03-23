"use client";

import {
  type OnboardingAnswers,
  GOAL_LABELS,
  LIMITATION_LABELS,
  CONTRAST_LABELS,
  MOTIVATION_LABELS,
} from "@/lib/onboarding";
import { useState } from "react";

// ── Design tokens (matches member-settings-client.tsx) ────────────────────────
const C = {
  bg:        "#F5F0E8",
  bg2:       "#EDE8DE",
  bg3:       "#E4DDD2",
  white:     "#ffffff",
  text:      "#1C2B1E",
  text2:     "#3D4F3F",
  text3:     "#6B7B6E",
  border:    "rgba(28,43,30,0.12)",
  border2:   "rgba(28,43,30,0.22)",
  green:     "#3A6347",
  greenDim:  "rgba(58,99,71,0.1)",
  amber:     "#8B6914",
  amberDim:  "rgba(139,105,20,0.1)",
  coral:     "#b84040",
};

const GOALS = Object.entries(GOAL_LABELS) as [string, string][];
const LIMITATIONS = Object.entries(LIMITATION_LABELS) as [string, string][];
const CONTRAST_OPTIONS = Object.entries(CONTRAST_LABELS) as [string, string][];
const MOTIVATION_OPTIONS = Object.entries(MOTIVATION_LABELS) as [string, string][];
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

type Props = {
  initialAnswers: OnboardingAnswers;
  saving: boolean;
  onSave: (answers: OnboardingAnswers, requestReview: boolean) => void;
  confirmationMessage: { text: string; ok: boolean } | null;
};

export function HealthProfileForm({ initialAnswers, saving, onSave, confirmationMessage }: Props) {
  const [answers, setAnswers] = useState<OnboardingAnswers>({ ...initialAnswers });

  function toggleGoal(key: string) {
    setAnswers((prev) => {
      const goals = prev.goals.includes(key)
        ? prev.goals.filter((g) => g !== key)
        : [...prev.goals, key];
      return { ...prev, goals };
    });
  }

  function toggleLimitation(key: string) {
    setAnswers((prev) => {
      let lims = prev.health_limitations;
      if (key === "none") {
        // selecting "none" clears everything else
        lims = lims.includes("none") ? [] : ["none"];
      } else {
        lims = lims.includes(key)
          ? lims.filter((l) => l !== key)
          : [...lims.filter((l) => l !== "none"), key];
      }
      return { ...prev, health_limitations: lims };
    });
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 600,
    color: C.text3,
    marginBottom: 8,
    marginTop: 0,
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: C.text3,
    marginBottom: 6,
    display: "block",
  };

  const optionGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 20,
  };

  const optionCard = (active: boolean): React.CSSProperties => ({
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${active ? C.green : C.border2}`,
    background: active ? C.greenDim : C.white,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? C.green : C.text2,
    textAlign: "left" as const,
    transition: "all 0.12s",
    lineHeight: 1.4,
  });

  const textarea: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box" as const,
    background: C.white,
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    color: C.text,
    resize: "vertical" as const,
    minHeight: 80,
    fontFamily: "inherit",
    outline: "none",
    marginBottom: 20,
  };

  const divider: React.CSSProperties = {
    borderTop: `1px solid ${C.border}`,
    margin: "4px 0 20px",
  };

  return (
    <div>
      {/* Goals */}
      <div style={{ marginBottom: 4 }}>
        <div style={sectionLabel}>Goals</div>
        <p style={{ fontSize: 12, color: C.text3, marginBottom: 12, marginTop: 0 }}>
          Select all that apply.
        </p>
        <div style={optionGrid}>
          {GOALS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              style={optionCard(answers.goals.includes(key))}
              onClick={() => toggleGoal(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={divider} />

      {/* Health conditions */}
      <div style={{ marginBottom: 4 }}>
        <div style={sectionLabel}>Health conditions</div>
        <p style={{ fontSize: 12, color: C.text3, marginBottom: 12, marginTop: 0 }}>
          Any injuries, joint issues, or conditions we should account for.
        </p>
        <div style={{ ...optionGrid, gridTemplateColumns: "1fr 1fr 1fr" }}>
          {LIMITATIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              style={optionCard(answers.health_limitations.includes(key))}
              onClick={() => toggleLimitation(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={divider} />

      {/* Injury / joint notes */}
      <div>
        <span style={fieldLabel}>Injury or joint notes</span>
        <textarea
          style={textarea}
          value={answers.notes ?? ""}
          onChange={(e) => setAnswers((prev) => ({ ...prev, notes: e.target.value || null }))}
          placeholder="Describe any specific injuries, chronic pain, or movement restrictions…"
        />
      </div>

      {/* Days available */}
      <div>
        <span style={fieldLabel}>Days available per week</span>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() =>
                setAnswers((prev) => ({
                  ...prev,
                  days_available_per_week: prev.days_available_per_week === d ? null : d,
                }))
              }
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: answers.days_available_per_week === d ? C.green : C.white,
                border: `1px solid ${answers.days_available_per_week === d ? C.green : C.border2}`,
                color: answers.days_available_per_week === d ? "#fff" : C.text2,
                transition: "all 0.12s",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div style={divider} />

      {/* Contrast therapy preference */}
      <div style={{ marginBottom: 4 }}>
        <div style={sectionLabel}>Contrast therapy preference</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {CONTRAST_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              style={optionCard(answers.contrast_therapy_pref === key)}
              onClick={() =>
                setAnswers((prev) => ({
                  ...prev,
                  contrast_therapy_pref: prev.contrast_therapy_pref === key ? null : key,
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={divider} />

      {/* Motivation style */}
      <div style={{ marginBottom: 4 }}>
        <div style={sectionLabel}>Motivation style</div>
        <p style={{ fontSize: 12, color: C.text3, marginBottom: 12, marginTop: 0 }}>
          Helps us frame your protocol in the way that keeps you most engaged.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {MOTIVATION_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              style={optionCard(answers.motivation_style === key)}
              onClick={() =>
                setAnswers((prev) => ({
                  ...prev,
                  motivation_style: prev.motivation_style === key ? null : key,
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation message */}
      {confirmationMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            background: confirmationMessage.ok ? C.greenDim : "rgba(184,64,64,0.1)",
            border: `1px solid ${confirmationMessage.ok ? "rgba(58,99,71,0.25)" : "rgba(184,64,64,0.25)"}`,
            fontSize: 13,
            color: confirmationMessage.ok ? C.green : C.coral,
            fontWeight: 500,
          }}
        >
          {confirmationMessage.text}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(answers, true)}
          style={{
            background: C.green,
            border: "none",
            color: "#fff",
            borderRadius: 10,
            padding: "14px 20px",
            fontWeight: 700,
            fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            textAlign: "left",
            lineHeight: 1.4,
          }}
        >
          {saving ? "Saving…" : "Save and request protocol review"}
          {!saving && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: "rgba(255,255,255,0.75)",
                marginTop: 2,
              }}
            >
              Coach Dustin will be notified and will update your protocol.
            </div>
          )}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(answers, false)}
          style={{
            background: C.white,
            border: `1px solid ${C.border2}`,
            color: C.text2,
            borderRadius: 10,
            padding: "12px 20px",
            fontWeight: 600,
            fontSize: 13,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          Save without requesting review
        </button>
      </div>
    </div>
  );
}
