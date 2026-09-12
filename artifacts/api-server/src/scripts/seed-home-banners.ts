import { eq } from "drizzle-orm";
import { adsTable, db, pool } from "@workspace/db";

const banners = [
  {
    title: "Le mois des mamans",
    subtitle: "Dépensez 150 MAD et obtenez 30 MAD de réduction",
    badge: "PROMO",
    imageUrl: "/banners/mois-des-mamans.png",
    sortOrder: 0,
  },
  {
    title: "C'est la rentrée",
    subtitle: "Dépensez 20 MAD et obtenez 10 MAD de réduction",
    badge: "PROMO",
    imageUrl: "/banners/c-est-la-rentree.png",
    sortOrder: 1,
  },
] as const;

for (const banner of banners) {
  const existing = await db
    .select({ id: adsTable.id })
    .from(adsTable)
    .where(eq(adsTable.imageUrl, banner.imageUrl))
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

console.log(`Seeded ${banners.length} Home banners.`);
await pool.end();