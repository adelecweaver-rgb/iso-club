"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Screen = "home" | "upload" | "analyzing" | "review";
type SourceKey =
  | "whoop"
  | "oura"
  | "garmin"
  | "apple_health"
  | "carol"
  | "arx"
  | "fitbit"
  | "other_wearable";

type SourceField = {
  key: string;
  label: string;
  highlight?: boolean;
  flagged?: boolean;
};

type SourceConfig = {
  key: SourceKey;
  name: string;
  icon: string;
  cardClass: string;
  section: "wearable" | "machine";
  sourceFields: string;
  uploadSub: string;
  tips: string[];
  confidence: number;
  equipmentForApi: string;
  fields: SourceField[];
  demoExtraction: Record<string, unknown>;
  summary: Array<{ val: string; label: string; color?: string }>;
  context: Array<{ label: string; val: string; change?: string; up?: boolean }>;
};

const SOURCES: SourceConfig[] = [
  {
    key: "whoop",
    name: "Whoop",
    icon: "⌚",
    cardClass: "whoop",
    section: "wearable",
    sourceFields: "Recovery · HRV · Sleep · Strain · SpO2",
    uploadSub:
      "Take a screenshot of your Whoop app showing today's recovery screen and upload it here.",
    tips: [
      "Open your Whoop app and go to the Recovery tab",
      "Make sure today's recovery score, HRV, and sleep are visible",
      "Take a screenshot (Side button + Volume Up on iPhone)",
      "Upload from your Photos library below",
    ],
    confidence: 97,
    equipmentForApi: "whoop",
    fields: [
      { key: "recovery_score", label: "Recovery score", highlight: true },
      { key: "hrv_ms", label: "HRV (ms)", highlight: true },
      { key: "resting_hr", label: "Resting heart rate" },
      { key: "sleep_score", label: "Sleep score" },
      { key: "sleep_duration_hrs", label: "Sleep duration (hrs)" },
      { key: "strain_score", label: "Strain score" },
      { key: "spo2_pct", label: "SpO2 (%)" },
    ],
    demoExtraction: {
      recovery_score: 74,
      hrv_ms: 68.4,
      resting_hr: 52,
      sleep_score: 81,
      sleep_duration_hrs: 7.4,
      strain_score: 14.2,
      spo2_pct: 96,
    },
    summary: [
      { val: "74", label: "Recovery", color: "var(--lime)" },
      { val: "68ms", label: "HRV" },
      { val: "7.4h", label: "Sleep" },
    ],
    context: [
      { label: "Recovery vs yesterday", val: "74", change: "+12", up: true },
      { label: "HRV vs 30-day avg", val: "68ms", change: "at baseline", up: true },
      { label: "Sleep vs goal", val: "7.4h", change: "above 7h goal", up: true },
    ],
  },
  {
    key: "oura",
    name: "Oura Ring",
    icon: "💍",
    cardClass: "oura",
    section: "wearable",
    sourceFields: "Readiness · Sleep · HRV · Body temp",
    uploadSub: "Screenshot your Oura app showing today's readiness or sleep screen.",
    tips: [
      "Open your Oura app",
      "Go to Today or the Readiness tab",
      "Make sure the readiness score and sleep data are visible",
      "Screenshot and upload below",
    ],
    confidence: 94,
    equipmentForApi: "oura",
    fields: [
      { key: "readiness_score", label: "Readiness score", highlight: true },
      { key: "sleep_score", label: "Sleep score" },
      { key: "hrv_ms", label: "HRV (ms)", highlight: true },
      { key: "body_temp_deviation", label: "Body temp deviation" },
      { key: "deep_sleep_hrs", label: "Deep sleep (hrs)" },
      { key: "rem_sleep_hrs", label: "REM sleep (hrs)" },
      { key: "spo2_pct", label: "SpO2 (%)" },
    ],
    demoExtraction: {
      readiness_score: 81,
      sleep_score: 79,
      hrv_ms: 65.2,
      body_temp_deviation: "+0.2°F",
      deep_sleep_hrs: 2.1,
      rem_sleep_hrs: 1.8,
      spo2_pct: 97,
    },
    summary: [
      { val: "81", label: "Readiness", color: "var(--blue)" },
      { val: "79", label: "Sleep" },
      { val: "65ms", label: "HRV" },
    ],
    context: [
      { label: "Readiness vs yesterday", val: "81", change: "+8", up: true },
      { label: "Deep sleep vs avg", val: "2.1h", change: "+0.4h", up: true },
      { label: "HRV trend", val: "65ms", change: "improving", up: true },
    ],
  },
  {
    key: "garmin",
    name: "Garmin",
    icon: "⌚",
    cardClass: "garmin",
    section: "wearable",
    sourceFields: "HRV status · VO₂ · Sleep · Recovery",
    uploadSub: "Screenshot your Garmin Connect app showing today's health stats.",
    tips: [
      "Open Garmin Connect app",
      "Go to your daily health stats or HRV status",
      "Screenshot and upload below",
    ],
    confidence: 91,
    equipmentForApi: "garmin",
    fields: [
      { key: "readiness_score", label: "Readiness score", highlight: true },
      { key: "recovery_score", label: "Recovery score" },
      { key: "hrv_ms", label: "HRV (ms)" },
      { key: "resting_hr", label: "Resting heart rate" },
      { key: "sleep_score", label: "Sleep score" },
      { key: "sleep_duration_hrs", label: "Sleep duration (hrs)" },
      { key: "device_name", label: "Device" },
    ],
    demoExtraction: {
      readiness_score: 72,
      recovery_score: 68,
      hrv_ms: 54,
      resting_hr: 54,
      sleep_score: 77,
      sleep_duration_hrs: 7.1,
      device_name: "Garmin",
    },
    summary: [
      { val: "72", label: "Readiness", color: "var(--teal)" },
      { val: "54", label: "Resting HR" },
      { val: "77", label: "Sleep" },
    ],
    context: [
      { label: "Readiness vs yesterday", val: "72", change: "+12", up: true },
      { label: "Sleep score trend", val: "77", change: "improving", up: true },
    ],
  },
  {
    key: "apple_health",
    name: "Apple Health",
    icon: "🍎",
    cardClass: "apple",
    section: "wearable",
    sourceFields: "Heart rate · Sleep · Activity · HRV",
    uploadSub: "Screenshot your Apple Health summary showing heart rate, sleep, or HRV data.",
    tips: [
      "Open the Health app on your iPhone",
      "Go to Summary or the specific metric you want to log",
      "Screenshot and upload below",
    ],
    confidence: 88,
    equipmentForApi: "apple_health",
    fields: [
      { key: "resting_hr", label: "Resting heart rate", highlight: true },
      { key: "hrv_ms", label: "HRV (ms)" },
      { key: "sleep_duration_hrs", label: "Sleep duration (hrs)" },
      { key: "spo2_pct", label: "SpO2 (%)" },
      { key: "device_name", label: "Device" },
    ],
    demoExtraction: {
      resting_hr: 52,
      hrv_ms: 65,
      sleep_duration_hrs: 7.2,
      spo2_pct: 96,
      device_name: "Apple Health",
    },
    summary: [
      { val: "52", label: "Resting HR" },
      { val: "65ms", label: "HRV" },
      { val: "7.2h", label: "Sleep" },
    ],
    context: [{ label: "Resting HR vs 30-day avg", val: "52", change: "-2 bpm", up: true }],
  },
  {
    key: "carol",
    name: "CAROL ride",
    icon: "🚲",
    cardClass: "carol",
    section: "machine",
    sourceFields: "Fitness score · Peak power · Max HR",
    uploadSub: "Photo the CAROL screen after your ride showing the results summary.",
    tips: [
      "After your CAROL session the results screen appears automatically",
      "Make sure fitness score, peak power, and max HR are visible",
      "Photo the screen or upload a screenshot from the CAROL app",
      "Make sure the screen is well-lit and not glared",
    ],
    confidence: 96,
    equipmentForApi: "carol",
    fields: [
      { key: "ride_type", label: "Ride type" },
      { key: "fitness_score", label: "Fitness score", highlight: true },
      { key: "peak_power", label: "Peak power (W)", highlight: true },
      { key: "calories", label: "Calories" },
      { key: "energy", label: "Energy (joules)" },
      { key: "max_hr", label: "Max HR (bpm)" },
      { key: "resistance_direction", label: "Resistance direction" },
    ],
    demoExtraction: {
      ride_type: "REHIT",
      fitness_score: 36.5,
      peak_power: 1024,
      calories: 162,
      energy: 30558,
      max_hr: 138,
      resistance_direction: "Up",
    },
    summary: [
      { val: "36.5", label: "Fitness score", color: "var(--blue)" },
      { val: "1,024W", label: "Peak power" },
      { val: "138", label: "Max HR" },
    ],
    context: [
      { label: "Fitness score vs baseline", val: "36.5", change: "+0.1", up: true },
      { label: "Peak power vs last session", val: "1,024W", change: "+25W", up: true },
      { label: "Ride number", val: "#130" },
    ],
  },
  {
    key: "arx",
    name: "ARX session",
    icon: "🏋️",
    cardClass: "arx",
    section: "machine",
    sourceFields: "Output · Concentric · Eccentric max",
    uploadSub: "Photo the ARX screen after your set showing the output summary.",
    tips: [
      "After each ARX set the output screen appears",
      "Make sure concentric max, eccentric max, and output are visible",
      "Hold your phone parallel to the screen to avoid distortion",
      "Upload one photo per exercise for best accuracy",
    ],
    confidence: 95,
    equipmentForApi: "arx",
    fields: [
      { key: "exercise", label: "Exercise" },
      { key: "concentric_max", label: "Concentric max", highlight: true },
      { key: "eccentric_max", label: "Eccentric max" },
      { key: "output", label: "Output", highlight: true },
      { key: "intensity", label: "Intensity" },
      { key: "protocol", label: "Protocol" },
      { key: "time_seconds", label: "Time (seconds)" },
    ],
    demoExtraction: {
      exercise: "Leg Press",
      concentric_max: 699,
      eccentric_max: 0,
      output: 5000,
      intensity: 563,
      protocol: "Time Trial (5000)",
      time_seconds: 88,
    },
    summary: [
      { val: "699", label: "Concentric max", color: "var(--amber)" },
      { val: "5000", label: "Output" },
      { val: "1:28", label: "Time" },
    ],
    context: [
      { label: "Concentric max vs last session", val: "699", change: "+14", up: true },
      { label: "vs personal best", val: "699", change: "new PB!", up: true },
      { label: "Protocol", val: "Time Trial" },
    ],
  },
  {
    key: "fitbit",
    name: "Fitbit",
    icon: "📊",
    cardClass: "fitbit",
    section: "machine",
    sourceFields: "Sleep · Heart rate · Steps · HRV",
    uploadSub: "Screenshot your Fitbit app showing sleep or heart rate data.",
    tips: ["Open the Fitbit app", "Go to Today or Sleep", "Take a screenshot and upload below"],
    confidence: 89,
    equipmentForApi: "fitbit",
    fields: [
      { key: "sleep_score", label: "Sleep score", highlight: true },
      { key: "resting_hr", label: "Resting heart rate" },
      { key: "deep_sleep_hrs", label: "Deep sleep (hrs)" },
      { key: "hrv_ms", label: "HRV (ms)" },
      { key: "device_name", label: "Device" },
    ],
    demoExtraction: {
      sleep_score: 82,
      resting_hr: 54,
      deep_sleep_hrs: 1.6,
      hrv_ms: 42,
      device_name: "Fitbit",
    },
    summary: [
      { val: "82", label: "Sleep score", color: "var(--lime)" },
      { val: "54", label: "Resting HR" },
      { val: "1.6h", label: "Deep sleep" },
    ],
    context: [],
  },
  {
    key: "other_wearable",
    name: "Other",
    icon: "📱",
    cardClass: "other",
    section: "machine",
    sourceFields: "Any health app screenshot",
    uploadSub:
      "Upload any health app screenshot. Claude will identify the app and extract visible data.",
    tips: [
      "Screenshot any health metric you want to track",
      "Make sure numbers are clearly visible",
      "Claude identifies the app automatically",
      "You can edit any extracted value before save",
    ],
    confidence: 85,
    equipmentForApi: "other_wearable",
    fields: [
      { key: "device_name", label: "Detected app", flagged: true },
      { key: "recovery_score", label: "Primary metric", flagged: true },
    ],
    demoExtraction: {
      device_name: "Unknown — review",
      recovery_score: null,
    },
    summary: [
      { val: "—", label: "Review needed" },
      { val: "—", label: "Metric 2" },
      { val: "—", label: "Metric 3" },
    ],
    context: [],
  },
];

