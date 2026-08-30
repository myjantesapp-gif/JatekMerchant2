// OTP messaging with multi-provider fallback chain.
//
// Phone OTP (preferred): Twilio Verify Service
//   - env: TWILIO_ACCOUNT_SID + (TWILIO_API_KEY + TWILIO_AUTH_KEY
//     or legacy TWILIO_AUTH_TOKEN) + TWILIO_VERIFY_SID
//   - Sends WhatsApp OTP via Twilio Verify; Twilio manages code/expiry/rate-limit
//   - No DB entry needed for phone OTP when Verify is configured
//
// Phone OTP (legacy fallback — no Verify SID):
//   1. Twilio WhatsApp direct  (TWILIO_ACCOUNT_SID + Twilio credentials + TWILIO_WA_FROM)
//   2. Infobip WhatsApp        (INFOBIP_API_KEY + INFOBIP_BASE_URL + INFOBIP_WA_SENDER)
//
// Email: Resend (RESEND_API_KEY + RESEND_FROM_EMAIL)
//
// Twilio calls use the REST API directly (fetch) — no SDK dependency.

/**
 * Thrown when the phone number itself is the problem (not the provider
 * credentials or network connectivity). Callers return HTTP 400 so the user
 * sees an actionable French message rather than a generic "réessayez" prompt.
 */
export class OtpDestinationError extends Error {
  /** Provider error code for logging, e.g. Twilio 60212 or Infobip RECIPIENT_NOT_ON_CHANNEL. */
  providerCode?: string | number;
  constructor(message: string, providerCode?: string | number) {
    super(message);
    this.name = "OtpDestinationError";
    this.providerCode = providerCode;
  }
}

/**
 * Log startup warnings for obvious OTP provider misconfigurations.
 * Call once at server startup — never throws.
 */
export function logProviderConfigWarnings(): void {
  const verifySid = process.env.TWILIO_VERIFY_SID;
  if (verifySid && !verifySid.startsWith("VA")) {
    console.warn(
      `[OTP] TWILIO_VERIFY_SID="${verifySid.slice(0, 4)}…" does not start with "VA" — Twilio Verify will be skipped.`
    );
  }
  if ((verifySid || process.env.TWILIO_ACCOUNT_SID) && !getTwilioCredentials()) {
    console.warn(
      "[OTP] Twilio credentials are incomplete — set TWILIO_API_KEY + TWILIO_AUTH_KEY (or legacy TWILIO_AUTH_TOKEN)."
    );
  }
  const waFrom = process.env.TWILIO_WA_FROM;
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;
  if (isProduction && twilioConfigured() && !verifySid && (!waFrom || waFrom === "+14155238886")) {
    console.warn(
      `[OTP] TWILIO_WA_FROM is the Twilio sandbox number in production — only numbers that have opted in to the sandbox can receive messages.`
    );
  }
}

export type OtpChannel =
  | "infobip-whatsapp"
  | "twilio-whatsapp"
  | "resend-email";

export interface SendOtpResult {
  channel: OtpChannel;
  attempts: AttemptLog[];
}

export interface AttemptLog {
  channel: OtpChannel | "skipped";
  ok: boolean;
  reason?: string;
}

