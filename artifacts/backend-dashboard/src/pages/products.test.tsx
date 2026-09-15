import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Products from "./products";

type Product = {
  id: number;
  name: string;
  category: string;
  price: string;
  isAvailable: boolean;
  isPopular: boolean;
  imageUrl: null;
};

const productsBySort: Record<string, Product[]> = {
  custom: [
    { id: 1, name: "Custom first", category: "Menu", price: "12", isAvailable: true, isPopular: false, imageUrl: null },
    { id: 2, name: "Custom second", category: "Menu", price: "18", isAvailable: true, isPopular: false, imageUrl: null },
  ],
  name: [
    { id: 3, name: "Name first", category: "Menu", price: "10", isAvailable: true, isPopular: false, imageUrl: null },
    { id: 4, name: "Name second", category: "Menu", price: "20", isAvailable: true, isPopular: false, imageUrl: null },
  ],
  price: [
    { id: 5, name: "Price first", category: "Menu", price: "5", isAvailable: true, isPopular: false, imageUrl: null },
    { id: 6, name: "Price second", category: "Menu", price: "25", isAvailable: true, isPopular: false, imageUrl: null },
  ],
  createdAt: [
    { id: 8, name: "Created second", category: "Menu", price: "16", isAvailable: true, isPopular: false, imageUrl: null },
    { id: 7, name: "Created first", category: "Menu", price: "14", isAvailable: true, isPopular: false, imageUrl: null },
  ],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function renderProducts() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Products />
    </QueryClientProvider>,
  );
}

function renderedProductNames() {
  const table = screen.getByRole("table");
  const body = table.querySelector("tbody");
  if (!body) throw new Error("Products table has no body");

  return within(body)
    .getAllByRole("row")
    .map((row) => row.querySelector("td")?.textContent?.replace(/^—/, "").trim());
}

