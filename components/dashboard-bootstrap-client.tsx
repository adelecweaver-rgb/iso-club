"use client";

import { useEffect } from "react";

type MemberView =
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

type DashboardClientPayload = {
  role?: "member" | "coach";
  displayName?: string;
  initials?: string;
  tier?: string;
  metrics?: {
    carolFitness?: string;
    arxOutput?: string;
    leanMass?: string;
    whoopRecovery?: string;
  };
  healthspan?: {
    muscle?: string;
    cardio?: string;
    metabolic?: string;
    structural?: string;
    recovery?: string;
  };
  protocol?: {
    name?: string;
    weekCurrent?: string;
    weekTotal?: string;
    sessions?: Array<{ name?: string; detail?: string; duration?: string }>;
  };
  emptyStates?: {
    protocol?: boolean;
  };
};

const memberViewOrder: MemberView[] = [
  "dashboard",
  "protocol",
  "carol",
  "arx",
  "scans",
  "recovery",
  "wearables",
  "messages",
  "reports",
  "schedule",
];

const memberPathByView: Record<MemberView, string> = {
  dashboard: "/dashboard",
  protocol: "/dashboard/protocol",
  carol: "/dashboard/carol",
  arx: "/dashboard/arx",
  scans: "/dashboard/scans",
  recovery: "/dashboard/recovery",
  wearables: "/dashboard/wearables",
  messages: "/dashboard/messages",
  reports: "/dashboard/reports",
  schedule: "/dashboard/schedule",
};

const coachViewOrder = ["morning", "members", "log", "protocols"] as const;
type CoachView = (typeof coachViewOrder)[number];

declare global {
  interface Window {
    setMode?: (mode: "member" | "coach") => void;
    showView?: (name: MemberView) => void;
    showCoachView?: (name: CoachView) => void;
  }
}

function firstName(name: string): string {
  const first = name.trim().split(" ")[0];
  return first || "Member";
}