// ─── Infobip ──────────────────────────────────────────────────────────────────
function infobipBaseHost(): string | undefined {
  const raw = process.env.INFOBIP_BASE_URL || process.env.INFOBIP_URL;
  if (!raw) return undefined;
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function infobipConfigured(): boolean {
  return !!(process.env.INFOBIP_API_KEY && infobipBaseHost());
}

async function sendInfobipWhatsapp(to: string, body: string): Promise<void> {
  const apiKey = process.env.INFOBIP_API_KEY!;
  const baseUrl = infobipBaseHost()!;
  const from = process.env.INFOBIP_WA_SENDER;
  if (!from) throw new Error("INFOBIP_WA_SENDER not set");

  const url = `https://${baseUrl}/whatsapp/1/message/text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ from, to, content: { text: body } }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Try to classify destination-level errors from Infobip's structured response.
    try {
      const errJson = JSON.parse(errText);
      const msgId: string | undefined =
        errJson?.requestError?.serviceException?.messageId;
      const BAD_DEST_IDS = new Set([
        "RECIPIENT_NOT_ON_CHANNEL",
        "EC_OA_SND_ID_NOT_FOUND",
        "NOT_FOUND",
      ]);
      if (msgId && BAD_DEST_IDS.has(msgId)) {
        throw new OtpDestinationError(
          "Ce numéro n'est pas joignable sur WhatsApp. Vérifiez le numéro ou utilisez l'email.",
          msgId
        );
      }
    } catch (e) {
      if (e instanceof OtpDestinationError) throw e;
      // JSON parse failed — fall through to generic error
    }
    throw new Error(`Infobip WhatsApp ${res.status}: ${errText.slice(0, 200)}`);
  }
}

// ─── Twilio ───────────────────────────────────────────────────────────────────
// Direct REST API calls — no SDK dependency.
// Required env vars:
//   TWILIO_ACCOUNT_SID  → Account SID (AC...)
//   TWILIO_API_KEY      → API Key SID (SK...) and TWILIO_AUTH_KEY → API Key secret
//   (or legacy TWILIO_AUTH_TOKEN)
// Optional:
//   TWILIO_WA_FROM      → WhatsApp sender (default: Twilio sandbox +14155238886)

type TwilioCredentials = {
  username: string;
  password: string;
  mode: "api-key" | "auth-token";
};

function getTwilioCredentials(): TwilioCredentials | null {
  const apiKey = process.env.TWILIO_API_KEY;
  const authKey = process.env.TWILIO_AUTH_KEY;
  if (apiKey?.startsWith("SK") && authKey) {
    return { username: apiKey, password: authKey, mode: "api-key" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (accountSid && authToken) {
    return { username: accountSid, password: authToken, mode: "auth-token" };
  }

  return null;
}

export function twilioCredentialMode(): TwilioCredentials["mode"] | null {
  return getTwilioCredentials()?.mode ?? null;
}

export function twilioAuthHeader(): string {
  const credentials = getTwilioCredentials();
  if (!credentials) throw new Error("Twilio API credentials are not configured");
  return "Basic " + Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
}

function twilioConfigured(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  return !!(accountSid?.startsWith("AC") && getTwilioCredentials());
}

async function twilioPost(path: string, params: Record<string, string>): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: twilioAuthHeader(),
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any;
    throw new Error(
      `Twilio ${res.status}: ${data?.message ?? res.statusText}` +
      (data?.code ? ` (code ${data.code})` : "")
    );
  }
}

async function sendTwilioWhatsapp(to: string, body: string): Promise<void> {
  const rawFrom = process.env.TWILIO_WA_FROM || "+14155238886";
  const from    = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;
  const toWa    = to.startsWith("whatsapp:")     ? to       : `whatsapp:${to}`;

  // Inline fetch so we can inspect Twilio's error code and classify destination errors.
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: twilioAuthHeader(),
    },
    body: new URLSearchParams({ To: toWa, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any;
    const code = Number(data?.code ?? 0);
    // These Twilio error codes indicate the destination is invalid or not on WhatsApp.
    // 21211: Invalid 'To' phone number format
    // 21614: 'To' number not mobile (cannot receive WA)
    // 63016: Failed to send WhatsApp message (number not registered / not opted in)
    // 63018: WhatsApp capability not enabled on the 'From' number
    if ([21211, 21614, 63016, 63018].includes(code)) {
      throw new OtpDestinationError(
        "Ce numéro n'est pas joignable sur WhatsApp. Vérifiez le numéro ou utilisez l'email.",
        code
      );
    }
    throw new Error(
      `Twilio ${res.status}: ${data?.message ?? res.statusText}` +
      (code ? ` (code ${code})` : "")
    );
  }
}

// ─── Twilio Verify Service ────────────────────────────────────────────────────
// Preferred phone OTP path. Twilio manages code generation, storage, expiry,
// rate-limiting and multi-channel delivery. No DB row needed.
function twilioVerifyConfigured(): boolean {
  return !!(
    process.env.TWILIO_VERIFY_SID?.startsWith("VA") &&
    process.env.TWILIO_ACCOUNT_SID?.startsWith("AC") &&
    getTwilioCredentials()
  );
}

export async function sendTwilioVerify(to: string, channel: "whatsapp" | "sms" = "whatsapp"): Promise<void> {
  const sid = process.env.TWILIO_VERIFY_SID!;
  const url = `https://verify.twilio.com/v2/Services/${sid}/Verifications`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: twilioAuthHeader(),
    },
    body: new URLSearchParams({ To: to, Channel: channel }).toString(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any;
    const code = Number(data?.code ?? 0);
    // Twilio Verify destination-level errors — the number is invalid or not on WhatsApp.
    // 60200: Invalid parameter (usually bad phone format)
    // 60212: Recipient has not opted in / not registered on WhatsApp
    // 21211: Invalid 'To' phone number format
    // 63016: Failed to send WhatsApp message (not registered / not opted in)
    if ([60200, 60212, 21211, 63016].includes(code)) {
      throw new OtpDestinationError(
        "Ce numéro n'est pas joignable sur WhatsApp. Vérifiez le numéro ou utilisez l'email.",
        code
      );
    }
    throw new Error(
      `Twilio Verify send ${res.status}: ${data?.message ?? res.statusText}` +
      (code ? ` (code ${code})` : "")
    );
  }
}

export async function checkTwilioVerify(to: string, code: string): Promise<"approved" | "pending" | "expired"> {
  const sid = process.env.TWILIO_VERIFY_SID!;
  const url = `https://verify.twilio.com/v2/Services/${sid}/VerificationChecks`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: twilioAuthHeader(),
    },
    body: new URLSearchParams({ To: to, Code: code }).toString(),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) {
    // 404 means the verification was not found / already used / expired
    if (res.status === 404) return "expired";
    throw new Error(
      `Twilio Verify check ${res.status}: ${data?.message ?? res.statusText}` +
      (data?.code ? ` (code ${data.code})` : "")
    );
  }
  return data?.status === "approved" ? "approved" : "pending";
}

