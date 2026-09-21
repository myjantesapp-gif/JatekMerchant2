import bcrypt from "bcryptjs";
import { db, driversTable, pool, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type AccountRole = "super_admin" | "driver" | "restaurant_owner" | "customer";

type AccountBatch = {
  role: AccountRole;
  emails: string[];
};

function displayName(email: string): string {
  return email
    .split("@", 1)[0]
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readAccounts(): AccountBatch[] {
  const raw = process.env.SEED_ACCOUNTS_JSON;
  if (!raw) throw new Error("SEED_ACCOUNTS_JSON is required");

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("SEED_ACCOUNTS_JSON must be an array");

  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid account batch");
    const value = entry as { role?: unknown; emails?: unknown };
    const allowedRoles: AccountRole[] = ["super_admin", "driver", "restaurant_owner", "customer"];
    if (typeof value.role !== "string" || !allowedRoles.includes(value.role as AccountRole)) {
      throw new Error(`Invalid account role: ${String(value.role)}`);
    }
    if (
      !Array.isArray(value.emails) ||
      value.emails.length === 0 ||
      value.emails.some((email) => typeof email !== "string" || !email.includes("@"))
    ) {
      throw new Error(`Invalid emails for role ${value.role}`);
    }
    return {
      role: value.role as AccountRole,
      emails: value.emails.map((email) => email.trim().toLowerCase()),
    };
  });
}

async function main(): Promise<void> {
  const password = process.env.SEED_ACCOUNT_PASSWORD;
  if (!password) throw new Error("SEED_ACCOUNT_PASSWORD is required");

  const hashedPassword = await bcrypt.hash(password, 10);
  const accounts = readAccounts();
  const seen = new Set<string>();

  for (const batch of accounts) {
    for (const email of batch.emails) {
      if (seen.has(email)) throw new Error(`Duplicate email in seed request: ${email}`);
      seen.add(email);

      const name = displayName(email);
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      let userId: number;
      if (existing) {
        if (existing.role !== batch.role) {
          throw new Error(`Role mismatch for ${email}: existing=${existing.role}, requested=${batch.role}`);
        }
        const [updated] = await db
          .update(usersTable)
          .set({ name, password: hashedPassword, isActive: true })
          .where(eq(usersTable.id, existing.id))
          .returning({ id: usersTable.id });
        userId = updated.id;
        console.log(`[seed-accounts] updated ${batch.role} ${email}`);
      } else {
        const [created] = await db
          .insert(usersTable)
          .values({
            name,
            email,
            password: hashedPassword,
            role: batch.role,
            phone: null,
            loyaltyPoints: 0,
            isActive: true,
          })
          .returning({ id: usersTable.id });
        userId = created.id;
        console.log(`[seed-accounts] created ${batch.role} ${email}`);
      }

      if (batch.role === "driver") {
        const [driver] = await db
          .select({ id: driversTable.id })
          .from(driversTable)
          .where(eq(driversTable.userId, userId))
          .limit(1);

        if (driver) {
          await db
            .update(driversTable)
            .set({ name, isAvailable: true })
            .where(eq(driversTable.id, driver.id));
          console.log(`[seed-accounts] updated driver profile for ${email}`);
        } else {
          await db.insert(driversTable).values({
            userId,
            name,
            phone: null,
            isAvailable: true,
          });
          console.log(`[seed-accounts] created driver profile for ${email}`);
        }
      }
    }
  }
}

try {
  await main();
} finally {
  await pool.end();
}