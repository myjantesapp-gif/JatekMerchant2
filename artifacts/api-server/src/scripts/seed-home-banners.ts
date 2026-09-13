import { eq, or } from "drizzle-orm";
import { adsTable, appConfigTable, db, pool } from "@workspace/db";

const banners = [
  {
    title: "Le mois des mamans",
    subtitle: "Dépensez 150 MAD et obtenez 30 MAD de réduction",
    badge: "PROMO",
    legacyImageUrl: "/banners/mois-des-mamans.png",
    imageUrl: "/api/banners/mois-des-mamans.png",
    sortOrder: 0,
  },
  {
    title: "C'est la rentrée — turquoise",
    subtitle: "Dépensez 20 MAD et obtenez 10 MAD de réduction",
    badge: "PROMO",
    legacyImageUrl: "/banners/c-est-la-rentree.png",
    imageUrl: "/api/banners/c-est-la-rentree.png",
    sortOrder: 1,
  },
  {
    title: "C'est la rentrée — orange",
    subtitle: "Dépensez 20 MAD et obtenez 10 MAD de réduction",
    badge: "PROMO",
    legacyImageUrl: "/banners/c-est-la-rentree-orange.png",
    imageUrl: "/api/banners/c-est-la-rentree-orange.png",
    sortOrder: 2,
  },
] as const;

for (const banner of banners) {
  const existing = await db
    .select({ id: adsTable.id })
    .from(adsTable)
    .where(or(
      eq(adsTable.imageUrl, banner.imageUrl),
      eq(adsTable.imageUrl, banner.legacyImageUrl),
      eq(adsTable.title, banner.title),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(adsTable).set({
      type: "vip_banner",
      title: banner.title,
      subtitle: banner.subtitle,
      badge: banner.badge,
      imageUrl: banner.imageUrl,
      isActive: true,
      sortOrder: banner.sortOrder,
    }).where(eq(adsTable.id, existing[0].id));
  } else {
    await db.insert(adsTable).values({
      type: "vip_banner",
      title: banner.title,
      subtitle: banner.subtitle,
      badge: banner.badge,
      bgColor: "#F8DDE6",
      accentColor: "#E91E63",
      icon: "gift",
      imageUrl: banner.imageUrl,
      isActive: true,
      sortOrder: banner.sortOrder,
    });
  }
}

const homeSections = {
  popular: { title: "Produits populaires", visible: true, source: "popular", limit: 6 },
  new_products: { title: "Promos", visible: true, source: "promos", limit: 6 },
  new_restaurants: { title: "Restauration", visible: false, source: "new_restaurants", limit: 6 },
  shops: { title: "Boutiques", visible: false, source: "shops", limit: 6 },
};
const homeOrder = ["categories", "banners", "new_products", "shorts", "popular", "new_restaurants", "all"];

for (const [key, value] of [
  ["homeSections", homeSections],
  ["homeOrder", homeOrder],
] as const) {
  await db.insert(appConfigTable).values({ key, value }).onConflictDoUpdate({
    target: appConfigTable.key,
    set: { value, updatedAt: new Date() },
  });
}

console.log(`Seeded ${banners.length} Home banners.`);
await pool.end();