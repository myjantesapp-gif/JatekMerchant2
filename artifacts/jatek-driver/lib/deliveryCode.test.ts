import assert from "node:assert/strict";
import test from "node:test";
import { isDeliveryCodeValid, normalizeDeliveryCode } from "./deliveryCode";

test("driver delivery code input keeps only a four-digit OTP", () => {
  assert.equal(normalizeDeliveryCode("1a2-34"), "1234");
  assert.equal(normalizeDeliveryCode("12345"), "1234");
  assert.equal(isDeliveryCodeValid("1234"), true);
  assert.equal(isDeliveryCodeValid("123"), false);
  assert.equal(isDeliveryCodeValid("12a4"), false);
  assert.equal(isDeliveryCodeValid(""), false);
});