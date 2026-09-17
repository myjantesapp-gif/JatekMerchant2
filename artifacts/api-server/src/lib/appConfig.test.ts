import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HOME_SECTIONS,
  getDefaultHomeSections,
  homeSectionsSchema,
  validateHomeSections,
  splashVideoUrlSchema,
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