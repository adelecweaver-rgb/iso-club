import "server-only";

type SmsTemplateData = Record<string, string | number>;

function renderTemplate(template: string, data: SmsTemplateData): string {
  return Object.entries(data).reduce((message, [key, value]) => {
    return message.replaceAll(`{{${key}}}`, String(value));
  }, template);
}

function firstName(fullName: string): string {
  const name = fullName.trim();
  if (!name) return "Member";
  return name.split(" ")[0] ?? "Member";
}

export function buildWelcomeSms(fullName: string): string {
  const template =
    process.env.SMS_TEMPLATE_WELCOME ??
    "Welcome to Iso Club, {{firstName}}! Your account is ready and your Healthspan journey starts now.";
  return renderTemplate(template, { firstName: firstName(fullName) });
}

export function buildProtocolReadySms(fullName: string, protocolName: string): string {
  const template =
    process.env.SMS_TEMPLATE_PROTOCOL_READY ??
    "Hi {{firstName}} — your protocol \"{{protocolName}}\" is ready in Iso Club. Open your dashboard to view your plan.";
  return renderTemplate(template, {
    firstName: firstName(fullName),
    protocolName: protocolName || "New Protocol",
  });
}

export function buildScanResultsSms(fullName: string): string {
  const template =
    process.env.SMS_TEMPLATE_SCAN_RESULTS ??
    "Hi {{firstName}} — your latest scan has been reviewed by Dustin and results are now available in your dashboard.";
  return renderTemplate(template, { firstName: firstName(fullName) });
}

export function buildWeeklySummarySms(
  fullName: string,
  recoveryScore: string,
  nextSession: string,
): string {
  const template =
    process.env.SMS_TEMPLATE_WEEKLY_SUMMARY ??
    "Weekly summary for {{firstName}}: recovery {{recoveryScore}}, next session {{nextSession}}. Check your Iso Club dashboard for full details.";
  return renderTemplate(template, {
    firstName: firstName(fullName),
    recoveryScore,
    nextSession,
  });
}

export function buildSessionReminderSms(
  fullName: string,
  sessionName: string,
  sessionTimeLabel: string,
): string {
  const template =
    process.env.SMS_TEMPLATE_SESSION_REMINDER ??
    "Reminder: you have {{sessionName}} at {{sessionTime}} tomorrow. See you at Iso Club.";
  return renderTemplate(template, {
    firstName: firstName(fullName),
    sessionName: sessionName || "your session",
    sessionTime: sessionTimeLabel,
  });
}

export function buildLowRecoverySms(
  fullName: string,
  recoveryScore: string,
  deviceType: string,
): string {
  const template =
    process.env.SMS_TEMPLATE_LOW_RECOVERY ??
    "Hi {{firstName}} — your {{deviceType}} recovery score is {{recoveryScore}} today. Prioritize recovery before your next training session.";
  return renderTemplate(template, {
    firstName: firstName(fullName),
    recoveryScore,
    deviceType: deviceType || "wearable",
  });
}
