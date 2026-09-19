import assert from "node:assert/strict";
import test from "node:test";
import {
  OtpDestinationError,
  sendOtpEmail,
  sendOtpMessage,
  sendTwilioVerify,
  twilioCredentialMode,
  twilioSmsConfigured,
} from "./otpMessaging.js";

const credentialEnv = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_ACC_SID",
  "TWILIO_API_KEY",
  "TWILIO_API_SECRET",
  "TWILIO_AUTH_KEY",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_SEC_KEY",
  "TWILIO_VERIFY_SID",
  "TWILIO_FROM_NUMBER",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_SMS_FROM",
  "RESEND_API_KEY",
  "RESEND_API_KEY_2",
  "RESEND_API_KEY_3",
  "RESEND_FROM_EMAIL",
  "RESEND_FROM_EMAIL_2",
  "RESEND_FROM_EMAIL_3",
  "RESEND_EMAIL_FROM",
  "RESEND_EMAIL_FROM_2",
  "RESEND_EMAIL_FROM_3",
] as const;

function withEnv(values: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map(credentialEnv.map((key) => [key, process.env[key]]));
  for (const key of credentialEnv) {
    if (key in values) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }

  return fn().finally(() => {
    for (const key of credentialEnv) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Twilio Verify always requests an SMS verification", async () => {
  await withEnv({
    TWILIO_ACC_SID: "ACtest-account",
    TWILIO_SEC_KEY: "test-auth-token",
    TWILIO_VERIFY_SID: "VAtest-service",
  }, async () => {
    const originalFetch = globalThis.fetch;
    let request: { url: string; body: string } | undefined;
    globalThis.fetch = (async (input, init) => {
      request = { url: String(input), body: String(init?.body ?? "") };
      return jsonResponse({ status: "pending" });
    }) as typeof fetch;

    try {
      await sendTwilioVerify("+212600000000");
      assert.ok(request);
      assert.match(request.url, /verify\.twilio\.com\/v2\/Services\/VAtest-service\/Verifications$/);
      assert.equal(new URLSearchParams(request.body).get("To"), "+212600000000");
      assert.equal(new URLSearchParams(request.body).get("Channel"), "sms");
      assert.equal(twilioCredentialMode(), "auth-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("direct Twilio SMS fallback sends the locally generated message body", async () => {
  await withEnv({
    TWILIO_ACCOUNT_SID: "ACtest-account",
    TWILIO_API_KEY: "SKtest-key",
    TWILIO_AUTH_KEY: "test-api-secret",
    TWILIO_FROM_NUMBER: "+212500000000",
  }, async () => {
    const originalFetch = globalThis.fetch;
    let request: { url: string; body: string } | undefined;
    globalThis.fetch = (async (input, init) => {
      request = { url: String(input), body: String(init?.body ?? "") };
      return jsonResponse({ sid: "SMtest-message" });
    }) as typeof fetch;

    try {
      assert.equal(twilioSmsConfigured(), true);
      const result = await sendOtpMessage("+212611111111", "Votre code Jatek : 123456");
      assert.equal(result.channel, "twilio-sms");
      assert.ok(request);
      assert.match(request.url, /\/Accounts\/ACtest-account\/Messages\.json$/);
      const body = new URLSearchParams(request.body);
      assert.equal(body.get("To"), "+212611111111");
      assert.equal(body.get("From"), "+212500000000");
      assert.equal(body.get("Body"), "Votre code Jatek : 123456");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("SMS destination errors remain actionable without another delivery channel", async () => {
  await withEnv({
    TWILIO_ACCOUNT_SID: "ACtest-account",
    TWILIO_AUTH_TOKEN: "test-auth-token",
    TWILIO_FROM_NUMBER: "+212500000000",
  }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => jsonResponse({
      code: 30006,
      message: "Landline or unreachable destination",
    }, 400)) as typeof fetch;

    try {
      await assert.rejects(
        () => sendOtpMessage("+212611111111", "Votre code Jatek : 123456"),
        (error: unknown) =>
          error instanceof OtpDestinationError &&
          error.message.includes("SMS"),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("email OTP uses only the third Resend key/sender pair", async () => {
  await withEnv({
    RESEND_API_KEY: "key-1",
    RESEND_FROM_EMAIL: "one@other.example",
    RESEND_API_KEY_2: "key-2",
    RESEND_FROM_EMAIL_2: "two@other.example",
    RESEND_API_KEY_3: "key-3",
    RESEND_EMAIL_FROM_3: "Jatek <no-reply@ma.jatek.app>",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const attempts: Array<{ authorization: string; from: string }> = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { from?: string };
      attempts.push({
        authorization: String(new Headers(init?.headers).get("authorization") ?? ""),
        from: String(body.from ?? ""),
      });
      return jsonResponse({ id: "email-test" });
    }) as typeof fetch;

    try {
      const result = await sendOtpEmail(
        "customer@example.test",
        "123456",
        "Votre code Jatek : 123456",
      );
      assert.equal(result.channel, "resend-email");
      assert.deepEqual(attempts, [
        { authorization: "Bearer key-3", from: "Jatek <no-reply@ma.jatek.app>" },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("email OTP refuses a sender outside ma.jatek.app", async () => {
  await withEnv({
    RESEND_API_KEY_3: "key-3",
    RESEND_EMAIL_FROM_3: "no-reply@other.example",
  }, async () => {
    await assert.rejects(
      () => sendOtpEmail("customer@example.test", "123456", "Votre code Jatek : 123456"),
      /Email OTP provider not configured/,
    );
  });
});