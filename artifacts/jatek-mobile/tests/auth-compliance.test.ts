import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(resolve(testDirectory, path), "utf8");

test("password reset uses a mobile-safe, rate-limited six-digit flow", () => {
  const screen = source("../app/(auth)/forgot-password.tsx");
  const server = source("../../api-server/src/routes/auth.ts");

  assert.match(screen, /"X-Client": "mobile"/);
  assert.ok(screen.includes("/^\\d{6}$/"), "the reset screen must validate exactly six digits");
  assert.match(screen, /setResendCountdown\(60\)/);
  assert.match(screen, /Renvoyer le code/);
  assert.match(screen, /useLocalSearchParams/);
  assert.match(server, /const OTP_EXPIRY_MINUTES = 5/);
  assert.match(server, /const OTP_MAX_ATTEMPTS = 3/);
  assert.match(server, /const OTP_RATE_LIMIT_MINUTES = 1/);
  assert.match(server, /const codeHash = await bcrypt\.hash\(code, 10\)/);
  assert.match(server, /newPassword\.length < 8/);
  assert.match(server, /bcrypt\.compare\(suppliedCode, otpRecord\.code\)/);
});

test("reset deep link and public legal documents are reachable without login", () => {
  const layout = source("../app/(auth)/_layout.tsx");
  const appConfig = JSON.parse(source("../app.json")) as { expo?: { scheme?: string } };
  const welcome = source("../app/(auth)/welcome.tsx");
  const legal = source("../app/profile/legal.tsx");

  assert.match(layout, /name="forgot-password"/);
  assert.equal(appConfig.expo?.scheme, "jatek");
  assert.match(welcome, /profile\/legal\?type=privacy/);
  assert.match(welcome, /profile\/legal\?type=terms/);
  assert.match(legal, /getPublicAppConfig/);
});

test("account erasure remains available from the authenticated privacy screen", () => {
  const privacy = source("../app/profile/privacy.tsx");
  const api = source("../lib/api.ts");

  assert.match(privacy, /Supprimer mon compte/);
  assert.match(privacy, /deleteMyAccount/);
  assert.match(api, /export async function deleteMyAccount/);
  assert.match(api, /\/api\/me/);
});