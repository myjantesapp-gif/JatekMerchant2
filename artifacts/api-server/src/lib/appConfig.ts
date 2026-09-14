import { z } from "@workspace/api-zod";

/**
 * The sections rendered on the mobile Home screen.  Keeping this contract in
 * the API means clients can safely consume the value returned by
 * /api/app-config, even when the app_config table has not been seeded yet.
 */
export const HOME_SECTION_KEYS = [
  "categories",
  "banners",
  "shorts",
  "popular",
  "new_restaurants",
  "supermarkets",
  "new_products",
  "shops",
  "all",
  "free_delivery",
  "newest",
  "support",
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

const baseHomeSectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  visible: z.boolean(),
  limit: z.number().int().min(1).max(30),
});

export const homeSectionsSchema = z.object({
  categories: baseHomeSectionSchema.extend({
    source: z.literal("categories"),
  }).strict(),
  banners: baseHomeSectionSchema.extend({
    source: z.literal("banners"),
  }).strict(),
  shorts: baseHomeSectionSchema.extend({
    source: z.literal("shorts"),
  }).strict(),
  popular: baseHomeSectionSchema.extend({
    source: z.enum(["popular", "newest", "promos"]),
  }).strict(),
  new_restaurants: baseHomeSectionSchema.extend({
    source: z.enum(["new_restaurants", "all_restaurants"]),
  }).strict(),
  supermarkets: baseHomeSectionSchema.extend({
    source: z.enum(["supermarkets", "all_restaurants"]),
  }).strict(),
  new_products: baseHomeSectionSchema.extend({
    source: z.enum(["newest", "popular", "promos"]),
  }).strict(),
  shops: baseHomeSectionSchema.extend({
    source: z.enum(["shops", "all_restaurants"]),
  }).strict(),
  all: baseHomeSectionSchema.extend({
    source: z.literal("all_restaurants"),
  }).strict(),
  free_delivery: baseHomeSectionSchema.extend({
    source: z.literal("free_delivery"),
  }).strict(),
  newest: baseHomeSectionSchema.extend({
    source: z.literal("newest"),
  }).strict(),
  support: baseHomeSectionSchema.extend({
    source: z.literal("support"),
  }).strict(),
}).strict();

export type HomeSectionsConfig = z.infer<typeof homeSectionsSchema>;
export const HOME_ORDER_KEYS = [
  "categories",
  "banners",
  "shorts",
  "popular",
  "new_restaurants",
  "supermarkets",
  "new_products",
  "shops",
  "all",
  "free_delivery",
  "newest",
  "support",
] as const;
export const homeOrderSchema = z.array(z.enum(HOME_ORDER_KEYS)).min(1).max(HOME_ORDER_KEYS.length)
  .refine((keys) => new Set(keys).size === keys.length, "homeOrder cannot contain duplicate sections");

export const DEFAULT_HOME_SECTIONS: HomeSectionsConfig = {
  categories: {
    title: "Catégories",
    visible: true,
    source: "categories",
    limit: 4,
  },
  banners: {
    title: "Bannières",
    visible: true,
    source: "banners",
    limit: 10,
  },
  shorts: {
    title: "Shorts",
    visible: true,
    source: "shorts",
    limit: 12,
  },
  popular: {
    title: "Produits populaires",
    visible: true,
    source: "popular",
    limit: 6,
  },
  new_products: {
    title: "Offres du moment",
    visible: true,
    source: "promos",
    limit: 6,
  },
  new_restaurants: {
    title: "Restauration",
    visible: false,
    source: "new_restaurants",
    limit: 6,
  },
  supermarkets: {
    title: "Supermarché",
    visible: true,
    source: "supermarkets",
    limit: 6,
  },
  shops: {
    title: "Boutiques",
    visible: false,
    source: "shops",
    limit: 6,
  },
  all: {
    title: "Recommandé pour vous",
    visible: true,
    source: "all_restaurants",
    limit: 6,
  },
  free_delivery: {
    title: "Livraison gratuite",
    visible: true,
    source: "free_delivery",
    limit: 6,
  },
  newest: {
    title: "Nouveautés",
    visible: true,
    source: "newest",
    limit: 6,
  },
  support: {
    title: "Besoin d'aide ?",
    visible: true,
    source: "support",
    limit: 1,
  },
};

/**
 * Return a fresh default object so callers cannot mutate the process-wide
 * defaults between requests.
 */
export function getDefaultHomeSections(): HomeSectionsConfig {
  return homeSectionsSchema.parse(DEFAULT_HOME_SECTIONS);
}

export function validateHomeSections(value: unknown): HomeSectionsConfig {
  return homeSectionsSchema.parse(value);
}

export type AppConfig = Record<string, unknown> & {
  homeSections: HomeSectionsConfig;
};