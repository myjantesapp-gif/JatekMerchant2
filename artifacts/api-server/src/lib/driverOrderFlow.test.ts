import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDriverAcceptance,
  isDeliveryCodeExpired,
  isDeliveryCodeFormatValid,
  isValidDriverTransition,
  validateDeliveryCodeAttempt,
} from "./driverOrderFlow";

test("driver acceptance distinguishes a race from an idempotent retry", () => {
  assert.equal(classifyDriverAcceptance(null, 10), "claim");
  assert.equal(classifyDriverAcceptance({ id: 11, status: "ready" }, 10), "driver_has_active_order");
  assert.equal(classifyDriverAcceptance({ id: 10, status: "assigned" }, 10), "claim");
  assert.equal(classifyDriverAcceptance({ id: 10, status: "accepted" }, 10), "already_accepted");
});

test("driver transitions only advance through the delivery sequence", () => {
  assert.equal(isValidDriverTransition("accepted", "driver_at_restaurant"), true);
  assert.equal(isValidDriverTransition("driver_at_restaurant", "picked_up"), true);
  assert.equal(isValidDriverTransition("picked_up", "en_route"), true);
  assert.equal(isValidDriverTransition("en_route", "out_for_delivery"), true);
  assert.equal(isValidDriverTransition("accepted", "picked_up"), false);
  assert.equal(isValidDriverTransition("out_for_delivery", "delivered"), false);
  assert.equal(isValidDriverTransition("delivered", "out_for_delivery"), false);
});

test("delivery codes require exactly four digits and expire at their deadline", () => {
  const now = new Date("2026-09-04T12:00:00.000Z");
  assert.equal(isDeliveryCodeFormatValid("1234"), true);
  assert.equal(isDeliveryCodeFormatValid(" 1234 "), true);
  assert.equal(isDeliveryCodeFormatValid("123"), false);
  assert.equal(isDeliveryCodeFormatValid("12a4"), false);
  assert.equal(isDeliveryCodeFormatValid(""), false);
  assert.equal(isDeliveryCodeExpired(new Date("2026-09-04T12:00:01.000Z"), now), false);
  assert.equal(isDeliveryCodeExpired(new Date("2026-09-04T12:00:00.000Z"), now), true);
  assert.equal(isDeliveryCodeExpired(null, now), false);
});

test("delivery confirmation rejects wrong, expired, and already-used codes", () => {
  const now = new Date("2026-09-04T12:00:00.000Z");
  const base = {
    status: "out_for_delivery",
    pickupCode: "1234",
    pickupCodeUsedAt: null,
    pickupCodeExpiresAt: new Date("2026-09-04T13:00:00.000Z"),
  };
  assert.deepEqual(validateDeliveryCodeAttempt({ ...base, enteredCode: "9999" }, now), {
    ok: false,
    status: 400,
    code: "INVALID_PICKUP_CODE",
    message: "Incorrect pickup code",
  });
  assert.deepEqual(validateDeliveryCodeAttempt({
    ...base,
    enteredCode: "1234",
    pickupCodeExpiresAt: new Date("2026-09-04T11:59:59.000Z"),
  }, now), {
    ok: false,
    status: 410,
    code: "DELIVERY_CODE_EXPIRED",
    message: "Le code de livraison a expiré. Demandez un nouveau code au client.",
  });
  assert.deepEqual(validateDeliveryCodeAttempt({
    ...base,
    enteredCode: "1234",
    pickupCodeUsedAt: new Date("2026-09-04T11:00:00.000Z"),
  }, now), {
    ok: false,
    status: 409,
    code: "DELIVERY_CODE_ALREADY_USED",
    message: "Cette livraison a déjà été confirmée. Le code a déjà été utilisé.",
  });
  assert.deepEqual(validateDeliveryCodeAttempt({ ...base, enteredCode: "1234" }, now), { ok: true });
});