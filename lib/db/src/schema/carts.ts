import { pgTable, serial, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { restaurantsTable } from "./restaurants";
import { menuItemsTable } from "./menuItems";

export const cartsTable = pgTable("carts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull().references(() => cartsTable.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItemsTable.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  selectedSizeId: integer("selected_size_id"),
  selectedExtraIds: integer("selected_extra_ids").array(),
  unitPrice: real("unit_price").notNull().default(0),
  subtotal: real("subtotal").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCartSchema = createInsertSchema(cartsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCartItemSchema = createInsertSchema(cartItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCart = z.infer<typeof insertCartSchema>;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type Cart = typeof cartsTable.$inferSelect;
export type CartItem = typeof cartItemsTable.$inferSelect;