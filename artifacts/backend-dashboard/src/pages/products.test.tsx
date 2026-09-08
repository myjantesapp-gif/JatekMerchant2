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
    { id: 7, name: "Created first", category: "Menu", price: "14", isAvailable: true, isPopular: false, imageUrl: null },
    { id: 8, name: "Created second", category: "Menu", price: "16", isAvailable: true, isPopular: false, imageUrl: null },
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
      expect(requestUrls).toContain("/api/backend/products?sort=custom");
      expect(renderedProductNames()).toEqual(["Custom first", "Custom second"]);
    });

    const sortSelect = screen.getByRole("combobox");
    const choices = [
      ["Nom", "name", ["Name first", "Name second"]],
      ["Prix", "price", ["Price first", "Price second"]],
      ["Date de création", "createdAt", ["Created first", "Created second"]],
      ["Ordre personnalisé", "custom", ["Custom first", "Custom second"]],
    ] as const;

    for (const [label, sort, expectedNames] of choices) {
      fireEvent.keyDown(sortSelect, { key: "ArrowDown" });
      const option = await screen.findByRole("option", { name: label });
      fireEvent.keyDown(option, { key: "Enter" });

      await flushQueryUpdate();
      expect(requestUrls).toContain(`/api/backend/products?sort=${sort}`);
      expect(renderedProductNames()).toEqual(expectedNames);
    }
  });
});