function setText(selector: string, value: string | undefined) {
  if (!value) return;
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

export function DashboardBootstrapClient({
  payload,
  initialMemberView,
}: {
  payload: DashboardClientPayload;
  initialMemberView: MemberView;
}) {
  useEffect(() => {
    const role = payload.role === "coach" ? "coach" : "member";

    const hideAllViews = () => {
      document
        .querySelectorAll('[id^="view-"],[id^="coach-"]')
        .forEach((el) => ((el as HTMLElement).style.display = "none"));
    };

    const setMemberActive = (name: MemberView) => {
      const items = Array.from(document.querySelectorAll("#member-nav .nav-item"));
      items.forEach((item) => item.classList.remove("active"));
      const index = memberViewOrder.indexOf(name);
      if (index >= 0 && items[index]) {
        items[index].classList.add("active");
      }
    };

    const setCoachActive = (name: CoachView) => {
      const items = Array.from(document.querySelectorAll("#coach-nav .nav-item"));
      items.forEach((item) => item.classList.remove("active"));
      const index = coachViewOrder.indexOf(name);
      if (index >= 0 && items[index]) {
        items[index].classList.add("active");
      }
    };

    const showView = (name: MemberView) => {
      hideAllViews();
      const view = document.getElementById(`view-${name}`);
      if (view) {
        view.style.display = "block";
      }
      setMemberActive(name);
      const targetPath = memberPathByView[name];
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, "", targetPath);
      }
    };

    const showCoachView = (name: CoachView) => {
      hideAllViews();
      const view = document.getElementById(`coach-${name}`);
      if (view) {
        view.style.display = "block";
      }
      setCoachActive(name);
      if (window.location.pathname !== "/coach") {
        window.history.pushState({}, "", "/coach");
      }
    };

    const setMode = (mode: "member" | "coach") => {
      const toggleButtons = Array.from(document.querySelectorAll(".vt-btn"));
      toggleButtons.forEach((btn, index) => {
        btn.classList.toggle(
          "active",
          (index === 0 && mode === "member") || (index === 1 && mode === "coach"),
        );
      });

      const memberNav = document.getElementById("member-nav");
      const coachNav = document.getElementById("coach-nav");
      if (memberNav) memberNav.style.display = mode === "member" ? "block" : "none";
      if (coachNav) coachNav.style.display = mode === "coach" ? "block" : "none";

      if (mode === "member") {
        showView(initialMemberView);
      } else {
        showCoachView("morning");
      }
    };

    window.showView = showView;
    window.showCoachView = showCoachView;
    window.setMode = setMode;

    const memberNavListeners = Array.from(document.querySelectorAll("#member-nav .nav-item")).map(
      (button, index) => {
        const handler = () => {
          const view = memberViewOrder[index] ?? "dashboard";
          showView(view);
        };
        button.addEventListener("click", handler);
        return { button, handler };
      },
    );

    const coachNavListeners = Array.from(document.querySelectorAll("#coach-nav .nav-item")).map(
      (button, index) => {
        const handler = () => {
          const view = coachViewOrder[index] ?? "morning";
          showCoachView(view);
        };
        button.addEventListener("click", handler);
        return { button, handler };
      },
    );

    const toggleListeners = Array.from(document.querySelectorAll(".vt-btn")).map((button, index) => {
      const handler = () => {
        setMode(index === 1 ? "coach" : "member");
      };
      button.addEventListener("click", handler);
      return { button, handler };
    });

    const topbarButtons = Array.from(document.querySelectorAll(".topbar-right .btn"));
    const messagesButton = topbarButtons.find((button) =>
      (button.textContent ?? "").toLowerCase().includes("messages"),
    );
    const bookButton = topbarButtons.find((button) =>
      (button.textContent ?? "").toLowerCase().includes("book"),
    );
    const messageHandler = () => showView("messages");
    const bookHandler = () => showView("schedule");
    messagesButton?.addEventListener("click", messageHandler);
    bookButton?.addEventListener("click", bookHandler);

    const replyButtons = Array.from(document.querySelectorAll("button")).filter((button) =>
      (button.textContent ?? "").trim().toLowerCase().startsWith("reply"),
    );
    const replyHandler = () => showView("messages");
    replyButtons.forEach((button) => button.addEventListener("click", replyHandler));

    const displayName = payload.displayName || "Member";
    setText("#user-name", displayName);
    setText("#user-av", payload.initials || "MB");
    setText("#top-title", `Good morning, ${firstName(displayName)}.`);

    const setStatCardValue = (labelFragment: string, value: string | undefined) => {
      if (!value) return;
      const cards = Array.from(document.querySelectorAll(".stat-card"));
      const card = cards.find((item) => {
        const label = item.querySelector(".stat-label");
        const text = label && label.textContent ? label.textContent.toLowerCase() : "";
        return text.includes(labelFragment.toLowerCase());
      });
      if (!card) return;
      const valueEl = card.querySelector(".stat-val");
      if (valueEl) valueEl.textContent = value;
    };

    setStatCardValue("CAROL fitness score", payload.metrics?.carolFitness);
    setStatCardValue("ARX leg press output", payload.metrics?.arxOutput);
    setStatCardValue("Lean mass", payload.metrics?.leanMass);
    setStatCardValue("Whoop recovery", payload.metrics?.whoopRecovery);

    const setMetricInCard = (cardTitle: string, labelFragment: string, value: string | undefined) => {
      if (!value) return;
      const cards = Array.from(document.querySelectorAll(".card"));
      const card = cards.find((item) => {
        const title = item.querySelector(".card-title");
        const text = title?.textContent?.toLowerCase() ?? "";
        return text.includes(cardTitle.toLowerCase());
      });
      if (!card) return;
      const rows = Array.from(card.querySelectorAll(".metric-row"));
      const row = rows.find((item) => {
        const label = item.querySelector(".metric-label");
        const text = label?.textContent?.toLowerCase() ?? "";
        return text.includes(labelFragment.toLowerCase());
      });
      if (!row) return;
      const valueEl = row.querySelector(".metric-val");
      if (valueEl) valueEl.textContent = value;
    };

    setMetricInCard("Healthspan OS", "Muscle", payload.healthspan?.muscle);
    setMetricInCard("Healthspan OS", "Cardio", payload.healthspan?.cardio);
    setMetricInCard("Healthspan OS", "Metabolic", payload.healthspan?.metabolic);
    setMetricInCard("Healthspan OS", "Structural", payload.healthspan?.structural);
    setMetricInCard("Healthspan OS", "Recovery", payload.healthspan?.recovery);

    const protocolName = payload.protocol?.name;
    const protocolWeekCurrent = payload.protocol?.weekCurrent;
    const protocolWeekTotal = payload.protocol?.weekTotal;
    const protocolSessions = payload.protocol?.sessions ?? [];
    if (protocolName) {
      setText("#view-dashboard .track-name", protocolName);
      setText(
        "#view-dashboard .track-meta",
        `Prescribed by Dustin · Week ${protocolWeekCurrent ?? "--"} of ${protocolWeekTotal ?? "--"} · 20 min sessions`,
      );
    }
    if (protocolSessions.length) {
      const rows = Array.from(document.querySelectorAll("#view-dashboard .session-item"));
      protocolSessions.forEach((session, index) => {
        const row = rows[index];
        if (!row) return;
        const name = row.querySelector(".s-name");
        const detail = row.querySelector(".s-detail");
        const duration = row.querySelector(".s-dur");
        if (name && session.name) name.textContent = session.name;
        if (detail) detail.textContent = session.detail ?? "";
        if (duration && session.duration) duration.textContent = `${session.duration} min`;
      });
    }

    if (payload.emptyStates?.protocol) {
      const applyProtocolEmptyState = (rootSelector: string) => {
        setText(`${rootSelector} .track-name`, "Your protocol is being prepared by Dustin");
        setText(
          `${rootSelector} .track-meta`,
          "You'll see your personalized plan here soon.",
        );
        const sessions = Array.from(document.querySelectorAll(`${rootSelector} .session-item`));
        sessions.forEach((session) => {
          (session as HTMLElement).style.display = "none";
        });
      };
      applyProtocolEmptyState("#view-dashboard");
      applyProtocolEmptyState("#view-protocol");
    }

    const topDate = document.getElementById("top-date");
    if (topDate) {
      topDate.textContent = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    setMode(role);

    return () => {
      memberNavListeners.forEach(({ button, handler }) =>
        button.removeEventListener("click", handler),
      );
      coachNavListeners.forEach(({ button, handler }) =>
        button.removeEventListener("click", handler),
      );
      toggleListeners.forEach(({ button, handler }) => button.removeEventListener("click", handler));
      messagesButton?.removeEventListener("click", messageHandler);
      bookButton?.removeEventListener("click", bookHandler);
      replyButtons.forEach((button) => button.removeEventListener("click", replyHandler));
      delete window.showView;
      delete window.showCoachView;
      delete window.setMode;
    };
  }, [initialMemberView, payload]);

  return null;
}
