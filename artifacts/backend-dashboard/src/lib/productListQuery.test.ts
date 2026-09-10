import { describe, expect, it } from "vitest";

import {
  buildProductListParams,
  isProductSort,
  PRODUCT_SORT_OPTIONS,
} from "./productListQuery";
import { getListBackendProductsUrl } from "@workspace/api-client-react";

describe("product list query", () => {
  it("maps dashboard sort selections to the backend products sort query", () => {
    expect(PRODUCT_SORT_OPTIONS).toEqual(["custom", "name", "category", "price", "availability", "shop", "createdAt"]);
    for (const sort of PRODUCT_SORT_OPTIONS) {
      expect(buildProductListParams("", sort)).toEqual({
        search: undefined,
        sort,
      });
    }
    expect(buildProductListParams(" burger ", "price")).toEqual({
      search: " burger ",
      sort: "price",
    });
    expect(
      getListBackendProductsUrl(buildProductListParams(" burger ", "price")),
    ).toBe("/api/backend/products?search=+burger+&sort=price");
    expect(isProductSort("createdAt")).toBe(true);
    expect(isProductSort("unknown")).toBe(false);
  });

  it("only sends supported shop and availability filters", () => {
    expect(buildProductListParams("pizza", "custom", {
      shopId: 7,
      status: "available",
      category: "Burgers",
      sortDirection: "desc",
      page: 2,
      pageSize: 50,
    })).toEqual({
      search: "pizza",
      sort: "custom",
      shopId: 7,
      status: "available",
      category: "Burgers",
      sortDirection: "desc",
      page: 2,
      pageSize: 50,
    });
    expect(
      getListBackendProductsUrl(buildProductListParams("", "custom", { shopId: 7, status: "unavailable" })),
    ).toBe("/api/backend/products?sort=custom&shopId=7&status=unavailable");
  });
});