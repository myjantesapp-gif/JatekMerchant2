import { z } from "@workspace/api-zod";

/**
 * The sections rendered on the mobile Home screen.  Keeping this contract in
 * the API means clients can safely consume the value returned by
 * /api/app-config, even when the app_config table has not been seeded yet.
 */
export const HOME_SECTION_KEYS = [
  "popular",
  "new_products",
  "new_restaurants",
  "shops",
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

const baseHomeSectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  visible: z.boolean(),
  limit: z.number().int().min(1).max(30),
});

export const homeSectionsSchema = z.object({
  popular: baseHomeSectionSchema.extend({
    source: z.enum(["popular", "newest"]),
  }).strict(),
  new_products: baseHomeSectionSchema.extend({
    source: z.enum(["newest", "popular"]),
  }).strict(),
  new_restaurants: baseHomeSectionSchema.extend({
    source: z.enum(["new_restaurants", "all_restaurants"]),
  }).strict(),
  shops: baseHomeSectionSchema.extend({
    source: z.enum(["shops", "all_restaurants"]),
  }).strict(),
}).strict();

export type HomeSectionsConfig = z.infer<typeof homeSectionsSchema>;
export const HOME_ORDER_KEYS = [
  "banners",
  "categories",
  "popular",
  "new_products",
  "new_restaurants",
  "shops",
  "featured",
  "all",
] as const;
export const homeOrderSchema = z.array(z.enum(HOME_ORDER_KEYS)).min(1).max(HOME_ORDER_KEYS.length)
  .refine((keys) => new Set(keys).size === keys.length, "homeOrder cannot contain duplicate sections");

export const DEFAULT_HOME_SECTIONS: HomeSectionsConfig = {
  popular: {
    title: "Produits populaires",
    visible: true,
    source: "popular",
    limit: 6,
  },
  new_products: {
    title: "Nouveaux produits",
    visible: true,
    source: "newest",
    limit: 6,
  },
  new_restaurants: {
    title: "Près de chez vous",
    visible: true,
    source: "new_restaurants",
    limit: 6,
  },
  shops: {
    title: "Boutiques",
    visible: true,
    source: "shops",
    limit: 6,
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