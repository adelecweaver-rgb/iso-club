import "server-only";

import twilio from "twilio";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
};

export type SmsResult = {
  success: boolean;
  skipped?: boolean;
  sid?: string;
  error?: string;
};

function getTwilioConfig(): TwilioConfig | null {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? "").trim();
  const fromPhoneNumber = (process.env.TWILIO_PHONE_NUMBER ?? "").trim();
  if (!accountSid || !authToken || !fromPhoneNumber) {
    return null;
  }
  return { accountSid, authToken, fromPhoneNumber };
}

function normalizeToE164(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return "";
}

let cachedClient: twilio.Twilio | null = null;

function getTwilioClient(config: TwilioConfig): twilio.Twilio {
  if (!cachedClient) {
    cachedClient = twilio(config.accountSid, config.authToken);
  }
  return cachedClient;
}

export async function sendIsoClubSms(toPhone: string, body: string): Promise<SmsResult> {
  const config = getTwilioConfig();
  if (!config) {
    return {
      success: false,
      skipped: true,
      error: "Twilio environment variables are not configured.",
    };
  }

  const to = normalizeToE164(toPhone);
  if (!to) {
    return {
      success: false,
      skipped: true,
      error: "Recipient phone is missing or invalid.",
    };
  }

  const messageBody = body.trim();
  if (!messageBody) {
    return {
      success: false,
      skipped: true,
      error: "SMS body is empty.",
    };
  }

  try {
    const client = getTwilioClient(config);
    const message = await client.messages.create({
      from: config.fromPhoneNumber,
      to,
      body: messageBody,
    });
    return { success: true, sid: message.sid };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Twilio send failed.",
    };
  }
}
