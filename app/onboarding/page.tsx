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
      let currentScreen = 1;
      const totalScreens = 6;
      const progressMap = {
        1: 17,
        2: 33,
        3: 50,
        4: 67,
        5: 83,
        6: 100,
      };

      const showScreen = (screenNumber) => {
        const target = Number(screenNumber);
        if (!Number.isFinite(target) || target < 1 || target > totalScreens) return;
        document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
        const activeScreen = document.getElementById("screen-" + target);
        if (activeScreen) {
          activeScreen.classList.add("active");
          window.scrollTo(0, 0);
        }
        const progressEl = document.getElementById("progress-fill");
        if (progressEl) {
          progressEl.style.width = (progressMap[target] || progressMap[1]) + "%";
        }
        const stepEl = document.getElementById("step-indicator");
        if (stepEl) {
          stepEl.textContent = target < totalScreens ? "Step " + target + " of " + (totalScreens - 1) : "Complete";
        }
        currentScreen = target;
      };

      const nextScreen = () => {
        if (currentScreen < totalScreens) showScreen(currentScreen + 1);
      };

      const prevScreen = () => {
        if (currentScreen > 1) showScreen(currentScreen - 1);
      };

      const toggleGoal = (element) => {
        if (element?.classList) element.classList.toggle("selected");
      };

      const selectDevice = (element) => {
        document.querySelectorAll(".device-card").forEach((card) => card.classList.remove("selected"));
        if (element?.classList) {
          element.classList.add("selected");
        }
        const prompt = document.getElementById("connect-prompt");
        if (!prompt) return;
        if (element?.id === "no-device") {
          prompt.style.display = "none";
          return;
        }
        prompt.style.display = "block";
      };

      const setOtherLimitationsVisibility = (isVisible) => {
        if (!limitationsOtherWrap) return;
        limitationsOtherWrap.style.display = isVisible ? "block" : "none";
        if (!isVisible && limitationsOtherInput && "value" in limitationsOtherInput) {
          limitationsOtherInput.value = "";
        }
      };

      const toggleCheck = (element) => {
        if (!element?.classList) return;
        const option = String(element.getAttribute("data-limitations-option") || "").toLowerCase();
        const screenRoot = document.getElementById("screen-4");
        const allItems = Array.from(screenRoot?.querySelectorAll(".checkbox-item") || []);

        element.classList.toggle("checked");
        const isChecked = element.classList.contains("checked");

        if (option === "none" && isChecked) {
          allItems.forEach((item) => {
            if (item !== element) item.classList.remove("checked");
          });
          setOtherLimitationsVisibility(false);
          return;
        }

        if (option === "other") {
          if (isChecked) {
            allItems.forEach((item) => {
              if (item === element) return;
              if (String(item.getAttribute("data-limitations-option") || "").toLowerCase() === "none") {
                item.classList.remove("checked");
              }
            });
          }
          setOtherLimitationsVisibility(isChecked);
          return;
        }

        if (isChecked) {
          allItems.forEach((item) => {
            if (String(item.getAttribute("data-limitations-option") || "").toLowerCase() === "none") {
              item.classList.remove("checked");
            }
          });
        }
      };

      window.showScreen = showScreen;
      window.nextScreen = nextScreen;
      window.prevScreen = prevScreen;
      window.toggleGoal = toggleGoal;
      window.selectDevice = selectDevice;
      window.toggleCheck = toggleCheck;

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
      const limitationsOtherWrap = findInScreen("screen-4", "#limitations-other-wrap");
      const limitationsOtherInput = findInScreen("screen-4", "#limitations-other-input");
      const deviceCards = () => Array.from(document.querySelectorAll("#screen-5 .device-card.selected"));

      const notifCard = document.querySelector(".notif-card");
      const notifToggle = document.querySelector(".notif-toggle");
      const notifThumb = document.querySelector(".notif-thumb");
      let notificationsEnabled = true;
      const applyNotifToggle = () => {
        if (!notifToggle || !notifThumb) return;
        notifToggle.style.background = notificationsEnabled ? "var(--green)" : "var(--bg4)";
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
          statusEl.style.color = "var(--green)";
        } else {
          statusEl.style.color = "var(--text3)";
        }
      };

      const selectedDeviceNames = () =>
        deviceCards()
          .map((card) => {
            const name = card.querySelector(".device-name");
            return name && name.textContent ? name.textContent.toLowerCase() : "";
          })
          .filter(Boolean);

      const selectedLimitations = () =>
        Array.from(document.querySelectorAll("#screen-4 .checkbox-item.checked .checkbox-label"))
          .map((label) => String(label.textContent || "").trim())
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
          const selectedLimitationItems = selectedLimitations();
          const limitationsOther =
            limitationsOtherInput && "value" in limitationsOtherInput
              ? String(limitationsOtherInput.value || "").trim()
              : "";
          const heightRaw =
            heightInput && "value" in heightInput ? String(heightInput.value || "").trim() : "";
          const heightInches = parseHeightInches(heightRaw);
          const devices = selectedDeviceNames();
          const limitationsSummary = selectedLimitationItems.length
            ? "Physical limitations: " + selectedLimitationItems.join(", ")
            : "";
          const limitationsOtherSummary = limitationsOther
            ? "Other limitation detail: " + limitationsOther
            : "";
          const combinedNotes = [notes, limitationsSummary, limitationsOtherSummary]
            .filter(Boolean)
            .join("\\n");

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
              membership_tier: "essential",
              notes: combinedNotes || null,
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
