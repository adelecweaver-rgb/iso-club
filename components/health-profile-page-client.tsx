"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HealthProfileForm } from "@/components/health-profile-form";
import { type OnboardingAnswers, emptyAnswers } from "@/lib/onboarding";

const C = {
  bg:     "#F5F0E8",
  bg2:    "#EDE8DE",
  white:  "#ffffff",
  text:   "#1C2B1E",
  text2:  "#3D4F3F",
  text3:  "#6B7B6E",
  border: "rgba(28,43,30,0.12)",
  green:  "#3A6347",
};

type Props = {
  displayName: string;
};

export function HealthProfilePageClient({ displayName }: Props) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(emptyAnswers());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/member/health-profile");
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data.success !== false) {
          setAnswers(data.answers ?? emptyAnswers());
        }
      } catch {
        // silent — form renders with empty state
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleSave = async (updated: OnboardingAnswers, requestReview: boolean) => {
    setSaving(true);
    setConfirmation(null);
    try {
      const res = await fetch("/api/member/health-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: updated, request_review: requestReview }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error ?? "Unable to save.");
      }
      setAnswers(updated);
      setConfirmation({
        text: requestReview
          ? "Review requested. Coach Dustin will update your protocol and let you know."
          : "Profile updated.",
        ok: true,
      });
    } catch (err) {
      setConfirmation({
        text: err instanceof Error ? err.message : "Unable to save.",
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        maxWidth: 560,
        margin: "0 auto",
        padding: "28px 20px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Health profile</div>
          <div style={{ fontSize: 13, color: C.text3, marginTop: 2 }}>{displayName}</div>
        </div>
        <Link
          href="/dashboard/settings"
          style={{ fontSize: 12, color: C.text3, textDecoration: "none" }}
        >
          ← Settings
        </Link>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          color: C.text3,
          lineHeight: 1.6,
          marginBottom: 24,
          marginTop: 0,
        }}
      >
        Your answers from onboarding. Update anything that&apos;s changed — your coach will only be
        notified if you request a review.
      </p>

      {/* Form card */}
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "20px 18px",
        }}
      >
        {!loaded ? (
          <div style={{ fontSize: 13, color: C.text3, padding: "20px 0", textAlign: "center" }}>
            Loading…
          </div>
        ) : (
          <HealthProfileForm
            initialAnswers={answers}
            saving={saving}
            onSave={handleSave}
            confirmationMessage={confirmation}
          />
        )}
      </div>
    </main>
  );
}
