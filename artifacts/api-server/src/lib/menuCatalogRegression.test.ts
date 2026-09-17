import assert from "node:assert/strict";
import test from "node:test";

import { filterVisibleRestaurantMenuCategories } from "./menuCategoryVisibility";
import {
  compareCustomerMenuEntries,
  compareProductsBySort,
  normalizeProductSort,
  normalizeProductSortDirection,
} from "./productOrdering";

test("GET /api/menu-categories keeps used global categories and legacy name matches only", () => {
  const categories = [
    { id: 1, restaurantId: null, name: "Burgers", isActive: true },
    { id: 2, restaurantId: null, name: "Legacy", isActive: true },
    { id: 3, restaurantId: null, name: "Empty", isActive: true },
    { id: 4, restaurantId: null, name: "Inactive", isActive: false },
    { id: 5, restaurantId: 42, name: "Restaurant-only", isActive: true },
    { id: 6, restaurantId: 99, name: "Other-restaurant", isActive: true },
  ];

  const visible = filterVisibleRestaurantMenuCategories(categories, [
    { menuItemCategoryId: 1, category: "Burgers" },
    { menuItemCategoryId: null, category: " legacy " },
  ], 42);

  assert.deepEqual(visible.map((category) => category.id), [1, 2, 5]);
});

test("backend product sort modes are deterministic and invalid values fall back to custom", () => {
  const products = [
    { id: 3, name: "Zaatar", price: 20, sortOrder: 2, createdAt: "2026-09-01T10:00:00Z" },
    { id: 2, name: "Burger", price: 50, sortOrder: 1, createdAt: "2026-09-03T10:00:00Z" },
    { id: 1, name: "Burger", price: 20, sortOrder: 1, createdAt: "2026-09-02T10:00:00Z" },
  ];
  const orderedIds = (sort: "custom" | "name" | "price" | "createdAt") =>
    [...products].sort((left, right) => compareProductsBySort(left, right, sort)).map((product) => product.id);

  assert.deepEqual(orderedIds("custom"), [1, 2, 3]);
  assert.deepEqual(orderedIds("name"), [1, 2, 3]);
  assert.deepEqual(orderedIds("price"), [1, 3, 2]);
  assert.deepEqual(orderedIds("createdAt"), [2, 1, 3]);
  assert.equal(normalizeProductSort("not-a-sort"), "custom");
  assert.equal(normalizeProductSort(undefined), "custom");
  assert.equal(normalizeProductSortDirection(undefined, "createdAt"), "desc");
  assert.equal(normalizeProductSortDirection("asc", "createdAt"), "asc");
  assert.deepEqual(
    [...products].sort((left, right) => compareProductsBySort(left, right, "price", "desc")).map((product) => product.id),
    [2, 3, 1],
  );
  assert.deepEqual(
    [...products].sort((left, right) => compareProductsBySort(
      { ...left, category: left.id === 1 ? "Burgers" : "Drinks", isAvailable: left.id !== 3, restaurantId: left.id === 2 ? 20 : 10 },
      { ...right, category: right.id === 1 ? "Burgers" : "Drinks", isAvailable: right.id !== 3, restaurantId: right.id === 2 ? 20 : 10 },
      "availability",
    )).map((product) => product.id),
    [3, 1, 2],
  );
});

test("custom product order uses only the saved rank and stable id tie-breaker", () => {
  const products = [
    { id: 9, name: "Alpha", price: 1, sortOrder: 4, createdAt: "2024-01-01T00:00:00Z" },
    { id: 3, name: "Zulu", price: 1, sortOrder: 4, createdAt: "2026-01-01T00:00:00Z" },
    { id: 8, name: "Beta", price: 1, sortOrder: 2, createdAt: "2025-01-01T00:00:00Z" },
  ];

  assert.deepEqual(
    [...products].sort((left, right) => compareProductsBySort(left, right, "custom")).map((product) => product.id),
    [8, 3, 9],
  );
});

test("customer menu order preserves custom product positions within a category", () => {
  const entries = [
    { id: 11, name: "Second", price: 20, sortOrder: 20, createdAt: "2026-09-03T10:00:00Z", category: "Burgers", menuItemCategoryId: 5, categorySortOrder: 1 },
    { id: 12, name: "First", price: 50, sortOrder: 10, createdAt: "2026-09-01T10:00:00Z", category: "Burgers", menuItemCategoryId: 5, categorySortOrder: 1 },
    { id: 13, name: "Drink", price: 10, sortOrder: 0, createdAt: "2026-09-04T10:00:00Z", category: "Drinks", menuItemCategoryId: 8, categorySortOrder: 2 },
  ];

  assert.deepEqual(
    [...entries].sort(compareCustomerMenuEntries).map((entry) => entry.id),
    [12, 11, 13],
  );
});

test("customer menu uses category id and product id only to break duplicate saved ranks", () => {
  const entries = [
    { id: 30, name: "Alpha", price: 1, sortOrder: 0, createdAt: "2026-01-03T00:00:00Z", category: "A", menuItemCategoryId: 12, categorySortOrder: 0 },
    { id: 20, name: "Zulu", price: 1, sortOrder: 0, createdAt: "2026-01-02T00:00:00Z", category: "Z", menuItemCategoryId: 11, categorySortOrder: 0 },
    { id: 10, name: "Newest", price: 1, sortOrder: 0, createdAt: "2026-01-04T00:00:00Z", category: "Z", menuItemCategoryId: 11, categorySortOrder: 0 },
  ];

  assert.deepEqual([...entries].sort(compareCustomerMenuEntries).map((entry) => entry.id), [10, 20, 30]);
});