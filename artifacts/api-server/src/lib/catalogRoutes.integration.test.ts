import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";

import jwt from "jsonwebtoken";
import {
  db,
  menuItemCategoriesTable,
  menuItemsTable,
  pool,
  restaurantsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

import app from "../app";

type Fixture = {
  userId: number;
  restaurantId: number;
  categoryIds: number[];
  categoryNames: {
    globalUsed: string;
  };
  productIds: {
    legacy: number;
    usedHigh: number;
    usedLow: number;
    private: number;
  };
};

type JsonResponse = {
  status: number;
  body: unknown;
};

let fixture: Fixture;
let server: Server;
let baseUrl: string;
let authToken: string;

async function requestJson(path: string, token?: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const [user] = await db.insert(usersTable).values({
    name: `Catalog route test ${suffix}`,
    email: `catalog-route-${suffix}@example.test`,
    password: "not-used-by-this-test",
    role: "admin",
  }).returning({ id: usersTable.id });

  const [restaurant] = await db.insert(restaurantsTable).values({
    ownerId: user.id,
    name: `Catalog route restaurant ${suffix}`,
    address: "Test address",
  }).returning({ id: restaurantsTable.id });

  const categories = await db.insert(menuItemCategoriesTable).values([
    { restaurantId: null, name: `Global empty ${suffix}`, sortOrder: 0 },
    { restaurantId: null, name: `Global used ${suffix}`, sortOrder: 1 },
    { restaurantId: null, name: `Legacy ${suffix}`, sortOrder: 2 },
    { restaurantId: restaurant.id, name: `Private ${suffix}`, sortOrder: 3 },
    { restaurantId: restaurant.id + 999999, name: `Other restaurant ${suffix}`, sortOrder: 4 },
  ]).returning({ id: menuItemCategoriesTable.id, name: menuItemCategoriesTable.name });

  const globalUsed = categories.find((category) => category.name.startsWith("Global used"))!;
  const legacy = categories.find((category) => category.name.startsWith("Legacy"))!;
  const privateCategory = categories.find((category) => category.name.startsWith("Private"))!;

  const products = await db.insert(menuItemsTable).values([
    {
      restaurantId: restaurant.id,
      name: `Legacy product ${suffix}`,
      price: 30,
      category: legacy.name,
      menuItemCategoryId: null,
      sortOrder: 50,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
    },
    {
      restaurantId: restaurant.id,
      name: `Zeta ${suffix}`,
      price: 40,
      category: globalUsed.name,
      menuItemCategoryId: globalUsed.id,
      sortOrder: 20,
      createdAt: new Date("2026-09-03T10:00:00.000Z"),
    },
    {
      restaurantId: restaurant.id,
      name: `Alpha ${suffix}`,
      price: 10,
      category: globalUsed.name,
      menuItemCategoryId: globalUsed.id,
      sortOrder: 1,
      createdAt: new Date("2026-09-02T10:00:00.000Z"),
    },
    {
      restaurantId: restaurant.id,
      name: `Private ${suffix}`,
      price: 5,
      category: privateCategory.name,
      menuItemCategoryId: privateCategory.id,
      sortOrder: 30,
      createdAt: new Date("2026-09-04T10:00:00.000Z"),
    },
  ]).returning({ id: menuItemsTable.id, name: menuItemsTable.name });

  const productId = (name: string): number => products.find((product) => product.name.startsWith(name))!.id;
  return {
    userId: user.id,
    restaurantId: restaurant.id,
    categoryIds: categories.map((category) => category.id),
    categoryNames: {
      globalUsed: globalUsed.name,
    },
    productIds: {
      legacy: productId("Legacy product"),
      usedHigh: productId("Zeta"),
      usedLow: productId("Alpha"),
      private: productId("Private"),
    },
  };
}

before(async () => {
  fixture = await createFixture();
  authToken = jwt.sign({ userId: fixture.userId }, process.env.SESSION_SECRET!);

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
  await db.delete(menuItemsTable).where(eq(menuItemsTable.restaurantId, fixture.restaurantId));
  await db.delete(menuItemCategoriesTable).where(eq(menuItemCategoriesTable.id, fixture.categoryIds[0]));
  for (const categoryId of fixture.categoryIds.slice(1)) {
    await db.delete(menuItemCategoriesTable).where(eq(menuItemCategoriesTable.id, categoryId));
  }
  await db.delete(restaurantsTable).where(eq(restaurantsTable.id, fixture.restaurantId));
  await db.delete(usersTable).where(eq(usersTable.id, fixture.userId));
  await pool.end();
});

test("real API auth boundary rejects an unauthenticated backend product request", async () => {
  const response = await requestJson(`/backend/products?shopId=${fixture.restaurantId}`);
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    error: "Authentication required",
    code: "UNAUTHENTICATED",
  });
});

