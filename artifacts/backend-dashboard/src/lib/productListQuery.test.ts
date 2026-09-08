import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductListParams,
  isProductSort,
  PRODUCT_SORT_OPTIONS,
} from "./productListQuery";
import { getListBackendProductsUrl } from "@workspace/api-client-react";

test("dashboard sort selections map to the backend products sort query", () => {
  assert.deepEqual(PRODUCT_SORT_OPTIONS, ["custom", "name", "price", "createdAt"]);
  for (const sort of PRODUCT_SORT_OPTIONS) {
    assert.deepEqual(buildProductListParams("", sort), {
      search: undefined,
      sort,
    });
  }
  assert.deepEqual(buildProductListParams(" burger ", "price"), {
    search: " burger ",
    sort: "price",
  });
  assert.equal(
    getListBackendProductsUrl(buildProductListParams(" burger ", "price")),
    "/api/backend/products?search=+burger+&sort=price",
  );
  assert.equal(isProductSort("createdAt"), true);
  assert.equal(isProductSort("unknown"), false);
});