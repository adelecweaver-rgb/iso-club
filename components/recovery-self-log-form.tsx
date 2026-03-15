"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  memberName: string;
};

type ModalityKey = "cold" | "sauna" | "compression" | "nxpro";
type DateShortcut = "today" | "yesterday" | "custom";

type FormState = {
  dateShortcut: DateShortcut;
  customDate: string;
  duration: string;
  temperature: string;
  feeling: string;
  quickNotes: string[];
  notes: string;
  pressure: string;
  sessionType: string;
};

type HistoryItem = {
  modality: ModalityKey;
  detail: string;
  dateLabel: string;
};

const TODAY = new Date();
const TODAY_ISO = TODAY.toISOString().slice(0, 10);
const YESTERDAY_ISO = new Date(TODAY.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const MODALITY_META: Record<
  ModalityKey,
  {
    name: string;
    dbKey: "cold_plunge" | "infrared_sauna" | "compression_therapy" | "nxpro";
    color: "blue" | "amber" | "purple" | "teal";
    icon: string;
    countId: string;
    desc: string;
  }
> = {
  cold: {
    name: "Cold plunge",
    dbKey: "cold_plunge",
    color: "blue",
    icon: "🧊",
    countId: "cold-count",
    desc: "Temperature · duration · how you felt",
  },
  sauna: {
    name: "Infrared sauna",
    dbKey: "infrared_sauna",
    color: "amber",
    icon: "🌡️",
    countId: "sauna-count",
    desc: "Duration · temperature · notes",
  },
  compression: {
    name: "Compression boots",
    dbKey: "compression_therapy",
    color: "purple",
    icon: "🦵",
    countId: "compression-count",
    desc: "Duration · pressure setting",
  },
  nxpro: {
    name: "NxPro",
    dbKey: "nxpro",
    color: "teal",
    icon: "🧠",
    countId: "nxpro-count",
    desc: "Session type · duration · notes",
  },
};

const DURATION_PRESETS: Record<ModalityKey, number[]> = {
  cold: [1, 2, 3, 5, 10],
  sauna: [15, 20, 25, 30, 45],
  compression: [15, 20, 30, 45],
  nxpro: [10, 20, 30, 45],
};

const QUICK_NOTES: Record<ModalityKey, string[]> = {
  cold: [
    "Post-ARX session",
    "Morning plunge",
    "Felt energized after",
    "Tough to get in",
    "Best sleep after",
    "With sauna combo",
  ],
  sauna: [
    "Post-workout",
    "Pre-sleep",
    "With cold plunge",
    "Sweated a lot",
    "Felt tight going in",
    "Deep relaxation",
  ],
  compression: [
    "Post-run",
    "Legs were sore",
    "With sauna",
    "Pre-session",
    "Felt swollen",
    "Great flush",
  ],
  nxpro: [
    "Post-training",
    "Pre-sleep",
    "High stress day",
    "Fell asleep during",
    "Very relaxing",
    "Mind felt clearer",
  ],
};

const FEELINGS: Record<ModalityKey, Array<{ emoji: string; label: string }>> = {
  cold: [
    { emoji: "😫", label: "Rough" },
    { emoji: "😐", label: "Okay" },
    { emoji: "🙂", label: "Good" },
    { emoji: "😊", label: "Great" },
    { emoji: "🔥", label: "Amazing" },
  ],
  sauna: [
    { emoji: "😫", label: "Drained" },
    { emoji: "😐", label: "Okay" },
    { emoji: "🙂", label: "Relaxed" },
    { emoji: "😊", label: "Great" },
    { emoji: "✨", label: "Refreshed" },
  ],
  compression: [
    { emoji: "😫", label: "Heavy" },
    { emoji: "😐", label: "Same" },
    { emoji: "🙂", label: "Lighter" },
    { emoji: "😊", label: "Fresh" },
    { emoji: "⚡", label: "Energized" },
  ],
  nxpro: [
    { emoji: "😴", label: "Sleepy" },
    { emoji: "😌", label: "Calm" },
    { emoji: "🙂", label: "Balanced" },
    { emoji: "🎯", label: "Focused" },
    { emoji: "✨", label: "Restored" },
  ],
};

const INITIAL_COUNTS: Record<ModalityKey, number> = {
  cold: 6,
  sauna: 8,
  compression: 5,
  nxpro: 4,
};

const INITIAL_HISTORY: HistoryItem[] = [
  { modality: "cold", detail: "3 min · 50°F · Felt great", dateLabel: "Today" },
  { modality: "sauna", detail: "30 min · 140°F", dateLabel: "Yesterday" },
  { modality: "compression", detail: "20 min · Medium pressure", dateLabel: "Mar 12" },
  { modality: "nxpro", detail: "20 min · Recovery protocol", dateLabel: "Mar 11" },
  { modality: "cold", detail: "5 min · 45°F · Amazing", dateLabel: "Mar 10" },
];

function defaultFormState(): FormState {
  return {
    dateShortcut: "today",
    customDate: TODAY_ISO,
    duration: "",
    temperature: "",
    feeling: "",
    quickNotes: [],
    notes: "",
    pressure: "Medium — standard",
    sessionType: "Recovery — parasympathetic",
  };
}

function formatRecentDate(dateIso: string): string {
  if (dateIso === TODAY_ISO) return "Today";
  if (dateIso === YESTERDAY_ISO) return "Yesterday";
  const date = new Date(`${dateIso}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RecoverySelfLogForm({ memberName }: Props) {
  const router = useRouter();
  const [currentModality, setCurrentModality] = useState<ModalityKey | null>(null);
  const [forms, setForms] = useState<Record<ModalityKey, FormState>>({
    cold: defaultFormState(),
    sauna: defaultFormState(),
    compression: defaultFormState(),
    nxpro: defaultFormState(),
  });
  const [counts, setCounts] = useState<Record<ModalityKey, number>>(INITIAL_COUNTS);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(INITIAL_HISTORY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ modality: ModalityKey; duration: string } | null>(
    null,
  );

  const setFormValue = <K extends keyof FormState>(
    modality: ModalityKey,
    key: K,
    value: FormState[K],
  ) => {
    setForms((prev) => ({
      ...prev,
      [modality]: {
        ...prev[modality],
        [key]: value,
      },
    }));
  };

  const toggleQuickNote = (modality: ModalityKey, note: string) => {
    const current = forms[modality].quickNotes;
    const exists = current.includes(note);
    const next = exists ? current.filter((item) => item !== note) : [...current, note];
    setFormValue(modality, "quickNotes", next);
  };

  const setDurationPreset = (modality: ModalityKey, duration: number) => {
    setFormValue(modality, "duration", String(duration));
  };

  const setDateShortcut = (modality: ModalityKey, shortcut: DateShortcut) => {
    setFormValue(modality, "dateShortcut", shortcut);
    if (shortcut === "today") {
      setFormValue(modality, "customDate", TODAY_ISO);
    } else if (shortcut === "yesterday") {
      setFormValue(modality, "customDate", YESTERDAY_ISO);
    }
  };

  const resolveDate = (form: FormState) => {
    if (form.dateShortcut === "today") return TODAY_ISO;
    if (form.dateShortcut === "yesterday") return YESTERDAY_ISO;
    return form.customDate || TODAY_ISO;
  };

  const renderForm = (modality: ModalityKey) => {
    const form = forms[modality];
    const meta = MODALITY_META[modality];
    const showTemp = modality === "cold" || modality === "sauna";
    const showPressure = modality === "compression";
    const showSessionType = modality === "nxpro";
    const selectedDuration = Number(form.duration);

    return (
      <div className={`form-card ${currentModality === modality ? "active" : ""}`}>
        <div className="form-card-header">
          <div className="form-card-icon" style={{ background: `var(--${meta.color}-dim)` }}>
            {meta.icon}
          </div>
          <div>
            <div className="form-card-title">{meta.name}</div>
            <div className="form-card-sub">{meta.desc}</div>
          </div>
        </div>
        <div className="form-card-body">
          <div className="field">
            <div className="field-label">Date</div>
            <div className="date-shortcuts">
              {(["today", "yesterday", "custom"] as DateShortcut[]).map((shortcut) => (
                <button
                  key={shortcut}
                  type="button"
                  className={`date-shortcut ${form.dateShortcut === shortcut ? "selected" : ""}`}
                  onClick={() => setDateShortcut(modality, shortcut)}
                >
                  {shortcut === "today"
                    ? "Today"
                    : shortcut === "yesterday"
                      ? "Yesterday"
                      : "Pick date"}
                </button>
              ))}
            </div>
            {form.dateShortcut === "custom" ? (
              <input
                type="date"
                className="field-input"
                value={form.customDate}
                onChange={(event) => setFormValue(modality, "customDate", event.target.value)}
              />
            ) : null}
          </div>

          {showSessionType ? (
            <div className="field">
              <div className="field-label">Session type</div>
              <select
                className="field-select"
                value={form.sessionType}
                onChange={(event) => setFormValue(modality, "sessionType", event.target.value)}
              >
                <option>Recovery — parasympathetic</option>
                <option>Performance — focus</option>
                <option>Sleep preparation</option>
                <option>Stress relief</option>
                <option>Custom protocol</option>
              </select>
            </div>
          ) : null}

          <div className="field">
            <div className="field-label">Duration</div>
            <div className="duration-wrap">
              <div className="duration-presets">
                {DURATION_PRESETS[modality].map((duration) => {
                  const isSelected = selectedDuration === duration;
                  return (
                    <button
                      key={`${modality}-dur-${duration}`}
                      type="button"
                      className={`duration-preset ${
                        isSelected ? `selected-${modality}` : ""
                      }`}
                      onClick={() => setDurationPreset(modality, duration)}
                    >
                      {duration} min
                    </button>
                  );
                })}
              </div>
              <div className="duration-custom">
                <input
                  type="number"
                  className="duration-input"
                  min={1}
                  max={90}
                  value={form.duration}
                  onChange={(event) => setFormValue(modality, "duration", event.target.value)}
                  placeholder={
                    modality === "cold" ? "3" : modality === "sauna" ? "30" : "20"
                  }
                />
                <span className="duration-unit">minutes</span>
              </div>
            </div>
          </div>

          {showTemp ? (
            <div className="field">
              <div className="field-label">
                {modality === "cold" ? "Water temperature (°F)" : "Temperature (°F)"}
              </div>
              <div className="temp-wrap">
                <div className="temp-presets">
                  {(modality === "cold"
                    ? [39, 45, 50, 55, 60]
                    : [120, 130, 140, 150]
                  ).map((temp) => (
                    <button
                      key={`${modality}-temp-${temp}`}
                      type="button"
                      className={`temp-preset ${
                        Number(form.temperature) === temp ? "selected" : ""
                      }`}
                      onClick={() => setFormValue(modality, "temperature", String(temp))}
                    >
                      {temp}°F
                    </button>
                  ))}
                </div>
                <div className="temp-row">
                  <input
                    type="number"
                    className="duration-input"
                    min={modality === "cold" ? 32 : 100}
                    max={modality === "cold" ? 70 : 180}
                    value={form.temperature}
                    onChange={(event) =>
                      setFormValue(modality, "temperature", event.target.value)
                    }
                    placeholder={modality === "cold" ? "50" : "140"}
                  />
                  <span className="duration-unit">°F</span>
                </div>
              </div>
            </div>
          ) : null}

          {showPressure ? (
            <div className="field">
              <div className="field-label">Pressure setting</div>
              <select
                className="field-select"
                value={form.pressure}
                onChange={(event) => setFormValue(modality, "pressure", event.target.value)}
              >
                <option>Low — recovery</option>
                <option>Medium — standard</option>
                <option>High — flush</option>
                <option>Custom</option>
              </select>
            </div>
          ) : null}

          <div className="field">
            <div className="field-label">How did you feel after?</div>
            <div className="feeling-grid">
              {FEELINGS[modality].map((feeling) => (
                <button
                  key={`${modality}-${feeling.label}`}
                  type="button"
                  className={`feeling-btn ${
                    form.feeling === feeling.label ? "selected" : ""
                  }`}
                  onClick={() => setFormValue(modality, "feeling", feeling.label)}
                >
                  <span className="feeling-emoji">{feeling.emoji}</span>
                  <div className="feeling-label">{feeling.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field-label">Quick notes</div>
            <div className="quick-notes">
              {QUICK_NOTES[modality].map((note) => (
                <button
                  key={`${modality}-qn-${note}`}
                  type="button"
                  className={`qn ${form.quickNotes.includes(note) ? "selected" : ""}`}
                  onClick={() => toggleQuickNote(modality, note)}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field-label">Additional notes</div>
            <textarea
              className="notes-textarea"
              value={form.notes}
              onChange={(event) => setFormValue(modality, "notes", event.target.value)}
              placeholder="Anything else worth logging…"
            />
          </div>
        </div>
      </div>
    );
  };

  const submitSession = async () => {
    if (!currentModality) return;
    const form = forms[currentModality];
    const meta = MODALITY_META[currentModality];
    const duration = Number(form.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Please enter a valid duration in minutes.");
      return;
    }
    const sessionDate = resolveDate(form);
    if (!sessionDate) {
      setError("Please select a valid session date.");
      return;
    }

    const notesParts = [
      currentModality === "compression" ? `Pressure: ${form.pressure}` : "",
      currentModality === "nxpro" ? `Session type: ${form.sessionType}` : "",
      form.feeling ? `Feeling: ${form.feeling}` : "",
      form.quickNotes.length ? `Quick notes: ${form.quickNotes.join(", ")}` : "",
      form.notes.trim(),
    ].filter((value) => value.length > 0);
    const notesPayload = notesParts.join(" | ");

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/recovery/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modality: meta.dbKey,
          duration_minutes: Math.round(duration),
          temperature_f:
            currentModality === "cold" || currentModality === "sauna"
              ? form.temperature
              : "",
          notes: notesPayload,
          session_date: sessionDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Could not save recovery session.");
      }

      const nextCount = (counts[currentModality] ?? 0) + 1;
      setCounts((prev) => ({ ...prev, [currentModality]: nextCount }));
      const detailParts = [
        `${Math.round(duration)} min`,
        (currentModality === "cold" || currentModality === "sauna") && form.temperature
          ? `${form.temperature}°F`
          : "",
        currentModality === "compression" ? form.pressure : "",
        currentModality === "nxpro" ? form.sessionType : "",
        form.feeling ? `Felt ${form.feeling.toLowerCase()}` : "",
      ].filter(Boolean);

      setHistoryItems((prev) => [
        {
          modality: currentModality,
          detail: detailParts.join(" · "),
          dateLabel: formatRecentDate(sessionDate),
        },
        ...prev,
      ]);
      setLastSaved({ modality: currentModality, duration: String(Math.round(duration)) });
      setSuccessOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log recovery session.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const resetSelection = () => {
    setCurrentModality(null);
    setSuccessOpen(false);
    setError("");
  };

  const submitLabel = currentModality
    ? `Log ${MODALITY_META[currentModality].name} →`
    : "Select a modality to log";

  const successText = lastSaved
    ? `🔥 ${counts[lastSaved.modality]} ${MODALITY_META[lastSaved.modality].name.toLowerCase()} sessions this month`
    : "🔥 Recovery data synced";

  return (
    <main className="recovery-page">
      <div className="topbar">
        <div className="topbar-logo">
          Iso<em>.</em>
        </div>
        <div className="topbar-title">Log Recovery</div>
        <button className="btn-back" type="button" onClick={() => router.push("/dashboard")}>
          ← Dashboard
        </button>
      </div>

      <div className="main">
        <div className="page-eyebrow">Recovery tracking</div>
        <h1 className="page-title">
          Log a recovery
          <br />
          session
        </h1>
        <p className="page-sub">
          Track your recovery modalities, {memberName}. Dustin reviews this data alongside your
          training — consistency here directly impacts your Recovery score.
        </p>

        <div className="streak-card anim">
          <div className="streak-header">
            <div>
              <div className="streak-title">This month · March 2026</div>
              <div className="streak-sub">Goal: 2x per week each modality</div>
            </div>
            <span className="recovery-pill">Recovery 82</span>
          </div>
          <div className="streak-grid">
            <div className="streak-item">
              <span className="streak-icon">🧊</span>
              <div className="streak-count blue">{counts.cold}</div>
              <div className="streak-label">Cold plunge</div>
              <div className="streak-goal amber">Goal: 8</div>
            </div>
            <div className="streak-item">
              <span className="streak-icon">🌡️</span>
              <div className="streak-count amber">{counts.sauna}</div>
              <div className="streak-label">IR Sauna</div>
              <div className="streak-goal lime">Goal: 8 ✓</div>
            </div>
            <div className="streak-item">
              <span className="streak-icon">🦵</span>
              <div className="streak-count purple">{counts.compression}</div>
              <div className="streak-label">Compression</div>
              <div className="streak-goal amber">Goal: 6</div>
            </div>
            <div className="streak-item">
              <span className="streak-icon">🧠</span>
              <div className="streak-count teal">{counts.nxpro}</div>
              <div className="streak-label">NxPro</div>
              <div className="streak-goal coral">Goal: 6</div>
            </div>
          </div>
        </div>

        <div className="label-line">Select modality</div>
        <div className="modality-grid anim">
          {(Object.keys(MODALITY_META) as ModalityKey[]).map((key) => {
            const meta = MODALITY_META[key];
            const selected = currentModality === key;
            return (
              <button
                key={key}
                type="button"
                className={`modality-btn ${key} ${selected ? "selected" : ""}`}
                onClick={() => {
                  setCurrentModality(key);
                  setError("");
                }}
              >
                <div className="modality-check">✓</div>
                <span className="modality-icon">{meta.icon}</span>
                <div className="modality-name">{meta.name}</div>
                <div className="modality-desc">{meta.desc}</div>
              </button>
            );
          })}
        </div>

        {currentModality ? renderForm(currentModality) : null}

        <div className="history-section anim" id="history-section">
          <div className="history-title">Recent sessions</div>
          <div className="history-list">
            {historyItems.slice(0, 8).map((item, index) => {
              const meta = MODALITY_META[item.modality];
              return (
                <div key={`${item.modality}-${index}`} className="history-item">
                  <div className={`history-dot ${meta.color}`} />
                  <div className="history-modality">{meta.name}</div>
                  <div className="history-detail">{item.detail}</div>
                  <div className="history-date">{item.dateLabel}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="submit-area">
          <button
            className={`btn-submit ${currentModality ? MODALITY_META[currentModality].color : ""}`}
            type="button"
            disabled={!currentModality || saving}
            onClick={submitSession}
          >
            {saving ? "Saving..." : submitLabel}
          </button>
          {error ? <div className="error-text">{error}</div> : null}
        </div>
      </div>

      <div className={`success-overlay ${successOpen ? "show" : ""}`}>
        <div className="success-card">
          <div
            className={`success-check ${
              lastSaved ? MODALITY_META[lastSaved.modality].color : "teal"
            }`}
          >
            ✓
          </div>
          <div className="success-title">Logged!</div>
          <div className="success-sub">
            Your session has been saved. Dustin can see this in your recovery data.
          </div>
          <div className="success-stats">
            <div className="success-stat">
              <div className="success-stat-val success-modality">
                {lastSaved ? MODALITY_META[lastSaved.modality].name : "Recovery"}
              </div>
              <div className="success-stat-label">Modality</div>
            </div>
            <div className="success-stat">
              <div className="success-stat-val">{lastSaved?.duration ?? "--"}</div>
              <div className="success-stat-label">Minutes</div>
            </div>
          </div>
          <div className="success-streak">{successText}</div>
          <button className="btn-success-primary" type="button" onClick={resetSelection}>
            Log another session
          </button>
          <button
            className="btn-success-ghost"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            Back to dashboard
          </button>
        </div>
      </div>

      <style jsx>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .recovery-page {
          --bg: #0b0c09;
          --bg2: #111209;
          --bg3: #181910;
          --bg4: #1f2014;
          --border: rgba(255, 255, 255, 0.08);
          --border2: rgba(255, 255, 255, 0.14);
          --text: #edeae0;
          --text2: #9b9889;
          --text3: #585750;
          --lime: #c9f055;
          --teal: #55e8c8;
          --blue: #55b8f0;
          --amber: #f0b955;
          --coral: #f07055;
          --purple: #a855f0;
          --blue-dim: rgba(85, 184, 240, 0.12);
          --amber-dim: rgba(240, 185, 85, 0.12);
          --coral-dim: rgba(240, 112, 85, 0.12);
          --teal-dim: rgba(85, 232, 200, 0.12);
          --purple-dim: rgba(168, 85, 240, 0.12);
          --lime-dim: rgba(201, 240, 85, 0.12);
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--bg2);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .topbar-logo {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 20px;
        }
        .topbar-logo em {
          color: #c9f055;
          font-style: normal;
        }
        .topbar-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text2);
        }
        .btn-back {
          padding: 7px 12px;
          border-radius: 7px;
          border: 1px solid var(--border2);
          background: transparent;
          color: var(--text3);
          font-size: 12px;
          cursor: pointer;
        }
        .main {
          max-width: 540px;
          margin: 0 auto;
          padding: 24px 20px 60px;
        }
        .page-eyebrow {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--teal);
          margin-bottom: 8px;
        }
        .page-title {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 28px;
          margin-bottom: 6px;
          line-height: 1.2;
        }
        .page-sub {
          font-size: 14px;
          color: var(--text2);
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .streak-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 16px;
        }
        .streak-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .streak-title {
          font-size: 12px;
          font-weight: 500;
        }
        .streak-sub {
          font-size: 11px;
          color: var(--text3);
          margin-top: 1px;
        }
        .recovery-pill {
          font-size: 11px;
          color: var(--teal);
          padding: 3px 8px;
          border-radius: 20px;
          background: var(--teal-dim);
          border: 1px solid rgba(85, 232, 200, 0.2);
        }
        .streak-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .streak-item {
          text-align: center;
          padding: 10px 8px;
          border-radius: 10px;
          background: var(--bg3);
          border: 1px solid var(--border);
        }
        .streak-icon {
          font-size: 18px;
          margin-bottom: 4px;
          display: block;
        }
        .streak-count {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 20px;
          line-height: 1;
          margin-bottom: 2px;
        }
        .streak-count.blue {
          color: var(--blue);
        }
        .streak-count.amber {
          color: var(--amber);
        }
        .streak-count.purple {
          color: var(--purple);
        }
        .streak-count.teal {
          color: var(--teal);
        }
        .streak-label {
          font-size: 9.5px;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .streak-goal {
          font-size: 10px;
          margin-top: 3px;
        }
        .streak-goal.lime {
          color: var(--lime);
        }
        .streak-goal.amber {
          color: var(--amber);
        }
        .streak-goal.coral {
          color: var(--coral);
        }
        .label-line {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 10px;
        }
        .modality-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
        }
        .modality-btn {
          padding: 18px 14px;
          border-radius: 14px;
          border: 1.5px solid var(--border);
          background: var(--bg2);
          cursor: pointer;
          text-align: left;
          position: relative;
          color: var(--text);
        }
        .modality-btn.selected {
          border-width: 2px;
        }
        .modality-btn.cold.selected {
          border-color: var(--blue);
          background: var(--blue-dim);
        }
        .modality-btn.sauna.selected {
          border-color: var(--amber);
          background: var(--amber-dim);
        }
        .modality-btn.compression.selected {
          border-color: var(--purple);
          background: var(--purple-dim);
        }
        .modality-btn.nxpro.selected {
          border-color: var(--teal);
          background: var(--teal-dim);
        }
        .modality-check {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          opacity: 0;
        }
        .modality-btn.selected .modality-check {
          opacity: 1;
          background: var(--text);
          color: var(--bg);
        }
        .modality-icon {
          font-size: 28px;
          margin-bottom: 10px;
          display: block;
        }
        .modality-name {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 3px;
        }
        .modality-desc {
          font-size: 11px;
          color: var(--text3);
          line-height: 1.4;
        }
        .form-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .form-card.active {
          border-color: var(--border2);
        }
        .form-card-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .form-card-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .form-card-title {
          font-size: 13.5px;
          font-weight: 500;
        }
        .form-card-sub {
          font-size: 11px;
          color: var(--text3);
          margin-top: 1px;
        }
        .form-card-body {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .field-label {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text3);
        }
        .field-input,
        .field-select {
          background: var(--bg3);
          border: 1.5px solid var(--border2);
          border-radius: 8px;
          padding: 12px 14px;
          color: var(--text);
          font-size: 15px;
          outline: none;
          width: 100%;
        }
        .duration-wrap,
        .temp-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .duration-presets,
        .temp-presets {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .duration-preset,
        .temp-preset {
          padding: 8px 14px;
          border-radius: 20px;
          border: 1.5px solid var(--border2);
          background: var(--bg3);
          font-size: 13px;
          color: var(--text3);
          cursor: pointer;
        }
        .duration-preset.selected-cold {
          border-color: var(--blue);
          background: var(--blue-dim);
          color: var(--blue);
        }
        .duration-preset.selected-sauna {
          border-color: var(--amber);
          background: var(--amber-dim);
          color: var(--amber);
        }
        .duration-preset.selected-compression {
          border-color: var(--purple);
          background: var(--purple-dim);
          color: var(--purple);
        }
        .duration-preset.selected-nxpro {
          border-color: var(--teal);
          background: var(--teal-dim);
          color: var(--teal);
        }
        .temp-preset.selected {
          border-color: var(--blue);
          background: var(--blue-dim);
          color: var(--blue);
        }
        .duration-custom,
        .temp-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .duration-input {
          width: 80px;
          background: var(--bg3);
          border: 1.5px solid var(--border2);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text);
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 20px;
          outline: none;
          text-align: center;
        }
        .duration-unit {
          font-size: 13px;
          color: var(--text3);
        }
        .feeling-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }
        .feeling-btn {
          padding: 12px 6px;
          border-radius: 10px;
          border: 1.5px solid var(--border);
          background: var(--bg3);
          cursor: pointer;
          text-align: center;
        }
        .feeling-btn.selected {
          border-color: var(--lime);
          background: var(--lime-dim);
        }
        .feeling-emoji {
          font-size: 22px;
          display: block;
          margin-bottom: 4px;
        }
        .feeling-label {
          font-size: 10px;
          color: var(--text3);
        }
        .feeling-btn.selected .feeling-label {
          color: var(--lime);
        }
        .date-shortcuts {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .date-shortcut {
          padding: 7px 12px;
          border-radius: 20px;
          border: 1.5px solid var(--border2);
          background: var(--bg3);
          font-size: 12px;
          color: var(--text3);
          cursor: pointer;
        }
        .date-shortcut.selected {
          border-color: var(--teal);
          background: var(--teal-dim);
          color: var(--teal);
        }
        .quick-notes {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .qn {
          padding: 7px 12px;
          border-radius: 20px;
          border: 1px solid var(--border2);
          background: var(--bg3);
          font-size: 12px;
          color: var(--text3);
          cursor: pointer;
        }
        .qn.selected {
          background: var(--bg4);
          color: var(--text2);
          border-color: var(--border2);
        }
        .notes-textarea {
          width: 100%;
          background: var(--bg3);
          border: 1.5px solid var(--border2);
          border-radius: 8px;
          padding: 12px 14px;
          color: var(--text);
          font-size: 14px;
          outline: none;
          resize: none;
          height: 70px;
        }
        .history-section {
          margin-bottom: 24px;
        }
        .history-title {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 10px;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .history-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 10px;
          background: var(--bg2);
          border: 1px solid var(--border);
        }
        .history-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .history-dot.blue {
          background: var(--blue);
        }
        .history-dot.amber {
          background: var(--amber);
        }
        .history-dot.purple {
          background: var(--purple);
        }
        .history-dot.teal {
          background: var(--teal);
        }
        .history-modality {
          font-size: 13px;
          font-weight: 500;
          flex: 1;
        }
        .history-detail {
          font-size: 12px;
          color: var(--text3);
        }
        .history-date {
          font-size: 11px;
          color: var(--text3);
          margin-left: auto;
          white-space: nowrap;
        }
        .submit-area {
          position: sticky;
          bottom: 0;
          background: var(--bg);
          border-top: 1px solid var(--border);
          padding: 14px 20px;
          margin: 0 -20px;
        }
        .btn-submit {
          width: 100%;
          padding: 15px;
          border-radius: 10px;
          background: var(--teal);
          color: var(--bg);
          border: none;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-submit.blue {
          background: var(--blue);
        }
        .btn-submit.amber {
          background: var(--amber);
        }
        .btn-submit.purple {
          background: var(--purple);
        }
        .btn-submit.teal {
          background: var(--teal);
        }
        .btn-submit:disabled {
          opacity: 0.4;
          pointer-events: none;
        }
        .error-text {
          margin-top: 10px;
          font-size: 12px;
          color: var(--coral);
        }
        .success-overlay {
          position: fixed;
          inset: 0;
          background: rgba(11, 12, 9, 0.88);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
          padding: 20px;
        }
        .success-overlay.show {
          opacity: 1;
          pointer-events: all;
        }
        .success-card {
          background: var(--bg2);
          border: 1px solid var(--border2);
          border-radius: 18px;
          padding: 36px 28px;
          text-align: center;
          max-width: 360px;
          width: 100%;
        }
        .success-check {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 30px;
          background: var(--teal-dim);
          border: 2px solid var(--teal);
        }
        .success-check.blue {
          background: var(--blue-dim);
          border-color: var(--blue);
        }
        .success-check.amber {
          background: var(--amber-dim);
          border-color: var(--amber);
        }
        .success-check.purple {
          background: var(--purple-dim);
          border-color: var(--purple);
        }
        .success-check.teal {
          background: var(--teal-dim);
          border-color: var(--teal);
        }
        .success-title {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 26px;
          margin-bottom: 8px;
        }
        .success-sub {
          font-size: 13.5px;
          color: var(--text2);
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .success-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 20px;
        }
        .success-stat {
          padding: 12px;
          border-radius: 10px;
          background: var(--bg3);
          border: 1px solid var(--border);
        }
        .success-stat-val {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 22px;
          margin-bottom: 2px;
        }
        .success-modality {
          font-size: 16px;
        }
        .success-stat-label {
          font-size: 10px;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .success-streak {
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--lime-dim);
          border: 1px solid rgba(201, 240, 85, 0.2);
          margin-bottom: 16px;
          font-size: 13px;
          color: var(--lime);
        }
        .btn-success-primary {
          width: 100%;
          padding: 13px;
          background: var(--teal);
          color: var(--bg);
          border: none;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 8px;
        }
        .btn-success-ghost {
          width: 100%;
          padding: 11px;
          background: transparent;
          color: var(--text3);
          border: 1px solid var(--border2);
          border-radius: 9px;
          font-size: 13px;
          cursor: pointer;
        }
        .anim {
          animation: fadeUp 0.3s ease both;
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