test("GET /api/menu-categories scopes categories and preserves legacy name fallback", async () => {
  const response = await requestJson(`/menu-categories?restaurantId=${fixture.restaurantId}`, authToken);
  assert.equal(response.status, 200);

  const categories = response.body as Array<{ id: number; restaurantId: number | null; name: string }>;
  assert.deepEqual(categories.map((category) => category.id), [
    fixture.categoryIds[1],
    fixture.categoryIds[2],
    fixture.categoryIds[3],
  ]);
  assert.ok(categories.every((category) =>
    category.restaurantId === null || category.restaurantId === fixture.restaurantId));
});

test("GET /api/backend/products applies every supported sort at the HTTP boundary", async () => {
  const expectedBySort = {
    custom: [
      fixture.productIds.usedLow,
      fixture.productIds.usedHigh,
      fixture.productIds.private,
      fixture.productIds.legacy,
    ],
    name: [
      fixture.productIds.usedLow,
      fixture.productIds.legacy,
      fixture.productIds.private,
      fixture.productIds.usedHigh,
    ],
    category: [
      fixture.productIds.usedLow,
      fixture.productIds.usedHigh,
      fixture.productIds.legacy,
      fixture.productIds.private,
    ],
    price: [
      fixture.productIds.private,
      fixture.productIds.usedLow,
      fixture.productIds.legacy,
      fixture.productIds.usedHigh,
    ],
    availability: [
      fixture.productIds.usedLow,
      fixture.productIds.legacy,
      fixture.productIds.private,
      fixture.productIds.usedHigh,
    ],
    shop: [
      fixture.productIds.usedLow,
      fixture.productIds.legacy,
      fixture.productIds.private,
      fixture.productIds.usedHigh,
    ],
    createdAt: [
      fixture.productIds.private,
      fixture.productIds.usedHigh,
      fixture.productIds.usedLow,
      fixture.productIds.legacy,
    ],
  } as const;

  for (const [sort, expectedIds] of Object.entries(expectedBySort)) {
    const response = await requestJson(
      `/backend/products?shopId=${fixture.restaurantId}&sort=${sort}`,
      authToken,
    );
    assert.equal(response.status, 200, `sort=${sort}`);
    const products = response.body as Array<{ id: number; restaurantId: number }>;
    assert.deepEqual(products.map((product) => product.id), expectedIds, `sort=${sort}`);
    assert.ok(products.every((product) => product.restaurantId === fixture.restaurantId));
  }
});

test("GET /api/backend/products/page applies server filters, direction, and pagination", async () => {
  const category = encodeURIComponent(fixture.categoryNames.globalUsed);
  const response = await requestJson(
    `/backend/products/page?shopId=${fixture.restaurantId}&category=${category}&sort=price&sortDirection=desc&page=1&pageSize=1`,
    authToken,
  );
  assert.equal(response.status, 200);
  const page = response.body as {
    items: Array<{ id: number; category: string; price: number }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  assert.deepEqual(page.items.map((product) => product.id), [fixture.productIds.usedHigh]);
  assert.equal(page.total, 2);
  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 1);
  assert.equal(page.totalPages, 2);
  assert.ok(page.items.every((product) => product.category === fixture.categoryNames.globalUsed));
});

test("GET /api/restaurants/:restaurantId/menu groups categories and keeps legacy products visible", async () => {
  const response = await requestJson(`/restaurants/${fixture.restaurantId}/menu`, authToken);
  assert.equal(response.status, 200);

  const products = response.body as Array<{
    id: number;
    restaurantId: number;
    menuItemCategoryId: number | null;
    sortOrder: number;
    categorySortOrder: number | null;
  }>;
  assert.deepEqual(products.map((product) => product.id), [
    fixture.productIds.usedLow,
    fixture.productIds.usedHigh,
    fixture.productIds.legacy,
    fixture.productIds.private,
  ]);
  assert.ok(products.every((product) => product.restaurantId === fixture.restaurantId));
  assert.equal(products[2].menuItemCategoryId, null);
  assert.equal(products[2].categorySortOrder, 2);
  assert.deepEqual(
    products.map(({ sortOrder, categorySortOrder }) => ({ sortOrder, categorySortOrder })),
    [
      { sortOrder: 1, categorySortOrder: 1 },
      { sortOrder: 20, categorySortOrder: 1 },
      { sortOrder: 50, categorySortOrder: 2 },
      { sortOrder: 30, categorySortOrder: 3 },
    ],
  );
});