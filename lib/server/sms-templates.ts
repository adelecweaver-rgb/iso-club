import "server-only";

function firstName(fullName: string): string {
  const name = fullName.trim();
  if (!name) return "Member";
  return name.split(" ")[0] ?? "Member";
}

const DASHBOARD_LINK = "https://iso-club-8qsg.vercel.app";

export function buildWelcomeSmsTemplate(fullName: string): string {
  return `Hey ${firstName(fullName)} — Dustin here. You're in. Your Iso Club dashboard is live. I'm reviewing your intake now and will have your protocol ready within 48 hours. Log in here: ${DASHBOARD_LINK}`;
}

export function buildProtocolReadySmsTemplate(
  fullName: string,
  primaryGoal: string,
): string {
  const goal = primaryGoal.trim() || "your current goal";
  return `${firstName(fullName)} — your protocol is ready. I built it around your goal of ${goal}. Log in to see your sessions: ${DASHBOARD_LINK}. Book your first session when you're ready. Questions? Reply here.`;
}

export function buildScanResultsSmsTemplate(
  fullName: string,
  headlineMetricAndChange: string,
): string {
  const headline = headlineMetricAndChange.trim() || "new scan insights available";
  return `${firstName(fullName)} — reviewed your Fit3D scan. Headline: ${headline}. Full results in your dashboard: ${DASHBOARD_LINK}. I've already updated your protocol based on what I see.`;
}

export function buildWeeklySummarySmsTemplate(
  fullName: string,
  sessionsCompleted: number,
  healthspanScore: string,
  trend: "up" | "down" | "flat",
  highlight: string,
): string {
  const cleanHighlight = highlight.trim() || "You're building consistency.";
  const trendLabel = trend === "up" ? "up" : trend === "down" ? "down" : "flat";
  return `${firstName(fullName)} — week in review: ${sessionsCompleted} sessions completed. Healthspan OS: ${healthspanScore} ${trendLabel}. ${cleanHighlight}. Keep going. Dashboard: ${DASHBOARD_LINK}`;
}

export function buildSessionReminderSmsTemplate(
  fullName: string,
  sessionName: string,
  sessionTime: string,
  keyFocus: string,
): string {
  const name = sessionName.trim() || "your session";
  const focus = keyFocus.trim() || "quality movement";
  return `${firstName(fullName)} — reminder: ${name} tomorrow at ${sessionTime}. Your protocol says ${focus}. See you then. — Dustin`;
}

export function buildLowRecoverySmsTemplate(
  fullName: string,
  recoveryScore: number,
): string {
  return `${firstName(fullName)} — your recovery score is ${Math.round(recoveryScore)} this morning. I've noted it. Come in but we'll adjust the intensity. Don't push hard on low recovery. — Dustin`;
}
