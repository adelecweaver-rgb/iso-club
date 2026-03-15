import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { loadPrototypeFromFiles } from "@/lib/server/prototype";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const clerkConfigured = isClerkConfigured();
  if (!clerkConfigured) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Authentication not configured</h1>
          <p className="muted">
            Set
            {" "}
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
            {" "}
            and
            {" "}
            <code>CLERK_SECRET_KEY</code>
            {" "}
            in Vercel.
          </p>
        </div>
      </main>
    );
  }

  const authState = await getCurrentAuthState();
  if (!authState.isAuthenticated) {
    redirect("/sign-in");
  }

  if (authState.role === "coach" || authState.role === "admin" || authState.role === "staff") {
    redirect(routeForRole(authState.role));
  }

  if (authState.onboardingComplete) {
    redirect("/dashboard");
  }

  const prototype = await loadPrototypeFromFiles(
    ["iso-club-onboarding.html"],
    "Iso Club Onboarding",
  );

  const onboardingBootstrapScript = `
    (() => {
      const normalizeTier = (input) => {
        const value = String(input || "").trim().toLowerCase();
        if (value.includes("concierge")) return "concierge";
        if (value.includes("premier")) return "premier";
        return "essential";
      };

      const parseHeightInches = (raw) => {
        const value = String(raw || "").trim();
        if (!value) return null;
        const feetInches = value.match(/^(\\d+)\\s*'\\s*(\\d+)$/);
        if (feetInches) {
          const feet = Number(feetInches[1]);
          const inches = Number(feetInches[2]);
          if (Number.isFinite(feet) && Number.isFinite(inches)) return feet * 12 + inches;
        }
        const numeric = Number(value.replace(/[^\\d.]/g, ""));
        if (Number.isFinite(numeric)) return Math.round(numeric);
        return null;
      };

      const findInScreen = (screenId, selector) => {
        const root = document.getElementById(screenId);
        if (!root) return null;
        return root.querySelector(selector);
      };

      const firstNameInput = findInScreen("screen-2", 'input[placeholder="Mark"]');
      const lastNameInput = findInScreen("screen-2", 'input[placeholder="Reynolds"]');
      const dobInput = findInScreen("screen-2", 'input[type="date"]');
      const genderSelect = findInScreen("screen-2", "select");
      const healthInputs = Array.from(document.querySelectorAll("#screen-2 .health-input"));
      const heightInput = healthInputs[0] || null;
      const phoneInput = healthInputs[2] || null;
      const notesInput = findInScreen("screen-4", "textarea");
      const deviceCards = () => Array.from(document.querySelectorAll("#screen-5 .device-card.selected"));

      const notifCard = document.querySelector(".notif-card");
      const notifToggle = document.querySelector(".notif-toggle");
      const notifThumb = document.querySelector(".notif-thumb");
      let notificationsEnabled = true;
      const applyNotifToggle = () => {
        if (!notifToggle || !notifThumb) return;
        notifToggle.style.background = notificationsEnabled ? "var(--lime)" : "var(--bg4)";
        notifThumb.style.right = notificationsEnabled ? "3px" : "21px";
      };
      if (notifCard) {
        notifCard.addEventListener("click", () => {
          notificationsEnabled = !notificationsEnabled;
          applyNotifToggle();
        });
      }
      applyNotifToggle();

      const statusEl = document.createElement("div");
      statusEl.id = "onboarding-submit-status";
      statusEl.style.marginTop = "10px";
      statusEl.style.fontSize = "12px";
      statusEl.style.color = "var(--text3)";
      const finalScreen = document.getElementById("screen-7");
      if (finalScreen) {
        finalScreen.appendChild(statusEl);
      }

      const setStatus = (message, type) => {
        if (!statusEl) return;
        statusEl.textContent = message || "";
        if (type === "error") {
          statusEl.style.color = "var(--coral)";
        } else if (type === "success") {
          statusEl.style.color = "var(--lime)";
        } else {
          statusEl.style.color = "var(--text3)";
        }
      };

      const selectedTierName = () => {
        const selectedTier = document.querySelector("#screen-6 .tier-card.selected .tier-name");
        return selectedTier && selectedTier.textContent ? selectedTier.textContent : "";
      };

      const selectedDeviceNames = () =>
        deviceCards()
          .map((card) => {
            const name = card.querySelector(".device-name");
            return name && name.textContent ? name.textContent.toLowerCase() : "";
          })
          .filter(Boolean);

      window.goToDashboard = async () => {
        try {
          const firstName =
            firstNameInput && "value" in firstNameInput ? String(firstNameInput.value || "").trim() : "";
          const lastName =
            lastNameInput && "value" in lastNameInput ? String(lastNameInput.value || "").trim() : "";
          const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
          const phone =
            phoneInput && "value" in phoneInput ? String(phoneInput.value || "").trim() : "";
          const dateOfBirth =
            dobInput && "value" in dobInput ? String(dobInput.value || "").trim() : "";
          const gender =
            genderSelect && "value" in genderSelect ? String(genderSelect.value || "").trim() : "";
          const notes =
            notesInput && "value" in notesInput ? String(notesInput.value || "").trim() : "";
          const heightRaw =
            heightInput && "value" in heightInput ? String(heightInput.value || "").trim() : "";
          const heightInches = parseHeightInches(heightRaw);
          const devices = selectedDeviceNames();

          if (!phone) {
            setStatus("Phone number is required for SMS notifications.", "error");
            return;
          }

          setStatus("Saving onboarding…", "info");
          const response = await fetch("/api/onboarding/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              full_name: fullName,
              phone,
              date_of_birth: dateOfBirth || null,
              gender: gender || null,
              height_inches: heightInches,
              membership_tier: normalizeTier(selectedTierName()),
              notes: notes || null,
              whoop_connected: devices.some((name) => name.includes("whoop")),
              oura_connected: devices.some((name) => name.includes("oura")),
              notification_preferences: {
                welcome_sms: notificationsEnabled,
                protocol_ready_sms: notificationsEnabled,
                scan_results_sms: notificationsEnabled,
                weekly_summary_sms: notificationsEnabled,
                session_reminder_sms: notificationsEnabled,
                low_recovery_sms: notificationsEnabled,
              },
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.success === false) {
            throw new Error(payload.error || "Unable to save onboarding details.");
          }
          setStatus("Onboarding saved. Redirecting…", "success");
          window.location.href = "/dashboard";
        } catch (error) {
          setStatus(
            error instanceof Error ? error.message : "Unable to complete onboarding.",
            "error",
          );
        }
      };
    })();
  `;

  if (!prototype.source) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Complete onboarding</h1>
          <p className="muted">
            Finish your intake details to continue to the dashboard.
          </p>
          <OnboardingForm />
        </div>
      </main>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prototype.styles }} />
      <div dangerouslySetInnerHTML={{ __html: prototype.body }} />
      {prototype.script ? (
        <script dangerouslySetInnerHTML={{ __html: prototype.script }} />
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: onboardingBootstrapScript }} />
    </>
  );
}
