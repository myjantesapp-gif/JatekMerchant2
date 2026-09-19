// OTP messaging with multi-provider fallback chain.
//
// Phone OTP (preferred): Twilio Verify Service over SMS
//   - env: TWILIO_ACCOUNT_SID (or TWILIO_ACC_SID) +
//     TWILIO_API_KEY + TWILIO_API_SECRET (or TWILIO_SEC_KEY/TWILIO_AUTH_KEY)
//     or Account SID + TWILIO_AUTH_TOKEN/TWILIO_SEC_KEY, plus TWILIO_VERIFY_SID
//   - Twilio manages code generation, expiry, rate-limit and SMS delivery
//   - No DB entry is needed for the code when Verify is configured; a marker
//     row still binds the verification request to the local auth flow.
//
// Phone OTP (fallback — no Verify SID or Verify unavailable):
//   - Twilio SMS direct (Twilio credentials + TWILIO_FROM_NUMBER or
//     TWILIO_PHONE_NUMBER), with a locally hashed code and expiry
//
// Email: Resend (RESEND_API_KEY_3 + RESEND_EMAIL_FROM_3 only)
//
// Twilio calls use the REST API directly (fetch) — no SDK dependency.

/**
 * Thrown when the phone number itself is the problem (not the provider
 * credentials or network connectivity). Callers return HTTP 400 so the user
 * sees an actionable French message rather than a generic "réessayez" prompt.
 */
export class OtpDestinationError extends Error {
  /** Provider error code for logging, e.g. a Twilio destination error code. */
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
  const verifySid = twilioEnv("TWILIO_VERIFY_SID");
  if (verifySid && !verifySid.startsWith("VA")) {
    console.warn(
      `[OTP] TWILIO_VERIFY_SID="${verifySid.slice(0, 4)}…" does not start with "VA" — Twilio Verify will be skipped.`
    );
  }
  if ((verifySid || twilioAccountSid()) && !getTwilioCredentials()) {
    console.warn(
      "[OTP] Twilio credentials are incomplete — set the configured Twilio API key/secret or Auth Token."
    );
  }
  if (!verifySid && twilioConfigured() && !twilioSmsFrom()) {
    console.warn(
      "[OTP] Direct Twilio SMS fallback is unavailable — set TWILIO_FROM_NUMBER or TWILIO_PHONE_NUMBER."
    );
  }
}

export type OtpChannel =
  | "twilio-sms"
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

// ─── Twilio ───────────────────────────────────────────────────────────────────
// Direct REST API calls — no SDK dependency.
// Required env vars:
//   TWILIO_ACCOUNT_SID or TWILIO_ACC_SID → Account SID (AC...)
//   TWILIO_API_KEY      → API Key SID (SK...) and TWILIO_API_SECRET
//     (preferred) or TWILIO_SEC_KEY/TWILIO_AUTH_KEY → API Key secret
//   (or TWILIO_AUTH_TOKEN/TWILIO_SEC_KEY as an Account SID auth token)
//   TWILIO_FROM_NUMBER or TWILIO_PHONE_NUMBER → SMS sender for direct fallback

type TwilioCredentials = {
  username: string;
  password: string;
  mode: "api-key" | "auth-token";
};

function twilioEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function twilioAccountSid(): string | undefined {
  return twilioEnv("TWILIO_ACCOUNT_SID") || twilioEnv("TWILIO_ACC_SID");
}

function getTwilioCredentials(): TwilioCredentials | null {
  const apiKey = twilioEnv("TWILIO_API_KEY");
  const sharedSecret = twilioEnv("TWILIO_SEC_KEY");
  const apiSecret =
    twilioEnv("TWILIO_API_SECRET") ||
    twilioEnv("TWILIO_AUTH_KEY") ||
    (apiKey ? sharedSecret : undefined);
  if (apiKey?.startsWith("SK") && apiSecret) {
    return { username: apiKey, password: apiSecret, mode: "api-key" };
  }

  const accountSid = twilioAccountSid();
  const authToken = twilioEnv("TWILIO_AUTH_TOKEN") || (!apiKey ? sharedSecret : undefined);
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
  const accountSid = twilioAccountSid();
  return !!(accountSid?.startsWith("AC") && getTwilioCredentials());
}

function twilioSmsFrom(): string | undefined {
  return (
    twilioEnv("TWILIO_FROM_NUMBER") ||
    twilioEnv("TWILIO_PHONE_NUMBER") ||
    twilioEnv("TWILIO_SMS_FROM")
  );
}

export function twilioSmsConfigured(): boolean {
  return twilioConfigured() && !!twilioSmsFrom();
}

