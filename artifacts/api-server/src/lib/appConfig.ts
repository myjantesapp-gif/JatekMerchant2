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
  "recommended_products",
  "recommended_restaurants",
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
  recommended_products: baseHomeSectionSchema.extend({
    source: z.literal("recommended_products"),
  }).strict(),
  recommended_restaurants: baseHomeSectionSchema.extend({
    source: z.literal("recommended_restaurants"),
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
  "recommended_products",
  "recommended_restaurants",
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
  recommended_products: {
    title: "Produits recommandés",
    visible: true,
    source: "recommended_products",
    limit: 6,
  },
  recommended_restaurants: {
    title: "Restaurants recommandés",
    visible: true,
    source: "recommended_restaurants",
    limit: 6,
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

const legalSectionSchema = z.object({
  h: z.string().trim().min(1).max(160),
  p: z.string().trim().min(1).max(5000),
}).strict();

export const legalDocumentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  intro: z.string().trim().max(2000),
  sections: z.array(legalSectionSchema).min(1).max(40),
  updatedAt: z.string().trim().min(1).max(80),
}).strict();

export const legalContentSchema = z.object({
  privacy: legalDocumentSchema,
  terms: legalDocumentSchema,
  cookies: legalDocumentSchema,
  mentions: legalDocumentSchema,
}).strict();

export type LegalContent = z.infer<typeof legalContentSchema>;

export const DEFAULT_LEGAL_CONTENT: LegalContent = {
  privacy: {
    title: "Politique de confidentialité",
    intro: "Nous protégeons vos données et vous permettons d'exercer vos droits à tout moment.",
    updatedAt: "avril 2026",
    sections: [
      { h: "1. Données collectées", p: "Nous collectons votre nom, email, téléphone, adresse de livraison et historique de commande pour fournir le service. Aucune donnée bancaire n'est stockée par Jatek." },
      { h: "2. Utilisation des données", p: "Vos données servent à traiter vos commandes, vous identifier, livrer à la bonne adresse et améliorer le service. Nous ne vendons jamais vos données à des tiers." },
      { h: "3. Vos droits (RGPD)", p: "Vous pouvez à tout moment consulter, modifier ou supprimer vos données depuis l'écran Profil. La suppression de compte efface l'ensemble des données sous 30 jours." },
      { h: "4. Cookies & analytics", p: "Nous utilisons un minimum de cookies techniques et un outil d'analyse anonymisée pour améliorer l'application." },
      { h: "5. Contact DPO", p: "Pour toute question : privacy@jatek.ma" },
    ],
  },
  terms: {
    title: "Conditions d'utilisation",
    intro: "En utilisant Jatek, vous acceptez les conditions présentées ci-dessous.",
    updatedAt: "avril 2026",
    sections: [
      { h: "1. Acceptation", p: "En utilisant Jatek, vous acceptez ces conditions ainsi que la politique de confidentialité." },
      { h: "2. Compte utilisateur", p: "Vous êtes responsable de la confidentialité de vos identifiants. Tout usage frauduleux entraînera la fermeture du compte." },
      { h: "3. Commandes", p: "Une commande validée est ferme. L'annulation est possible tant que le restaurant ne l'a pas confirmée." },
      { h: "4. Paiement", p: "Le paiement est dû à la livraison ou au moment de la commande selon le mode choisi." },
      { h: "5. Livraison", p: "Les délais sont indicatifs. Jatek met tout en œuvre pour les respecter mais ne peut être tenu responsable d'un retard ponctuel." },
      { h: "6. Litiges", p: "Tout litige sera porté devant les juridictions compétentes du Royaume du Maroc." },
    ],
  },
  cookies: {
    title: "Politique des cookies",
    intro: "Cette politique explique les traceurs utilisés par Jatek et la façon dont vous pouvez gérer vos choix.",
    updatedAt: "avril 2026",
    sections: [
      { h: "1. Qu'est-ce qu'un cookie ?", p: "Un cookie est un petit fichier déposé sur votre appareil qui permet à une application de mémoriser vos préférences ou d'analyser votre utilisation." },
      { h: "2. Cookies essentiels", p: "Indispensables au fonctionnement (session, panier, sécurité). Ils ne peuvent pas être désactivés." },
      { h: "3. Cookies analytiques", p: "Mesure d'audience anonymisée pour améliorer l'application. Activables/désactivables dans Profil > Confidentialité." },
      { h: "4. Cookies marketing", p: "Personnalisation des offres et publicités. Désactivés par défaut, soumis à votre consentement explicite." },
      { h: "5. Durée de conservation", p: "12 mois maximum, renouvelés à chaque visite. Vous pouvez retirer votre consentement à tout moment." },
      { h: "6. Gérer vos cookies", p: "Allez dans Profil > Confidentialité & RGPD pour modifier vos choix à tout moment." },
    ],
  },
  mentions: {
    title: "Mentions légales",
    intro: "Informations relatives à l'éditeur et à l'hébergement de Jatek.",
    updatedAt: "avril 2026",
    sections: [
      { h: "Éditeur", p: "Jatek SARL — Capital 100 000 MAD\nSiège social : Oujda, Maroc\nRC : 12345 — ICE : 002345678000099" },
      { h: "Directeur de publication", p: "Direction Jatek" },
      { h: "Hébergement", p: "Replit, Inc. — 548 Market Street, San Francisco, CA 94104, USA" },
      { h: "Contact", p: "contact@jatek.ma" },
      { h: "Propriété intellectuelle", p: "L'ensemble du contenu de l'application (textes, logos, design) est la propriété exclusive de Jatek SARL ou de ses partenaires." },
    ],
  },
};

export function getDefaultLegalContent(): LegalContent {
  return legalContentSchema.parse(DEFAULT_LEGAL_CONTENT);
}

export function validateHomeSections(value: unknown): HomeSectionsConfig {
  return homeSectionsSchema.parse(value);
}

export type AppConfig = Record<string, unknown> & {
  homeSections: HomeSectionsConfig;
  legalContent: LegalContent;
  splashVideoUrl?: string;
};

export const splashVideoUrlSchema = z.string().trim().max(2048)
  .refine(
    (value) => {
      if (value === "") return true;
      if (/^\/api\/storage\/objects\/splash\/[a-zA-Z0-9_-]+(?:\.mp4)?(?:\?[^#]*)?$/.test(value)) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password
          && (/\.mp4$/i.test(url.pathname) || /^\/api\/storage\/objects\/splash\/[a-zA-Z0-9_-]+(?:\.mp4)?$/.test(url.pathname));
      } catch { return false; }
    },
    "splashVideoUrl must be a direct HTTPS MP4 URL or an App Storage splash path",
  );