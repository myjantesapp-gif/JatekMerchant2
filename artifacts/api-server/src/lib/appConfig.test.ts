import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HOME_SECTIONS,
  getDefaultHomeSections,
  homeSectionsSchema,
  validateHomeSections,
  splashLogoUrlSchema,
  splashVideoUrlSchema,
  appConfigPatchSchema,
  getDefaultLegalContent,
} from "./appConfig";
import { normalizeStoredMediaPath } from "./objectStorage";

test("Home section defaults have the complete typed contract", () => {
  assert.deepEqual(getDefaultHomeSections(), DEFAULT_HOME_SECTIONS);
  assert.deepEqual(Object.keys(DEFAULT_HOME_SECTIONS), [
    "categories",
    "banners",
    "shorts",
    "recommended_products",
    "recommended_restaurants",
    "popular",
    "new_products",
    "new_restaurants",
    "supermarkets",
    "shops",
    "all",
    "free_delivery",
    "newest",
    "support",
  ]);
  for (const section of Object.values(DEFAULT_HOME_SECTIONS)) {
    assert.deepEqual(Object.keys(section).sort(), ["limit", "source", "title", "visible"]);
  }
});

test("startup video accepts only direct MP4 or managed splash media and supports clearing", () => {
  for (const value of ["", "/api/storage/objects/splash/abc-123", "/api/storage/objects/splash/abc-123?version=2",
    "https://cdn.example.com/intro.mp4?version=2"]) {
    assert.equal(splashVideoUrlSchema.safeParse(value).success, true, value);
  }
  for (const value of [null, 42, "https://", "https://youtube.com/watch?v=123", "http://cdn.example.com/intro.mp4",
    "/api/storage/objects/splash/../secret", "/api/storage/objects/splash/abc#fragment",
    "https://name:password@example.com/intro.mp4"]) {
    assert.equal(splashVideoUrlSchema.safeParse(value).success, false, String(value));
  }
});

test("startup logo accepts only direct image URLs or managed splash media", () => {
  for (const value of ["", "/api/storage/objects/splash/logo.png", "/api/storage/objects/splash/logo.webp?version=2",
    "https://cdn.example.com/logo.png"]) {
    assert.equal(splashLogoUrlSchema.safeParse(value).success, true, value);
  }
  for (const value of [null, 42, "https://", "http://cdn.example.com/logo.png",
    "https://youtube.com/watch?v=123", "/api/storage/objects/splash/logo.mp4",
    "https://name:password@example.com/logo.png"]) {
    assert.equal(splashLogoUrlSchema.safeParse(value).success, false, String(value));
  }
});

test("normalized managed startup URLs remain valid when they contain a query", () => {
  const normalized = normalizeStoredMediaPath("https://ma.jatek.app/api/storage/objects/splash/intro?version=2");
  assert.equal(normalized, "/api/storage/objects/splash/intro?version=2");
  assert.equal(splashVideoUrlSchema.parse(normalized), normalized);
});

test("Home section config rejects missing, extra and invalid fields", () => {
  const valid = getDefaultHomeSections();
  assert.deepEqual(validateHomeSections(valid), valid);
  assert.equal(homeSectionsSchema.safeParse({
    ...valid,
    popular: { ...valid.popular, limit: 0 },
  }).success, false);
  assert.equal(homeSectionsSchema.safeParse({
    ...valid,
    shops: { ...valid.shops, visible: "yes" },
  }).success, false);
  assert.equal(homeSectionsSchema.safeParse({
    ...valid,
    new_products: { ...valid.new_products, source: "all" },
  }).success, false);
  assert.equal(homeSectionsSchema.safeParse({
    ...valid,
    extra: valid.popular,
  }).success, false);
});

test("legal defaults stay generic and provider-specific mentions are rejected", () => {
  const defaults = getDefaultLegalContent();
  assert.equal(JSON.stringify(defaults).toLowerCase().includes("replit"), false);
  const mentions = defaults.mentions as {
    sections: Array<{ h: string; p: string }>;
  };
  assert.equal(appConfigPatchSchema.safeParse({
    legalContent: {
      ...defaults,
      mentions: {
        ...defaults.mentions,
        sections: mentions.sections.map((section, index) =>
          index === 0 ? { ...section, p: "Hébergé par Replit." } : section,
        ),
      },
    },
  }).success, false);
});

test("app configuration patch rejects unknown keys", () => {
  assert.equal(appConfigPatchSchema.safeParse({ unsupported: true }).success, false);
});