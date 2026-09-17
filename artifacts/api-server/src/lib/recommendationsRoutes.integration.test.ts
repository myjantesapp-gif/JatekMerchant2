import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";

import {
  db,
  menuItemCategoriesTable,
  menuItemsTable,
  pool,
  restaurantsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

import app from "../app";

type Fixture = {
  userIds: number[];
  restaurantIds: number[];
  categoryIds: number[];
  businessType: string;
  productIds: {
    eligibleGlobal: number;
    eligibleOwn: number;
    unavailable: number;
    noImage: number;
    foreignCategory: number;
    closedMerchant: number;
    unverifiedMerchant: number;
    inactiveOwner: number;
  };
};

let fixture: Fixture;
let server: Server;
let baseUrl: string;

async function requestJson(path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: await response.json() };
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const businessType = `recommendation-${suffix}`;
  const users = await db.insert(usersTable).values([
    {
      name: `Recommendation active owner ${suffix}`,
      email: `recommendation-active-${suffix}@example.test`,
      password: "not-used-by-this-test",
      role: "restaurant_owner",
      isActive: true,
    },
    {
      name: `Recommendation closed owner ${suffix}`,
      email: `recommendation-closed-${suffix}@example.test`,
      password: "not-used-by-this-test",
      role: "restaurant_owner",
      isActive: true,
    },
    {
      name: `Recommendation unverified owner ${suffix}`,
      email: `recommendation-unverified-${suffix}@example.test`,
      password: "not-used-by-this-test",
      role: "restaurant_owner",
      isActive: true,
    },
    {
      name: `Recommendation inactive owner ${suffix}`,
      email: `recommendation-inactive-${suffix}@example.test`,
      password: "not-used-by-this-test",
      role: "restaurant_owner",
      isActive: false,
    },
  ]).returning({ id: usersTable.id });

  const restaurants = await db.insert(restaurantsTable).values([
    {
      ownerId: users[0].id,
      name: `Recommendation eligible merchant ${suffix}`,
      address: "Test address",
      businessType,
      isOpen: true,
      isVerified: true,
    },
    {
      ownerId: users[1].id,
      name: `Recommendation closed merchant ${suffix}`,
      address: "Test address",
      isOpen: false,
      isVerified: true,
    },
    {
      ownerId: users[2].id,
      name: `Recommendation unverified merchant ${suffix}`,
      address: "Test address",
      isOpen: true,
      isVerified: false,
    },
    {
      ownerId: users[3].id,
      name: `Recommendation inactive merchant ${suffix}`,
      address: "Test address",
      isOpen: true,
      isVerified: true,
    },
  ]).returning({ id: restaurantsTable.id });

  const categories = await db.insert(menuItemCategoriesTable).values([
    { restaurantId: null, name: `Recommendation global ${suffix}`, sortOrder: 0, isActive: true },
    { restaurantId: restaurants[0].id, name: `Recommendation own ${suffix}`, sortOrder: 1, isActive: true },
    { restaurantId: restaurants[1].id, name: `Recommendation foreign ${suffix}`, sortOrder: 2, isActive: true },
  ]).returning({ id: menuItemCategoriesTable.id, name: menuItemCategoriesTable.name });

  const products = await db.insert(menuItemsTable).values([
    {
      restaurantId: restaurants[0].id,
      name: `Eligible global ${suffix}`,
      price: 31,
      imageUrl: `/images/eligible-global-${suffix}.jpg`,
      category: categories[0].name,
      menuItemCategoryId: categories[0].id,
      sortOrder: 1,
    },
    {
      restaurantId: restaurants[0].id,
      name: `Eligible own ${suffix}`,
      price: 32,
      imageUrl: `/images/eligible-own-${suffix}.jpg`,
      category: categories[1].name,
      menuItemCategoryId: categories[1].id,
      sortOrder: 2,
    },
    {
      restaurantId: restaurants[0].id,
      name: `Unavailable ${suffix}`,
      price: 33,
      imageUrl: `/images/unavailable-${suffix}.jpg`,
      category: categories[0].name,
      menuItemCategoryId: categories[0].id,
      isAvailable: false,
      sortOrder: 3,
    },
    {
      restaurantId: restaurants[0].id,
      name: `No image ${suffix}`,
      price: 34,
      imageUrl: null,
      category: categories[0].name,
      menuItemCategoryId: categories[0].id,
      sortOrder: 4,
    },
    {
      restaurantId: restaurants[0].id,
      name: `Foreign category ${suffix}`,
      price: 35,
      imageUrl: `/images/foreign-category-${suffix}.jpg`,
      category: categories[2].name,
      menuItemCategoryId: categories[2].id,
      sortOrder: 5,
    },
    {
      restaurantId: restaurants[1].id,
      name: `Closed merchant product ${suffix}`,
      price: 36,
      imageUrl: `/images/closed-${suffix}.jpg`,
      category: categories[0].name,
      menuItemCategoryId: categories[0].id,
    },
    {
      restaurantId: restaurants[2].id,
      name: `Unverified merchant product ${suffix}`,
      price: 37,
      imageUrl: `/images/unverified-${suffix}.jpg`,
      category: categories[0].name,
      menuItemCategoryId: categories[0].id,
    },
    {
      restaurantId: restaurants[3].id,
      name: `Inactive owner product ${suffix}`,
      price: 38,
      imageUrl: `/images/inactive-${suffix}.jpg`,
      category: categories[0].name,
      menuItemCategoryId: categories[0].id,
    },
  ]).returning({ id: menuItemsTable.id, name: menuItemsTable.name });

  const productId = (prefix: string): number =>
    products.find((product) => product.name.startsWith(prefix))!.id;

  return {
    userIds: users.map((user) => user.id),
    restaurantIds: restaurants.map((restaurant) => restaurant.id),
    categoryIds: categories.map((category) => category.id),
    businessType,
    productIds: {
      eligibleGlobal: productId("Eligible global"),
      eligibleOwn: productId("Eligible own"),
      unavailable: productId("Unavailable"),
      noImage: productId("No image"),
      foreignCategory: productId("Foreign category"),
      closedMerchant: productId("Closed merchant"),
      unverifiedMerchant: productId("Unverified merchant"),
      inactiveOwner: productId("Inactive owner"),
    },
  };
}

