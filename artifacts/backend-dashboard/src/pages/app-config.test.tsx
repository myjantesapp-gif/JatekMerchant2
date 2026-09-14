import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppConfig from "./app-config";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/toaster";

// Mock the API fetch
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({
    defaultLanguage: "fr",
    maintenanceMode: false,
    featuredCount: 6,
        homeOrder: ["banners", "categories", "featured", "all", "popular", "new_products", "new_restaurants", "supermarkets", "shops"],
    welcomeMessage: "Test Welcome",
    homeSections: {
      popular: { visible: true, title: "Populaires", source: "popular", limit: 10 },
      new_products: { visible: true, title: "Nouveautés", source: "newest", limit: 10 },
      new_restaurants: { visible: true, title: "Nouveaux restaurants", source: "new_restaurants", limit: 10 },
        supermarkets: { visible: true, title: "Supermarchés", source: "supermarkets", limit: 10 },
      shops: { visible: true, title: "Boutiques", source: "shops", limit: 10 },
    }
  })
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe("AppConfig", () => {
  it("renders configuration settings including dynamic sections", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AppConfig />
        <Toaster />
      </QueryClientProvider>
    );

    // Wait for the mock fetch to complete and form to render
    expect(await screen.findByText("Paramètres des sections dynamiques")).toBeDefined();
    
    // Check if labels for the new sections exist
    expect(screen.getAllByText("Offres du moment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Boutiques").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Supermarchés près de chez vous").length).toBeGreaterThan(0);
    
    // Check if configuration inputs are rendered
    expect(screen.getAllByText("Titre affiché").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Source autorisée").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Limite d'éléments").length).toBeGreaterThan(0);
  });
});
