/**
 * Non-destructive Twilio configuration check.
 *
 * Usage:
 *   node scripts/test-twilio-config.mjs
 *   node scripts/test-twilio-config.mjs --send-whatsapp +2126XXXXXXXX
 *
 * The default command only authenticates and reads the Verify Service. The
 * optional flag sends a real OTP and must be used explicitly.
 */

const env = (name) => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const accountSid = env("TWILIO_ACCOUNT_SID");
const verifySid = env("TWILIO_VERIFY_SID");
const apiKey = env("TWILIO_API_KEY");
const apiSecret = env("TWILIO_API_SECRET") || env("TWILIO_AUTH_KEY");
const authToken = env("TWILIO_AUTH_TOKEN");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

if (!accountSid?.startsWith("AC")) fail("TWILIO_ACCOUNT_SID absent ou invalide (préfixe AC attendu)");
if (!verifySid?.startsWith("VA")) fail("TWILIO_VERIFY_SID absent ou invalide (préfixe VA attendu)");
if (apiKey && !apiKey.startsWith("SK")) fail("TWILIO_API_KEY invalide (préfixe SK attendu)");

let username;
let password;
let mode;
if (apiKey && apiSecret) {
  username = apiKey;
  password = apiSecret;
  mode = "API Key";
} else if (accountSid && authToken) {
  username = accountSid;
  password = authToken;
  mode = "Auth Token legacy";
} else {
  fail("Credentials Twilio incomplets : TWILIO_API_KEY + TWILIO_AUTH_KEY requis");
}

if (process.exitCode) process.exit();

const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
const headers = { Authorization: authHeader, Accept: "application/json" };

async function getJson(url) {
  const response = await fetch(url, { headers });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

console.log(`🔐 Mode d'authentification : ${mode}`);

const accountResult = await getJson(
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
);
if (!accountResult.response.ok) {
  fail(`Compte Twilio inaccessible (${accountResult.response.status}, code ${accountResult.data?.code ?? "unknown"})`);
} else {
  console.log("✅ Account SID et credentials acceptés");
}

const verifyResult = await getJson(
  `https://verify.twilio.com/v2/Services/${verifySid}`,
);
if (!verifyResult.response.ok) {
  fail(`Twilio Verify inaccessible (${verifyResult.response.status}, code ${verifyResult.data?.code ?? "unknown"})`);
} else {
  console.log(`✅ Service Verify accessible (${verifyResult.data?.friendly_name ?? "nom masqué"})`);
}

const sendIndex = process.argv.indexOf("--send-whatsapp");
if (sendIndex !== -1) {
  const to = process.argv[sendIndex + 1];
  if (!to) {
    fail("Numéro manquant après --send-whatsapp");
    process.exit();
  }

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, Channel: "whatsapp" }).toString(),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`Envoi WhatsApp Verify échoué (${response.status}, code ${data?.code ?? "unknown"}): ${data?.message ?? "erreur Twilio"}`);
  } else {
    console.log(`✅ OTP WhatsApp demandé (statut ${data?.status ?? "unknown"})`);
  }
} else {
  console.log("ℹ️ Aucun OTP envoyé. Utilisez --send-whatsapp +212... pour un test réel.");
}