before(async () => {
  fixture = await createFixture();
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await db.delete(menuItemsTable).where(inArray(menuItemsTable.id, Object.values(fixture.productIds)));
  await db.delete(menuItemCategoriesTable).where(inArray(menuItemCategoriesTable.id, fixture.categoryIds));
  await db.delete(restaurantsTable).where(inArray(restaurantsTable.id, fixture.restaurantIds));
  await db.delete(usersTable).where(inArray(usersTable.id, fixture.userIds));
  await pool.end();
});

test("GET /api/recommendations/products enforces live merchant and category eligibility", async () => {
  const response = await requestJson(
    `/recommendations/products?limit=12&businessType=${encodeURIComponent(fixture.businessType)}`,
  );
  assert.equal(response.status, 200);

  const items = response.body as Array<{
    id: number;
    imageUrl: string;
    price: number;
    menuItemCategoryId: number | null;
    sortOrder: number;
    categorySortOrder: number | null;
  }>;
  assert.deepEqual(items.map((item) => item.id), [
    fixture.productIds.eligibleGlobal,
    fixture.productIds.eligibleOwn,
  ]);
  assert.ok(items.every((item) => item.imageUrl.length > 0 && item.price > 0));
  assert.deepEqual(
    items.map(({ menuItemCategoryId, sortOrder, categorySortOrder }) => ({
      menuItemCategoryId,
      sortOrder,
      categorySortOrder,
    })),
    [
      { menuItemCategoryId: fixture.categoryIds[0], sortOrder: 1, categorySortOrder: 0 },
      { menuItemCategoryId: fixture.categoryIds[1], sortOrder: 2, categorySortOrder: 1 },
    ],
  );
  const excludedIds = [
    fixture.productIds.unavailable,
    fixture.productIds.noImage,
    fixture.productIds.foreignCategory,
    fixture.productIds.closedMerchant,
    fixture.productIds.unverifiedMerchant,
    fixture.productIds.inactiveOwner,
  ];
  assert.ok(!items.some((item) => excludedIds.includes(item.id)));
});