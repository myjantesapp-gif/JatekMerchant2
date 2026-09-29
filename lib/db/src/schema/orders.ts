import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  reference: text("reference").unique(),
  userId: integer("user_id").notNull(),
  restaurantId: integer("restaurant_id").notNull(),
  driverId: integer("driver_id"),
  restaurantName: text("restaurant_name").notNull(),
  userName: text("user_name").notNull(),
  status: text("status").notNull().default("pending"),
  subtotal: real("subtotal").notNull(),
  deliveryFee: real("delivery_fee").notNull().default(0),
  /** Discount applied via promo code (MAD amount). */
  discountAmount: real("discount_amount").notNull().default(0),
  /** Immutable pricing snapshot for orders created after the fee model rollout. */
  currency: text("currency").notNull().default("MAD"),
  vatRate: real("vat_rate").notNull().default(0),
  vatAmount: real("vat_amount").notNull().default(0),
  serviceFee: real("service_fee").notNull().default(0),
  commissionRate: real("commission_rate").notNull().default(0),
  merchantEarning: real("merchant_earning").notNull().default(0),
  driverEarning: real("driver_earning").notNull().default(0),
  jatekEarning: real("jatek_earning").notNull().default(0),
  /** Cumulative customer refunds and the corresponding Jatek commission reversal. */
  refundedAmount: real("refunded_amount").notNull().default(0),
  refundedJatekEarning: real("refunded_jatek_earning").notNull().default(0),
  pricingVersion: text("pricing_version").notNull().default("legacy"),
  total: real("total").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  notes: text("notes"),
  estimatedDeliveryTime: integer("estimated_delivery_time"),
  /** 3-digit numeric code printed on the kitchen ticket for in-store pickup. */
  kitchenCode: text("kitchen_code"),
  /** 4-digit numeric code shown to the customer at order acceptance; the driver
   *  must enter or scan it to confirm hand-off (a la Uber Eats / Glovo). */
  pickupCode: text("pickup_code"),
  /** Delivery code validity window. Null is kept for legacy orders created before this field. */
  pickupCodeExpiresAt: timestamp("pickup_code_expires_at", { withTimezone: true }),
  /** Set atomically when the driver successfully confirms the hand-off. */
  pickupCodeUsedAt: timestamp("pickup_code_used_at", { withTimezone: true }),
  /** "asap" (default) or "scheduled" */
  deliveryType: text("delivery_type").notNull().default("asap"),
  /** When deliveryType="scheduled", the requested delivery timestamp. */
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  /** Customer opted for contactless (leave-at-door) delivery. */
  isContactless: boolean("is_contactless").notNull().default(false),
  /** Photo URL uploaded by driver as proof-of-delivery for contactless orders. */
  proofPhotoUrl: text("proof_photo_url"),
  /** Applied promo code string (stored for reference). */
  promoCode: text("promo_code"),
  /** Payment method chosen by the customer: "cash" or "card". */
  paymentMethod: text("payment_method").notNull().default("cash"),
  /** Merchant acceptance time, used to measure acknowledgement and preparation SLAs. */
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  /** Time the kitchen marked the order ready for collection. */
  readyAt: timestamp("ready_at", { withTimezone: true }),
  /** Driver hand-off time. Delivery confirmation remains handled by its OTP route. */
  handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
  /** Merchant-selected preparation estimate in minutes. */
  prepTimeMinutes: integer("prep_time_minutes").notNull().default(20),
  /** 1-5 star rating the customer gives the driver after delivery. */
  driverRating: integer("driver_rating"),
  driverRatingComment: text("driver_rating_comment"),
  /** 1-5 star rating the driver gives the customer. */
  customerRating: integer("customer_rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  menuItemId: integer("menu_item_id").notNull(),
  menuItemName: text("menu_item_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),
  /** Selected size label, e.g. "Large" */
  selectedSize: text("selected_size"),
  /** Price adjustment for the selected size */
  selectedSizePriceAdjustment: real("selected_size_price_adjustment"),
  /** JSON array of selected extra labels, e.g. ["Fromage extra"] */
  selectedExtras: text("selected_extras"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