const ANALYSIS_STEPS = [
  "Screenshot received",
  "Identifying app and layout",
  "Extracting health metrics",
  "Matching to your profile",
  "Ready to review",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function MemberUploadDataForm({ memberName }: { memberName: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSourceKey, setSelectedSourceKey] = useState<SourceKey | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [analysisStep, setAnalysisStep] = useState(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<Record<string, boolean>>({});
  const [rawExtraction, setRawExtraction] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const selectedSource = useMemo(
    () => SOURCES.find((source) => source.key === selectedSourceKey) ?? null,
    [selectedSourceKey],
  );

  const wearables = SOURCES.filter((source) => source.section === "wearable");
  const machines = SOURCES.filter((source) => source.section === "machine");

  const reviewFields = useMemo<SourceField[]>(() => {
    if (!selectedSource) return [];
    const known = new Set<string>();
    const base = selectedSource.fields.map((field) => {
      known.add(field.key);
      return field;
    });
    const extra: SourceField[] = Object.keys(rawExtraction)
      .filter((key) => !known.has(key))
      .map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      }));
    return [...base, ...extra];
  }, [selectedSource, rawExtraction]);

  const confidence = selectedSource?.confidence ?? 90;

  const resetUploadState = () => {
    setUploadFile(null);
    setPreviewUrl("");
    setFieldValues({});
    setEditingField({});
    setRawExtraction({});
    setNotes("");
    setStatus("");
    setError("");
    setAnalysisStep(1);
  };

  const toDisplayString = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "--";
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return String(value);
  };

  const hydrateReview = (extracted: Record<string, unknown>, source: SourceConfig) => {
    const nextValues: Record<string, string> = {};
    source.fields.forEach((field) => {
      nextValues[field.key] = toDisplayString(extracted[field.key]);
    });
    Object.keys(extracted).forEach((key) => {
      if (!(key in nextValues)) {
        nextValues[key] = toDisplayString(extracted[key]);
      }
    });
    setRawExtraction(extracted);
    setFieldValues(nextValues);
    setEditingField({});
  };

  const runExtraction = async (useDemo: boolean) => {
    if (!selectedSource) return;
    setError("");
    setStatus("");
    setScreen("analyzing");
    setAnalysisStep(1);

    const extractionPromise = useDemo
      ? Promise.resolve(selectedSource.demoExtraction)
      : (async () => {
          if (!uploadFile) throw new Error("Choose a screenshot first.");
          const formData = new FormData();
          formData.append("equipment", selectedSource.equipmentForApi);
          formData.append("image", uploadFile);
          const response = await fetch("/api/ai/extract-machine-data", {
            method: "POST",
            body: formData,
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.success === false) {
            throw new Error(payload.error || "Unable to read screenshot.");
          }
          return (payload.extracted ?? {}) as Record<string, unknown>;
        })();

    try {
      for (let step = 2; step <= ANALYSIS_STEPS.length; step += 1) {
        await sleep(520);
        setAnalysisStep(step);
      }
      const extracted = await extractionPromise;
      hydrateReview(extracted, selectedSource);
      setScreen("review");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed.";
      setError(message);
      setScreen("upload");
    }
  };

  const onUploadFile = (file: File | null) => {
    if (!file) return;
    setUploadFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    runExtraction(false).catch(() => undefined);
  };

  const saveData = async () => {
    if (!selectedSource) return;
    setSaving(true);
    setError("");
    setStatus("Saving to your profile…");
    try {
      const merged: Record<string, unknown> = { ...rawExtraction };
      reviewFields.forEach((field) => {
        const currentInput = fieldValues[field.key];
        const original = rawExtraction[field.key];
        if (typeof original === "number") {
          const parsed = Number(String(currentInput).replace(/[^\d.-]/g, ""));
          merged[field.key] = Number.isFinite(parsed) ? parsed : original;
        } else if (currentInput === "--") {
          merged[field.key] = null;
        } else {
          merged[field.key] = currentInput;
        }
      });

      const response = await fetch("/api/member/upload-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment: selectedSource.equipmentForApi,
          extraction_data: merged,
          notes,
          session_date: new Date().toISOString().slice(0, 10),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Failed to save upload.");
      }
      setStatus("Saved successfully.");
      setSuccessOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save.";
      setError(message);
      setStatus("");
    } finally {
      setSaving(false);
    }
  };

  const toggleEditField = (fieldKey: string) => {
    setEditingField((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const uploadAnother = () => {
    setSuccessOpen(false);
    setSelectedSourceKey(null);
    resetUploadState();
    setScreen("home");
  };

  const sourceSummary = selectedSource?.summary ?? [];
  const sourceContext = selectedSource?.context ?? [];

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <main className="upload-page">
      <div className="topbar">
        <div className="topbar-logo">
          Iso<em>.</em>
        </div>
        <div className="topbar-title">Upload my data</div>
        <button className="btn-back" type="button" onClick={() => router.push("/dashboard")}>
          ← Dashboard
        </button>
      </div>

      <div className={`screen ${screen === "home" ? "active" : ""}`}>
        <div className="eyebrow">Data upload</div>
        <h1 className="page-title">
          Add your own
          <br />
          health data
        </h1>
        <p className="page-sub">
          Upload screenshots from your wearables or photos of machine screens. Claude reads them
          automatically and adds the data to your Healthspan OS profile for {memberName}.
        </p>

        <div className="source-section">
          <div className="source-section-label">Wearable apps</div>
          <div className="source-grid">
            {wearables.map((source) => {
              const selected = selectedSourceKey === source.key;
              return (
                <button
                  key={source.key}
                  type="button"
                  className={`source-card ${source.cardClass} ${selected ? "selected" : ""}`}
                  onClick={() => setSelectedSourceKey(source.key)}
                >
                  <div className="source-check">✓</div>
                  <span className="source-icon">{source.icon}</span>
                  <div className="source-name">{source.name}</div>
                  <div className="source-fields">{source.sourceFields}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="source-section">
          <div className="source-section-label">Machine screens</div>
          <div className="source-grid">
            {machines.map((source) => {
              const selected = selectedSourceKey === source.key;
              return (
                <button
                  key={source.key}
                  type="button"
                  className={`source-card ${source.cardClass} ${selected ? "selected" : ""}`}
                  onClick={() => setSelectedSourceKey(source.key)}
                >
                  <div className="source-check">✓</div>
                  <span className="source-icon">{source.icon}</span>
                  <div className="source-name">{source.name}</div>
                  <div className="source-fields">{source.sourceFields}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="recent-section">
          <div className="recent-title">Recent uploads</div>
          <div className="recent-list">
            <div className="recent-item">
              <div className="recent-icon" style={{ background: "var(--coral-dim)" }}>
                ⌚
              </div>
              <div>
                <div className="recent-name">Whoop daily recovery</div>
                <div className="recent-detail">Today · 97% confidence</div>
                <div className="recent-fields">Recovery 74 · HRV 68ms · Sleep 7.4h</div>
              </div>
              <div className="recent-date">Today</div>
            </div>
            <div className="recent-item">
              <div className="recent-icon" style={{ background: "var(--blue-dim)" }}>
                💍
              </div>
              <div>
                <div className="recent-name">Oura readiness</div>
                <div className="recent-detail">Yesterday · 94% confidence</div>
                <div className="recent-fields">Readiness 81 · Sleep 79 · HRV 65ms</div>
              </div>
              <div className="recent-date">Yesterday</div>
            </div>
          </div>
        </div>

        <button
          className="btn-primary"
          type="button"
          disabled={!selectedSource}
          onClick={() => {
            setError("");
            setStatus("");
            setScreen("upload");
          }}
        >
          {selectedSource ? `Upload ${selectedSource.name} data →` : "Select a source to continue"}
        </button>
      </div>

      <div className={`screen ${screen === "upload" ? "active" : ""}`}>
        <div className="eyebrow">{selectedSource?.name ?? "Data source"}</div>
        <h1 className="page-title">
          Upload your
          <br />
          screenshot
        </h1>
        <p className="page-sub">
          {selectedSource?.uploadSub ??
            "Take a screenshot of your app or machine result and upload it here."}
        </p>

        <div className="screenshot-tip show">
          <div className="tip-title">📸 How to get the best screenshot</div>
          <div className="tip-steps">
            {(selectedSource?.tips ?? []).map((tip, index) => (
              <div key={tip} className="tip-step">
                <div className="tip-step-num">{index + 1}</div>
                {tip}
              </div>
            ))}
          </div>
        </div>

        <label className="upload-zone">
          <input
            ref={fileInputRef}
            className="upload-zone-input"
            type="file"
            accept="image/*"
            onChange={(event) => onUploadFile(event.target.files?.[0] ?? null)}
          />
          <span className="upload-zone-icon">{selectedSource?.icon ?? "📸"}</span>
          <div className="upload-zone-title">Tap to upload screenshot</div>
          <div className="upload-zone-sub">
            Or drag and drop your image here.
            <br />
            Claude will read it automatically.
          </div>
          <div className="upload-formats">
            <span className="format-chip">PNG</span>
            <span className="format-chip">JPG</span>
            <span className="format-chip">HEIC</span>
            <span className="format-chip">WEBP</span>
          </div>
        </label>

        {previewUrl ? (
          <div className="preview-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="preview-img" alt="Upload preview" src={previewUrl} />
            <div className="preview-actions">
              <button
                className="preview-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace
              </button>
            </div>
            <div className="source-badge">{selectedSource?.name ?? "Upload"}</div>
          </div>
        ) : null}

        <button className="btn-primary" type="button" onClick={() => runExtraction(true)}>
          Demo — use sample screenshot →
        </button>
        <div className="btn-row">
          <button className="btn-ghost" type="button" onClick={() => setScreen("home")}>
            ← Back
          </button>
        </div>
        {error ? <div className="error-note">{error}</div> : null}
        {status ? <div className="status-note">{status}</div> : null}
      </div>

      <div className={`screen ${screen === "analyzing" ? "active" : ""}`}>
        <div className="eyebrow">Reading your data</div>
        <h1 className="page-title">
          Claude is analyzing
          <br />
          your screenshot
        </h1>
        <div className="analyzing-wrap">
          <div className="analyzing-orb">🤖</div>
          <div className="analyzing-title">
            Reading {selectedSource?.name ?? "your"} data…
          </div>
          <div className="analyzing-sub">Extracting visible metrics from your screenshot.</div>
          <div className="dots">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
          <div className="progress-list">
            {ANALYSIS_STEPS.map((stepName, index) => {
              const stepNumber = index + 1;
              const state =
                stepNumber < analysisStep ? "done" : stepNumber === analysisStep ? "active" : "pending";
              return (
                <div key={stepName} className={`prog-item ${state}`}>
                  <div className="prog-dot">
                    {state === "done" ? "✓" : state === "active" ? "●" : stepNumber}
                  </div>
                  {stepName}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`screen ${screen === "review" ? "active" : ""}`}>
        <div className="eyebrow">Review extracted data</div>
        <h1 className="page-title">
          Looks good —
          <br />
          confirm to save
        </h1>
        <p className="page-sub">
          Claude extracted the following from your screenshot. Edit anything that looks wrong
          before saving.
        </p>

        <div className="results-banner">
          <div className="results-banner-icon">✓</div>
          <div>
            <div className="results-banner-title">
              {selectedSource?.name ?? "Data"} extracted
            </div>
            <div className="results-banner-sub">{reviewFields.length} fields · High confidence</div>
          </div>
          <div className="confidence">
            <div className="confidence-val">{confidence}%</div>
            <div className="confidence-label">Confidence</div>
          </div>
        </div>

        {sourceContext.length ? (
          <div className="context-card">
            {sourceContext.map((item) => (
              <div key={item.label} className="context-row">
                <span className="context-label">{item.label}</span>
                <span className="context-val">
                  {item.val}
                  {item.change ? (
                    <span className={`context-change ${item.up ? "up" : "dn"}`}>
                      {item.up ? "↑" : "↓"} {item.change}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="fields-list">
          {reviewFields.map((field) => {
            const value = fieldValues[field.key] ?? "--";
            const isEditing = Boolean(editingField[field.key]);
            return (
              <div
                key={field.key}
                className={`field-row ${field.highlight ? "highlight" : ""} ${field.flagged ? "flagged" : ""}`}
              >
                <div className="field-label">{field.label}</div>
                {isEditing ? (
                  <input
                    className="field-input-edit"
                    value={value}
                    onChange={(event) =>
                      setFieldValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                  />
                ) : (
                  <div className="field-val">{value}</div>
                )}
                {field.flagged && !isEditing ? (
                  <span className="field-flag">⚠ Review</span>
                ) : (
                  <button
                    className="field-edit"
                    type="button"
                    onClick={() => toggleEditField(field.key)}
                  >
                    {isEditing ? "Save" : "Edit"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="notes-area">
          <div className="notes-label">Add a note (optional)</div>
          <textarea
            className="notes-ta"
            placeholder="How did you feel today? Anything that might explain the data…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <button className="btn-primary" type="button" disabled={saving} onClick={saveData}>
          {saving ? "Saving…" : "Save to my profile →"}
        </button>
        <div className="btn-row">
          <button className="btn-ghost" type="button" onClick={() => setScreen("upload")}>
            ← Retake
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() =>
              setEditingField((prev) =>
                reviewFields.reduce<Record<string, boolean>>((acc, field) => {
                  acc[field.key] = !prev[field.key];
                  return acc;
                }, {}),
              )
            }
          >
            Edit all
          </button>
        </div>
        {error ? <div className="error-note">{error}</div> : null}
        {status ? <div className="status-note">{status}</div> : null}
      </div>

      <div className={`success-overlay ${successOpen ? "show" : ""}`}>
        <div className="success-card">
          <div className="success-check">✓</div>
          <div className="success-title">Data saved!</div>
          <div className="success-sub">
            Your {selectedSource?.name ?? "upload"} data has been added to your Healthspan OS
            profile.
          </div>
          <div className="success-stats">
            <div className="success-stat">
              <div
                className="success-stat-val"
                style={{ color: sourceSummary[0]?.color ?? "var(--text)" }}
              >
                {sourceSummary[0]?.val ?? "--"}
              </div>
              <div className="success-stat-label">{sourceSummary[0]?.label ?? "Metric 1"}</div>
            </div>
            <div className="success-stat">
              <div className="success-stat-val">{sourceSummary[1]?.val ?? "--"}</div>
              <div className="success-stat-label">{sourceSummary[1]?.label ?? "Metric 2"}</div>
            </div>
            <div className="success-stat">
              <div className="success-stat-val">{sourceSummary[2]?.val ?? "--"}</div>
              <div className="success-stat-label">{sourceSummary[2]?.label ?? "Metric 3"}</div>
            </div>
          </div>
          <div className="dustin-note">
            💬 Dustin will see this before your next session and may adjust your protocol.
          </div>
          <button className="btn-s-primary" type="button" onClick={uploadAnother}>
            Upload another →
          </button>
          <button className="btn-s-ghost" type="button" onClick={() => router.push("/dashboard")}>
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
        .upload-page {
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
          --lime2: #a8d038;
          --lime-dim: rgba(201, 240, 85, 0.12);
          --lime-dim2: rgba(201, 240, 85, 0.05);
          --amber: #f0b955;
          --amber-dim: rgba(240, 185, 85, 0.12);
          --blue: #55b8f0;
          --blue-dim: rgba(85, 184, 240, 0.12);
          --coral: #f07055;
          --coral-dim: rgba(240, 112, 85, 0.12);
          --teal: #55e8c8;
          --teal-dim: rgba(85, 232, 200, 0.12);
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
          color: var(--lime);
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
        .screen {
          display: none;
          max-width: 540px;
          margin: 0 auto;
          padding: 24px 20px 60px;
        }
        .screen.active {
          display: block;
        }
        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--lime);
          margin-bottom: 8px;
        }
        .page-title {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 28px;
          margin-bottom: 8px;
          line-height: 1.2;
        }
        .page-sub {
          font-size: 14px;
          color: var(--text2);
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .source-section {
          margin-bottom: 26px;
        }
        .source-section-label {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 10px;
        }
        .source-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .source-card {
          text-align: left;
          padding: 16px 14px;
          border-radius: 14px;
          border: 1.5px solid var(--border);
          background: var(--bg2);
          cursor: pointer;
          position: relative;
          color: var(--text);
        }
        .source-card.selected {
          border-width: 2px;
        }
        .source-card.whoop.selected {
          border-color: var(--coral);
          background: var(--coral-dim);
        }
        .source-card.oura.selected,
        .source-card.carol.selected {
          border-color: var(--blue);
          background: var(--blue-dim);
        }
        .source-card.arx.selected {
          border-color: var(--amber);
          background: var(--amber-dim);
        }
        .source-card.garmin.selected {
          border-color: var(--teal);
          background: var(--teal-dim);
        }
        .source-card.apple.selected,
        .source-card.other.selected {
          border-color: var(--text2);
          background: rgba(154, 152, 137, 0.1);
        }
        .source-card.fitbit.selected {
          border-color: var(--lime);
          background: var(--lime-dim);
        }
        .source-check {
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
          background: var(--lime);
          color: var(--bg);
        }
        .source-card.selected .source-check {
          opacity: 1;
        }
        .source-icon {
          font-size: 26px;
          margin-bottom: 8px;
          display: block;
        }
        .source-name {
          font-size: 13.5px;
          font-weight: 500;
          margin-bottom: 3px;
        }
        .source-fields {
          font-size: 11px;
          color: var(--text3);
          line-height: 1.5;
        }
        .recent-section {
          margin-bottom: 24px;
        }
        .recent-title {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 10px;
        }
        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .recent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--bg2);
          border: 1px solid var(--border);
        }
        .recent-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .recent-name {
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 1px;
        }
        .recent-detail {
          font-size: 11px;
          color: var(--text3);
        }
        .recent-fields {
          font-size: 11px;
          color: var(--lime);
          margin-top: 2px;
        }
        .recent-date {
          font-size: 11px;
          color: var(--text3);
          margin-left: auto;
          white-space: nowrap;
        }
        .screenshot-tip {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 20px;
        }
        .tip-title {
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 8px;
        }
        .tip-steps {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tip-step {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12.5px;
          color: var(--text2);
        }
        .tip-step-num {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--lime-dim);
          border: 1px solid var(--lime);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          color: var(--lime);
          flex-shrink: 0;
          margin-top: 1px;
        }
        .upload-zone {
          border: 2px dashed var(--border2);
          border-radius: 16px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          margin-bottom: 16px;
          display: block;
          position: relative;
        }
        .upload-zone-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }
        .upload-zone-icon {
          font-size: 44px;
          margin-bottom: 12px;
          display: block;
        }
        .upload-zone-title {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 20px;
          margin-bottom: 6px;
        }
        .upload-zone-sub {
          font-size: 13px;
          color: var(--text3);
          line-height: 1.6;
          margin-bottom: 14px;
        }
        .upload-formats {
          display: flex;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .format-chip {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 5px;
          background: var(--bg3);
          border: 1px solid var(--border);
          color: var(--text3);
        }
        .preview-wrap {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border2);
          margin-bottom: 16px;
          background: var(--bg2);
          position: relative;
        }
        .preview-img {
          width: 100%;
          max-height: 280px;
          object-fit: contain;
          display: block;
        }
        .preview-actions {
          position: absolute;
          top: 10px;
          right: 10px;
        }
        .preview-btn {
          padding: 5px 10px;
          border-radius: 6px;
          background: rgba(11, 12, 9, 0.88);
          border: 1px solid var(--border2);
          color: var(--text2);
          font-size: 11px;
          cursor: pointer;
        }
        .source-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(11, 12, 9, 0.88);
          font-size: 11px;
          border: 1px solid var(--border2);
        }
        .analyzing-wrap {
          background: var(--bg2);
          border: 1px solid var(--border2);
          border-radius: 16px;
          padding: 32px 20px;
          text-align: center;
        }
        .analyzing-orb {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--lime-dim);
          border: 2px solid var(--lime);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
          font-size: 24px;
        }
        .analyzing-title {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 20px;
          margin-bottom: 6px;
        }
        .analyzing-sub {
          font-size: 13px;
          color: var(--text2);
          margin-bottom: 20px;
        }
        .dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 20px;
        }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--border2);
        }
        .progress-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
        }
        .prog-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          background: var(--bg3);
          font-size: 12.5px;
        }
        .prog-dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          flex-shrink: 0;
        }
        .prog-item.done .prog-dot {
          background: var(--lime-dim);
          border: 1px solid var(--lime);
          color: var(--lime);
        }
        .prog-item.active .prog-dot {
          background: var(--amber-dim);
          border: 1px solid var(--amber);
          color: var(--amber);
        }
        .prog-item.pending .prog-dot {
          background: var(--bg4);
          border: 1px solid var(--border);
          color: var(--text3);
        }
        .results-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: var(--lime-dim);
          border: 1px solid rgba(201, 240, 85, 0.2);
          border-radius: 12px;
          margin-bottom: 14px;
        }
        .results-banner-icon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--lime);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          color: var(--bg);
          flex-shrink: 0;
        }
        .results-banner-title {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--lime);
        }
        .results-banner-sub {
          font-size: 11px;
          color: var(--lime);
        }
        .confidence {
          margin-left: auto;
          text-align: right;
        }
        .confidence-val {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 22px;
          color: var(--lime);
        }
        .confidence-label {
          font-size: 10px;
          color: var(--lime);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .context-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 16px;
        }
        .context-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .context-row:last-child {
          margin-bottom: 0;
        }
        .context-label {
          color: var(--text3);
        }
        .context-val {
          color: var(--text2);
          font-weight: 500;
        }
        .context-change {
          font-size: 12px;
          margin-left: 6px;
        }
        .up {
          color: var(--lime);
        }
        .dn {
          color: var(--coral);
        }
        .fields-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-bottom: 16px;
        }
        .field-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border-radius: 8px;
          background: var(--bg2);
          border: 1px solid var(--border);
        }
        .field-row.highlight {
          background: var(--lime-dim2);
          border-color: rgba(201, 240, 85, 0.15);
        }
        .field-row.flagged {
          border-color: var(--amber);
          background: var(--amber-dim);
        }
        .field-label {
          font-size: 12px;
          color: var(--text3);
          width: 170px;
          flex-shrink: 0;
        }
        .field-val {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
        }
        .field-edit {
          font-size: 11px;
          color: var(--text3);
          cursor: pointer;
          padding: 3px 8px;
          border-radius: 5px;
          background: transparent;
          border: 0;
        }
        .field-input-edit {
          flex: 1;
          background: var(--bg3);
          border: 1px solid var(--lime);
          border-radius: 6px;
          padding: 6px 10px;
          color: var(--text);
          font-size: 13px;
          outline: none;
        }
        .field-flag {
          font-size: 10px;
          color: var(--amber);
          white-space: nowrap;
        }
        .notes-area {
          margin-bottom: 16px;
        }
        .notes-label {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 6px;
        }
        .notes-ta {
          width: 100%;
          background: var(--bg2);
          border: 1.5px solid var(--border2);
          border-radius: 8px;
          padding: 12px 14px;
          color: var(--text);
          font-size: 14px;
          outline: none;
          resize: none;
          height: 70px;
        }
        .btn-primary {
          width: 100%;
          padding: 15px;
          border-radius: 10px;
          background: var(--lime);
          color: var(--bg);
          border: none;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 8px;
        }
        .btn-primary:disabled {
          opacity: 0.4;
          pointer-events: none;
        }
        .btn-ghost {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          background: transparent;
          color: var(--text3);
          border: 1.5px solid var(--border2);
          font-size: 13px;
          cursor: pointer;
        }
        .btn-row {
          display: flex;
          gap: 10px;
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
          border: 1px solid var(--lime);
          border-radius: 18px;
          padding: 36px 24px;
          text-align: center;
          max-width: 360px;
          width: 100%;
        }
        .success-check {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--lime-dim);
          border: 2px solid var(--lime);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 30px;
        }
        .success-title {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 26px;
          margin-bottom: 8px;
        }
        .success-sub {
          font-size: 13.5px;
          color: var(--text2);
          margin-bottom: 20px;
        }
        .success-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
        }
        .success-stat {
          padding: 10px 8px;
          border-radius: 10px;
          background: var(--bg3);
          border: 1px solid var(--border);
        }
        .success-stat-val {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 18px;
          margin-bottom: 2px;
        }
        .success-stat-label {
          font-size: 9px;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .dustin-note {
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--amber-dim);
          border: 1px solid rgba(240, 185, 85, 0.2);
          margin-bottom: 16px;
          font-size: 12.5px;
          color: var(--amber);
          text-align: left;
        }
        .btn-s-primary {
          width: 100%;
          padding: 13px;
          background: var(--lime);
          color: var(--bg);
          border: none;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 8px;
        }
        .btn-s-ghost {
          width: 100%;
          padding: 11px;
          background: transparent;
          color: var(--text3);
          border: 1px solid var(--border2);
          border-radius: 9px;
          font-size: 13px;
          cursor: pointer;
        }
        .status-note,
        .error-note {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
        }
        .status-note {
          color: var(--lime);
          background: var(--lime-dim2);
          border: 1px solid rgba(201, 240, 85, 0.3);
        }
        .error-note {
          color: var(--coral);
          background: rgba(240, 112, 85, 0.08);
          border: 1px solid rgba(240, 112, 85, 0.3);
        }
      `}</style>
    </main>
  );
}
