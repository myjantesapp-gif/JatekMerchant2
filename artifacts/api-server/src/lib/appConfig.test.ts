import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HOME_SECTIONS,
  getDefaultHomeSections,
  homeSectionsSchema,
  validateHomeSections,
} from "./appConfig";

test("Home section defaults have the complete typed contract", () => {
  assert.deepEqual(getDefaultHomeSections(), DEFAULT_HOME_SECTIONS);
  assert.deepEqual(Object.keys(DEFAULT_HOME_SECTIONS), [
    "popular",
    "new_products",
    "new_restaurants",
    "shops",
  ]);
  for (const section of Object.values(DEFAULT_HOME_SECTIONS)) {
    assert.deepEqual(Object.keys(section).sort(), ["limit", "source", "title", "visible"]);
  }
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