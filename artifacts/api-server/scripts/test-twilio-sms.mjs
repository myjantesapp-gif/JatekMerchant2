/**
 * Test SMS sending via Twilio REST API (env vars).
 * Usage: node scripts/test-twilio-sms.mjs [phone_number]
 */

const TO_NUMBER = process.argv[2] || "+212666711202";

const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACC_SID;
const apiKey = process.env.TWILIO_API_KEY;
const sharedSecret = process.env.TWILIO_SEC_KEY;
const authKey = process.env.TWILIO_AUTH_KEY || (apiKey ? sharedSecret : undefined);
const authToken = process.env.TWILIO_AUTH_TOKEN || (!apiKey ? sharedSecret : undefined);
const fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

if (!accountSid) { console.error("❌ TWILIO_ACCOUNT_SID or TWILIO_ACC_SID not set"); process.exit(1); }
if (!((apiKey && authKey) || (accountSid && authToken))) {
  console.error("❌ Twilio credentials not set (API key/secret or Account SID/Auth Token required)");
  process.exit(1);
}
if (!fromNumber) { console.error("❌ TWILIO_FROM_NUMBER or TWILIO_PHONE_NUMBER not set"); process.exit(1); }

const username = apiKey && authKey ? apiKey : accountSid;
const password = apiKey && authKey ? authKey : authToken;

console.log(`📡 Account SID : ${accountSid.slice(0, 6)}...`);
console.log(`📞 From        : ${fromNumber}`);
console.log(`📱 To          : ${TO_NUMBER}`);

const body = new URLSearchParams({
  To:   TO_NUMBER,
  From: fromNumber,
  Body: "Test Jatek OTP : 123456 (ceci est un message de test)",
});

const res = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
    },
    body: body.toString(),
  }
);

const data = await res.json();

if (!res.ok) {
  console.error(`\n❌ Envoi échoué (${res.status})`);
  console.error(`   Code  : ${data.code}`);
  console.error(`   Msg   : ${data.message}`);
  console.error(`   More  : ${data.more_info}`);
  process.exit(1);
}

console.log(`\n✅ SMS envoyé avec succès !`);
console.log(`   SID    : ${data.sid}`);
console.log(`   Status : ${data.status}`);
console.log(`   To     : ${data.to}`);
console.log(`   From   : ${data.from}`);