async function flushQueryUpdate() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Products sorting", () => {
  const requestUrls: string[] = [];

  beforeEach(() => {
    requestUrls.length = 0;
    notifyManager.setScheduler((callback) => callback());
    Object.assign(HTMLElement.prototype, {
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
      scrollIntoView: () => undefined,
      setPointerCapture: () => undefined,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requestUrls.push(url);

        if (url.includes("/api/backend/products")) {
          const sort = new URL(url, "http://dashboard.test").searchParams.get("sort") ?? "custom";
          return jsonResponse(productsBySort[sort]);
        }

        if (url.includes("/api/backend/me")) {
          return jsonResponse({ user: { role: "admin" }, permissions: [] });
        }

        if (url.includes("/api/backend/menu-categories") || url.includes("/api/backend/shops")) {
          return jsonResponse([]);
        }

        return jsonResponse([]);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("refetches and renders the returned order for every sort choice", async () => {
    renderProducts();

    await waitFor(() => {
      expect(requestUrls).toContain("/api/backend/products/page?sort=custom&sortDirection=asc&page=1&pageSize=50");
      expect(renderedProductNames()).toEqual(["Custom first", "Custom second"]);
    });

    const sortSelect = screen.getByTestId("select-product-sort");
    const choices = [
      ["Nom", "name", ["Name first", "Name second"]],
      ["Prix", "price", ["Price first", "Price second"]],
       ["Date de création", "createdAt", ["Created second", "Created first"]],
      ["Ordre personnalisé", "custom", ["Custom first", "Custom second"]],
    ] as const;

    for (const [label, sort, expectedNames] of choices) {
      fireEvent.keyDown(sortSelect, { key: "ArrowDown" });
      const option = await screen.findByRole("option", { name: label });
      fireEvent.keyDown(option, { key: "Enter" });

      await flushQueryUpdate();
      expect(requestUrls).toContain(`/api/backend/products/page?sort=${sort}&sortDirection=${sort === "createdAt" ? "desc" : "asc"}&page=1&pageSize=50`);
      expect(renderedProductNames()).toEqual(expectedNames);
    }
  });
});

describe("Products filtering and pagination", () => {
  const requestUrls: string[] = [];
  beforeEach(() => {
    requestUrls.length = 0;
    notifyManager.setScheduler((callback) => callback());
    Object.assign(HTMLElement.prototype, {
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
      scrollIntoView: () => undefined,
      setPointerCapture: () => undefined,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requestUrls.push(url);

        if (url.includes("/api/backend/products/page")) {
          return jsonResponse({
            items: productsBySort.custom,
            total: 100,
            page: Number(new URL(url, "http://dashboard.test").searchParams.get("page") ?? 1),
            pageSize: 50,
            totalPages: 2
          });
        }
        if (url.includes("/api/backend/me")) return jsonResponse({ user: { role: "admin" }, permissions: [] });
        if (url.includes("/api/backend/menu-categories") || url.includes("/api/backend/shops")) return jsonResponse([]);
        return jsonResponse([]);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("changing promo filter resets pagination and clearing filters resets promo", async () => {
    renderProducts();

    await waitFor(() => {
      expect(requestUrls).toContain("/api/backend/products/page?sort=custom&sortDirection=asc&page=1&pageSize=50");
    });

    const nextPageBtn = await screen.findByTestId("button-products-next-page");
    fireEvent.click(nextPageBtn);
    await flushQueryUpdate();
    expect(requestUrls).toContain("/api/backend/products/page?sort=custom&sortDirection=asc&page=2&pageSize=50");

    const promoSelect = screen.getByTestId("select-product-promotion");
    fireEvent.keyDown(promoSelect, { key: "ArrowDown" });
    const option = await screen.findByRole("option", { name: "En promotion" });
    fireEvent.keyDown(option, { key: "Enter" });
    await flushQueryUpdate();

    expect(requestUrls).toContain("/api/backend/products/page?sort=custom&promo=true&sortDirection=asc&page=1&pageSize=50");

    const clearBtn = await screen.findByTestId("button-clear-product-filters");
    fireEvent.click(clearBtn);
    await flushQueryUpdate();

    const urlHasPromo = requestUrls[requestUrls.length - 1].includes("promo=true");
    expect(urlHasPromo).toBe(false);
  });
});

describe("Products mutation safety", () => {
  beforeEach(() => {
    notifyManager.setScheduler((callback) => callback());
    Object.assign(HTMLElement.prototype, {
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
      scrollIntoView: () => undefined,
      setPointerCapture: () => undefined,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const product = (id: number, name = `Product ${id}`, sortOrder = id) => ({
    id,
    name,
    category: "Menu",
    price: "12",
    sortOrder,
    restaurantId: 1,
    isAvailable: true,
    isPopular: false,
    imageUrl: null,
  });

  function stubProductRequests(products: ReturnType<typeof product>[], mutationHandler?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method !== "GET" && mutationHandler) {
        return mutationHandler(url, init);
      }
      if (url.includes("/api/backend/products/page")) {
        return jsonResponse({ items: products, total: products.length, page: 1, pageSize: 50, totalPages: 1 });
      }
      if (url.includes("/api/backend/me")) return jsonResponse({ user: { role: "admin" }, permissions: [] });
      if (url.includes("/api/backend/menu-categories") || url.includes("/api/backend/shops")) return jsonResponse([]);
      return jsonResponse([]);
    }));
  }

  it("keeps the edited order draft visible and marks it when the save fails", async () => {
    stubProductRequests([product(1)], async () => new Response(JSON.stringify({ error: "Order verrouillé" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }));
    renderProducts();

    const orderInput = await screen.findByTestId("input-product-order-1") as HTMLInputElement;
    fireEvent.change(orderInput, { target: { value: "7" } });
    fireEvent.blur(orderInput);

    const orderError = await screen.findByTestId("status-product-order-error-1");
    expect(orderError.textContent).toContain("Order verrouillé");
    expect(orderInput.value).toBe("7");
    expect(orderInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("serializes order saves and keeps pending state scoped to each row", async () => {
    const patchIds: number[] = [];
    let releaseFirst: ((response: Response) => void) | undefined;
    stubProductRequests([product(1), product(2)], (url) => {
      const id = Number(url.split("/").pop());
      patchIds.push(id);
      if (id === 1 && patchIds.filter((value) => value === 1).length === 1) {
        return new Promise<Response>((resolve) => { releaseFirst = resolve; });
      }
      return jsonResponse(product(id, `Product ${id}`, id + 10));
    });
    renderProducts();

    const firstOrder = await screen.findByTestId("input-product-order-1") as HTMLInputElement;
    const secondOrder = await screen.findByTestId("input-product-order-2") as HTMLInputElement;
    fireEvent.change(firstOrder, { target: { value: "11" } });
    fireEvent.blur(firstOrder);
    fireEvent.change(secondOrder, { target: { value: "12" } });
    fireEvent.blur(secondOrder);

    await waitFor(() => expect(patchIds).toEqual([1]));
    expect(firstOrder.disabled).toBe(true);
    expect(secondOrder.disabled).toBe(true);
    releaseFirst?.(jsonResponse(product(1, "Product 1", 11)));
    await waitFor(() => expect(patchIds).toEqual([1, 2]));
  });

  it("keeps the delete confirmation open while pending and closes after success", async () => {
    let releaseDelete: ((response: Response) => void) | undefined;
    stubProductRequests([product(1)], (url, init) => {
      if (init?.method === "DELETE") {
        return new Promise<Response>((resolve) => { releaseDelete = resolve; });
      }
      return jsonResponse(product(1));
    });
    renderProducts();

    fireEvent.click(await screen.findByTestId("button-delete-product-1"));
    const confirm = await screen.findByTestId("button-confirm-delete-product") as HTMLButtonElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm.disabled).toBe(true));
    expect(screen.getByText(/Cette action est irréversible/)).toBeTruthy();

    releaseDelete?.(new Response(null, { status: 204 }));
    await waitFor(() => expect(screen.queryByTestId("button-confirm-delete-product")).toBeNull());
  });
});