async function sendTwilioSms(to: string, body: string): Promise<void> {
  const accountSid = twilioAccountSid()!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const from = twilioSmsFrom()!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: twilioAuthHeader(),
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any;
    const code = Number(data?.code ?? 0);
    // These Twilio error codes indicate the destination cannot receive SMS.
    // 21211: invalid phone number, 21614: not a mobile number,
    // 30003/30005/30006: unreachable, unknown or landline destination.
    if ([21211, 21614, 30003, 30005, 30006].includes(code)) {
      throw new OtpDestinationError(
        "Ce numéro ne peut pas recevoir de SMS. Vérifiez le numéro ou utilisez l'email.",
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
// rate-limiting and SMS delivery. No DB code row is needed.
function twilioVerifyConfigured(): boolean {
  return !!(
    twilioEnv("TWILIO_VERIFY_SID")?.startsWith("VA") &&
    twilioAccountSid()?.startsWith("AC") &&
    getTwilioCredentials()
  );
}

export async function sendTwilioVerify(to: string): Promise<void> {
  const sid = twilioEnv("TWILIO_VERIFY_SID")!;
  const url = `https://verify.twilio.com/v2/Services/${sid}/Verifications`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: twilioAuthHeader(),
    },
    body: new URLSearchParams({ To: to, Channel: "sms" }).toString(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any;
    const code = Number(data?.code ?? 0);
    // Twilio Verify destination-level errors for SMS.
    // 60200: invalid parameter, 21211: invalid phone format,
    // 21614: destination is not a mobile number.
    if ([60200, 21211, 21614].includes(code)) {
      throw new OtpDestinationError(
        "Ce numéro ne peut pas recevoir de SMS. Vérifiez le numéro ou utilisez l'email.",
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
  const sid = twilioEnv("TWILIO_VERIFY_SID")!;
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
const RESEND_ALLOWED_DOMAIN = "ma.jatek.app";

type ResendConfig = {
  apiKey: string;
  from: string;
  label: string;
};

function resendSenderUsesAllowedDomain(from: string): boolean {
  const match = from.match(/<\s*([^>\s]+)\s*>/);
  const email = (match?.[1] ?? from).trim();
  const atIndex = email.lastIndexOf("@");
  return atIndex > 0 && email.slice(atIndex + 1).toLowerCase() === RESEND_ALLOWED_DOMAIN;
}

function getResendConfigs(): ResendConfig[] {
  const apiKey = process.env.RESEND_API_KEY_3?.trim();
  const from = process.env.RESEND_EMAIL_FROM_3?.trim();
  if (!apiKey || !from || !resendSenderUsesAllowedDomain(from)) return [];

  return [{ apiKey, from, label: "resend-email-ma-jatek" }];
}

function resendConfigured(): boolean {
  return getResendConfigs().length > 0;
}

async function sendResendEmail(
  config: ResendConfig,
  to: string,
  otp: string,
  fullBody: string,
  subject?: string,
): Promise<void> {
  const { apiKey, from } = config;

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
  const configs = getResendConfigs();

  if (configs.length === 0) {
    attempts.push({ channel: "resend-email", ok: false, reason: "not configured" });
    const summary = attempts.map((a) => `${a.channel}=${a.reason}`).join(" | ");
    throw new Error(`Email OTP provider not configured: ${summary}`);
  }

  for (const config of configs) {
    try {
      await sendResendEmail(config, email, otp, body, subject);
      attempts.push({ channel: "resend-email", ok: true });
      console.info(`[OTP] sent via ${config.label} to ${email}`);
      return { channel: "resend-email", attempts };
    } catch (err: any) {
      const reason = err?.message ?? String(err);
      attempts.push({ channel: config.label as OtpChannel, ok: false, reason });
      console.warn(`[OTP] ${config.label} failed for ${email}: ${reason}`);
    }
  }

  const summary = attempts.map((a) => `${a.channel}=${a.ok ? "ok" : a.reason}`).join(" | ");
  throw new Error(`Email OTP delivery failed: ${summary}`);
}

// ─── Public: SMS OTP fallback ─────────────────────────────────────────────────
// This path always stores/verifies a local hashed code in auth.ts. It is used
// when Verify is unavailable or not configured.
export async function sendOtpMessage(
  to: string,
  body: string
): Promise<SendOtpResult> {
  const attempts: AttemptLog[] = [];
  const twilioReady = twilioSmsConfigured();

  type Step = { channel: OtpChannel; available: boolean; fn: () => Promise<void> };
  const steps: Step[] = [
    // ── Twilio SMS ────────────────────────────────────────────────────────────
    {
      channel: "twilio-sms",
      available: twilioReady,
      fn: () => sendTwilioSms(to, body),
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
    twilioSmsConfigured() ||
    resendConfigured()
  );
}
