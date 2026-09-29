import assert from "node:assert/strict";
import test from "node:test";
import {
  employeeMayCloseShop,
  parseEmployeeCloseTimes,
  validateCancellationReason,
} from "./employeeShopPermissions.js";

test("employees may update only closing times with valid unique weekdays", () => {
  assert.deepEqual(parseEmployeeCloseTimes({
    hours: [{ dayOfWeek: 1, closeTime: "21:45" }, { dayOfWeek: 5, closeTime: "23:00" }],
  }), {
    ok: true,
    hours: [{ dayOfWeek: 1, closeTime: "21:45" }, { dayOfWeek: 5, closeTime: "23:00" }],
  });

  assert.equal(parseEmployeeCloseTimes({ hours: [{ dayOfWeek: 1, openTime: "09:00", closeTime: "21:45" }] }).ok, false);
  assert.equal(parseEmployeeCloseTimes({ hours: [{ dayOfWeek: 1, closeTime: "25:00" }] }).ok, false);
  assert.equal(parseEmployeeCloseTimes({ hours: [{ dayOfWeek: 1, closeTime: "21:45" }, { dayOfWeek: 1, closeTime: "22:00" }] }).ok, false);
  assert.equal(parseEmployeeCloseTimes({ hours: [{ dayOfWeek: 1, closeTime: "21:45" }], shopId: 1 }).ok, false);
});

test("employees can only set the assigned shop to closed", () => {
  assert.equal(employeeMayCloseShop({ isOpen: false }), true);
  assert.equal(employeeMayCloseShop({ isOpen: true }), false);
  assert.equal(employeeMayCloseShop({ isOpen: false, name: "Other shop" }), false);
  assert.equal(employeeMayCloseShop(null), false);
});

test("rejection reasons are accepted only for cancelled orders", () => {
  assert.deepEqual(validateCancellationReason("cancelled", "Indisponible"), { ok: true, reason: "Indisponible" });
  assert.equal(validateCancellationReason("accepted", "Indisponible").ok, false);
  assert.deepEqual(validateCancellationReason("cancelled"), { ok: true, reason: undefined });
});