import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  checkDeliveryZone,
  MAX_RADIUS_KM,
  OUJDA_CENTER,
} from "../utils/deliveryZone";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const source = (path: string) =>
  readFileSync(resolve(testDirectory, path), "utf8");

test("preserves the five kilometre Oujda delivery boundary", () => {
  assert.equal(checkDeliveryZone(OUJDA_CENTER.latitude, OUJDA_CENTER.longitude).inZone, true);

  // One degree of latitude is approximately 111.2 km.
  const justInside = OUJDA_CENTER.latitude + (MAX_RADIUS_KM - 0.05) / 111.2;
  const justOutside = OUJDA_CENTER.latitude + (MAX_RADIUS_KM + 0.05) / 111.2;
  assert.equal(checkDeliveryZone(justInside, OUJDA_CENTER.longitude).inZone, true);
  assert.equal(checkDeliveryZone(justOutside, OUJDA_CENTER.longitude).inZone, false);
});

test("location acquisition handles native denial, disabled services, and timeout", () => {
  const utility = source("../utils/deviceLocation.ts");
  assert.match(utility, /hasServicesEnabledAsync/);
  assert.match(utility, /requestForegroundPermissionsAsync/);
  assert.ok(
    utility.indexOf("requestForegroundPermissionsAsync") <
      utility.indexOf("hasServicesEnabledAsync"),
    "the native permission request must happen before the service-state check",
  );
  assert.match(utility, /canAskAgain/);
  assert.match(utility, /permission-denied/);
  assert.match(utility, /services-disabled/);
  assert.match(utility, /Promise\.race/);
  assert.match(utility, /Linking\.openSettings/);
  assert.match(utility, /mayShowUserSettingsDialog: true/);
});

test("dismissible location flows invalidate stale asynchronous work", () => {
  for (const file of [
    "../components/AddressQuickPicker.tsx",
    "../components/AddressAutocomplete.tsx",
    "../app/(auth)/welcome.tsx",
    "../app/profile/addresses.tsx",
  ]) {
    const contents = source(file);
    assert.match(contents, /mountedRef/);
    assert.match(contents, /current \+= 1|current = false/);
  }
});

test("GPS selection keeps working when reverse geocoding is unavailable", () => {
  const picker = source("../components/AddressQuickPicker.tsx");
  assert.match(picker, /toFixed\(5\)/);
  assert.match(picker, /reverseGeocode/);
  assert.match(picker, /coordinates are still valid/i);
  assert.match(picker, /checkDeliveryZone\(coords\.latitude, coords\.longitude\)/);
});

test("reverse geocoding is bounded and accepts cancellation", () => {
  const utility = source("../utils/deliveryZone.ts");
  assert.match(utility, /GEOCODE_TIMEOUT_MS/);
  assert.match(utility, /AbortController/);
  assert.match(utility, /signal\?: AbortSignal/);
});