export { twilioConfigured, twilioVerifyConfigured };

// ─── Resend (email OTP) ───────────────────────────────────────────────────────
// RESEND_EMAIL_FROM is accepted as an alias for RESEND_FROM_EMAIL.
function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY;
}
function getResendFromEmail(): string | undefined {
  return process.env.RESEND_FROM_EMAIL || process.env.RESEND_EMAIL_FROM;
}
function resendConfigured(): boolean {
  return !!(getResendApiKey() && getResendFromEmail());
}

async function sendResendEmail(to: string, otp: string, fullBody: string, subject?: string): Promise<void> {
  const apiKey = getResendApiKey()!;
  const from = getResendFromEmail()!;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: subject ?? "Votre code de vérification Jatek",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
          <h2 style="color:#E91E63;margin:0 0 8px">Jatek</h2>
          <p style="color:#374151;margin:0 0 24px">Voici votre code de vérification :</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0A1B3D;
                      background:#F3F4F6;border-radius:8px;padding:16px 24px;
                      text-align:center;margin:0 0 24px">${otp}</div>
          <p style="color:#6B7280;font-size:13px;margin:0">
            Ce code est valable 5 minutes.<br>Ne le communiquez à personne.
          </p>
        </div>`,
      text: fullBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err.slice(0, 300)}`);
  }
}

// ─── Public: email OTP ────────────────────────────────────────────────────────
export async function sendOtpEmail(
  email: string,
  otp: string,
  body: string,
  subject?: string,
): Promise<SendOtpResult> {
  const attempts: AttemptLog[] = [];

  if (!resendConfigured()) {
    attempts.push({ channel: "resend-email", ok: false, reason: "not configured" });
    const summary = attempts.map((a) => `${a.channel}=${a.reason}`).join(" | ");
    throw new Error(`Email OTP provider not configured: ${summary}`);
  }

  try {
    await sendResendEmail(email, otp, body, subject);
    attempts.push({ channel: "resend-email", ok: true });
    console.info(`[OTP] sent via resend-email to ${email}`);
    return { channel: "resend-email", attempts };
  } catch (err: any) {
    const reason = err?.message ?? String(err);
    attempts.push({ channel: "resend-email", ok: false, reason });
    console.warn(`[OTP] resend-email failed for ${email}: ${reason}`);
    const summary = attempts.map((a) => `${a.channel}=${a.ok ? "ok" : a.reason}`).join(" | ");
    throw new Error(`Email OTP delivery failed: ${summary}`);
  }
}

// ─── Public: WhatsApp OTP ─────────────────────────────────────────────────────
// Phone OTP is WhatsApp-only. Provider failure is surfaced instead of sending SMS.
export async function sendOtpMessage(
  to: string,
  body: string
): Promise<SendOtpResult> {
  const attempts: AttemptLog[] = [];
  const infobipReady = infobipConfigured();
  const twilioReady = twilioConfigured();

  type Step = { channel: OtpChannel; available: boolean; fn: () => Promise<void> };
  const steps: Step[] = [
    // ── Twilio WhatsApp (primary) ────────────────────────────────────────────
    {
      channel: "twilio-whatsapp",
      available: twilioReady,
      fn: () => sendTwilioWhatsapp(to, body),
    },
    // ── Infobip WhatsApp (fallback) ──────────────────────────────────────────
    {
      channel: "infobip-whatsapp",
      available: infobipReady && !!process.env.INFOBIP_WA_SENDER,
      fn: () => sendInfobipWhatsapp(to, body),
    },
  ];

  let lastDestinationError: OtpDestinationError | null = null;

  for (const step of steps) {
    if (!step.available) {
      attempts.push({ channel: step.channel, ok: false, reason: "not configured" });
      continue;
    }
    try {
      await step.fn();
      attempts.push({ channel: step.channel, ok: true });
      console.info(`[OTP] sent via ${step.channel} to ${to}`);
      return { channel: step.channel, attempts };
    } catch (err: any) {
      if (err instanceof OtpDestinationError) lastDestinationError = err;
      const reason = err?.message ?? String(err);
      attempts.push({ channel: step.channel, ok: false, reason });
      console.warn(`[OTP] ${step.channel} failed for ${to}: ${reason}`);
    }
  }

  // If every provider that actually attempted a send reported a destination error,
  // re-throw it so the auth route can return a user-actionable 400 instead of 502.
  const attempted = attempts.filter((a) => a.reason !== "not configured");
  if (lastDestinationError && attempted.length > 0 && attempted.every((a) => !a.ok)) {
    throw lastDestinationError;
  }

  const summary = attempts
    .map((a) => `${a.channel}=${a.ok ? "ok" : a.reason}`)
    .join(" | ");
  throw new Error(`All OTP providers failed: ${summary}`);
}

export function anyOtpProviderConfigured(): boolean {
  return (
    twilioVerifyConfigured() ||
    twilioConfigured() ||
    infobipConfigured() ||
    resendConfigured()
  );
}
