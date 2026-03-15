"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SubmitState =
  | { kind: "idle"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | { kind: "loading"; message: string };

function statusColor(kind: SubmitState["kind"]): string {
  if (kind === "success") return "#9dff73";
  if (kind === "error") return "#ff7d7d";
  return "#afbda5";
}

export function OnboardingForm() {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>({ kind: "idle", message: "" });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [membershipTier, setMembershipTier] = useState("essential");
  const [notes, setNotes] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setState({ kind: "loading", message: "Saving onboarding…" });
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          date_of_birth: dateOfBirth,
          gender,
          height_inches: heightInches,
          emergency_contact: emergencyContact,
          membership_tier: membershipTier,
          notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to save onboarding data.");
      }
      setState({ kind: "success", message: "Onboarding saved. Redirecting…" });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to save onboarding data.",
      });
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginTop: 18,
        display: "grid",
        gap: 10,
        border: "1px solid rgba(175,189,165,0.22)",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Complete onboarding intake
      </p>
      <input
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent" }}
        placeholder="Full name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <input
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent" }}
        placeholder="Phone"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <input
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent" }}
        type="date"
        value={dateOfBirth}
        onChange={(event) => setDateOfBirth(event.target.value)}
      />
      <input
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent" }}
        placeholder="Gender"
        value={gender}
        onChange={(event) => setGender(event.target.value)}
      />
      <input
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent" }}
        placeholder="Height (inches)"
        value={heightInches}
        onChange={(event) => setHeightInches(event.target.value)}
      />
      <input
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent" }}
        placeholder="Emergency contact"
        value={emergencyContact}
        onChange={(event) => setEmergencyContact(event.target.value)}
      />
      <select
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent" }}
        value={membershipTier}
        onChange={(event) => setMembershipTier(event.target.value)}
      >
        <option value="essential">Essential</option>
        <option value="premier">Premier</option>
        <option value="concierge">Concierge</option>
      </select>
      <textarea
        className="btn secondary"
        style={{ textAlign: "left", background: "transparent", minHeight: 70 }}
        placeholder="Intake notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <button className="btn" type="submit" disabled={state.kind === "loading"}>
        Save onboarding
      </button>
      <p style={{ margin: 0, fontSize: 12, color: statusColor(state.kind) }}>{state.message}</p>
    </form>
  );
}
