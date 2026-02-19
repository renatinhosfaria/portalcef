import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { schools } from "./schools.js";
import { units } from "./units.js";
import { users } from "./users.js";

// ============================================
// Product Category Enum
// ============================================
export const productCategoryEnum = [
  "UNIFORME_FEMININO",
  "UNIFORME_MASCULINO",
  "UNIFORME_UNISSEX",
  "ACESSORIO",
] as const;
export type ProductCategory = (typeof productCategoryEnum)[number];

// ============================================
// Order Status Enum
// ============================================
export const orderStatusEnum = [
  "AGUARDANDO_PAGAMENTO",
  "PAGO",
  "RETIRADO",
  "CANCELADO",
  "EXPIRADO",
] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

// ============================================
// Order Source Enum
// ============================================
export const orderSourceEnum = ["ONLINE", "PRESENCIAL"] as const;
export type OrderSource = (typeof orderSourceEnum)[number];

// ============================================
// Payment Method Enum
// ============================================
export const paymentMethodEnum = [
  "PIX",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "DINHEIRO",
  "BRINDE",
  "MULTIPLO",
] as const;
export type PaymentMethod = (typeof paymentMethodEnum)[number];

// ============================================
// Inventory Movement Type Enum
// ============================================
export const movementTypeEnum = [
  "ENTRADA",
  "VENDA_ONLINE",
  "VENDA_PRESENCIAL",
  "AJUSTE",
  "RESERVA",
  "LIBERACAO",
] as const;
export type MovementType = (typeof movementTypeEnum)[number];

// ============================================
// Table: shop_products
// ============================================
export const shopProducts = pgTable(
  "shop_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 500 }),
    basePrice: integer("base_price").notNull(), // em centavos
    category: text("category", { enum: productCategoryEnum }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    schoolIdIdx: index("shop_products_school_id_idx").on(table.schoolId),
    categoryIdx: index("shop_products_category_idx").on(table.category),
    isActiveIdx: index("shop_products_is_active_idx").on(table.isActive),
  }),
);

export type ShopProduct = typeof shopProducts.$inferSelect;
export type NewShopProduct = typeof shopProducts.$inferInsert;

// ============================================
// Table: shop_product_images
// ============================================
export const shopProductImages = pgTable(
  "shop_product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => shopProducts.id, { onDelete: "cascade" }),
    imageUrl: varchar("image_url", { length: 500 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    productIdIdx: index("shop_product_images_product_id_idx").on(
      table.productId,
    ),
    displayOrderIdx: index("shop_product_images_display_order_idx").on(
      table.displayOrder,
    ),
  }),
);

export type ShopProductImage = typeof shopProductImages.$inferSelect;
export type NewShopProductImage = typeof shopProductImages.$inferInsert;

// ============================================
// Table: shop_product_variants
// ============================================
export const shopProductVariants = pgTable(
  "shop_product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => shopProducts.id, { onDelete: "cascade" }),
    size: varchar("size", { length: 20 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    priceOverride: integer("price_override"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    productIdIdx: index("shop_product_variants_product_id_idx").on(
      table.productId,
    ),
    uniqueProductSize: uniqueIndex(
      "shop_product_variants_product_size_unique",
    ).on(table.productId, table.size),
  }),
);

export type ShopProductVariant = typeof shopProductVariants.$inferSelect;
export type NewShopProductVariant = typeof shopProductVariants.$inferInsert;

// ============================================
// Table: shop_inventory
// ============================================
export const shopInventory = pgTable(
  "shop_inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => shopProductVariants.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").default(5),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unitIdIdx: index("shop_inventory_unit_id_idx").on(table.unitId),
    quantityIdx: index("shop_inventory_quantity_idx").on(table.quantity),
    uniqueVariantUnit: uniqueIndex("shop_inventory_variant_unit_unique").on(
      table.variantId,
      table.unitId,
    ),
  }),
);

export type ShopInventory = typeof shopInventory.$inferSelect;
export type NewShopInventory = typeof shopInventory.$inferInsert;

// ============================================
// Table: shop_inventory_ledger
// ============================================
export const shopInventoryLedger = pgTable(
  "shop_inventory_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inventoryId: uuid("inventory_id")
      .notNull()
      .references(() => shopInventory.id, { onDelete: "cascade" }),
    movementType: text("movement_type", { enum: movementTypeEnum }).notNull(),
    quantityChange: integer("quantity_change").notNull(),
    referenceId: text("reference_id"), // Pode ser UUID de pedido ou orderNumber (6 dígitos)
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    inventoryIdIdx: index("shop_inventory_ledger_inventory_id_idx").on(
      table.inventoryId,
    ),
    movementTypeIdx: index("shop_inventory_ledger_movement_type_idx").on(
      table.movementType,
    ),
    createdAtIdx: index("shop_inventory_ledger_created_at_idx").on(
      table.createdAt,
    ),
    referenceIdIdx: index("shop_inventory_ledger_reference_id_idx").on(
      table.referenceId,
    ),
  }),
);

export type ShopInventoryLedger = typeof shopInventoryLedger.$inferSelect;
export type NewShopInventoryLedger = typeof shopInventoryLedger.$inferInsert;

// ============================================
// Table: shop_orders
// ============================================
export const shopOrders = pgTable(
  "shop_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
    status: text("status", { enum: orderStatusEnum })
      .notNull()
      .default("AGUARDANDO_PAGAMENTO"),
    orderSource: text("order_source", { enum: orderSourceEnum })
      .notNull()
      .default("ONLINE"),
    customerName: varchar("customer_name", { length: 200 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    customerEmail: varchar("customer_email", { length: 100 }),
    totalAmount: integer("total_amount").notNull(),
    installments: integer("installments").default(1),
    paymentMethod: text("payment_method", { enum: paymentMethodEnum }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    pickedUpBy: uuid("picked_up_by").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    schoolIdIdx: index("shop_orders_school_id_idx").on(table.schoolId),
    unitIdIdx: index("shop_orders_unit_id_idx").on(table.unitId),
    statusIdx: index("shop_orders_status_idx").on(table.status),
    customerPhoneIdx: index("shop_orders_customer_phone_idx").on(
      table.customerPhone,
    ),
    createdAtIdx: index("shop_orders_created_at_idx").on(table.createdAt),
    expiresAtIdx: index("shop_orders_expires_at_idx").on(table.expiresAt),
    orderNumberUnique: uniqueIndex("shop_orders_order_number_unique").on(
      table.orderNumber,
    ),
  }),
);

export type ShopOrder = typeof shopOrders.$inferSelect;
export type NewShopOrder = typeof shopOrders.$inferInsert;

// ============================================
// Table: shop_order_items
// ============================================
export const shopOrderItems = pgTable(
  "shop_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => shopProductVariants.id, { onDelete: "restrict" }),
    studentName: varchar("student_name", { length: 200 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (table) => ({
    orderIdIdx: index("shop_order_items_order_id_idx").on(table.orderId),
    variantIdIdx: index("shop_order_items_variant_id_idx").on(table.variantId),
  }),
);

export type ShopOrderItem = typeof shopOrderItems.$inferSelect;
export type NewShopOrderItem = typeof shopOrderItems.$inferInsert;

// ============================================
// Table: shop_interest_requests
// ============================================
export const shopInterestRequests = pgTable(
  "shop_interest_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    customerName: varchar("customer_name", { length: 200 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    customerEmail: varchar("customer_email", { length: 100 }),
    studentName: varchar("student_name", { length: 200 }).notNull(),
    studentClass: varchar("student_class", { length: 50 }),
    notes: text("notes"),
    status: text("status").notNull().default("PENDENTE"),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    contactedBy: uuid("contacted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    schoolIdIdx: index("shop_interest_requests_school_id_idx").on(
      table.schoolId,
    ),
    unitIdIdx: index("shop_interest_requests_unit_id_idx").on(table.unitId),
    customerPhoneIdx: index("shop_interest_requests_customer_phone_idx").on(
      table.customerPhone,
    ),
    contactedAtIdx: index("shop_interest_requests_contacted_at_idx").on(
      table.contactedAt,
    ),
    createdAtIdx: index("shop_interest_requests_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export type ShopInterestRequest = typeof shopInterestRequests.$inferSelect;
export type NewShopInterestRequest = typeof shopInterestRequests.$inferInsert;

// ============================================
// Table: shop_interest_items
// ============================================
export const shopInterestItems = pgTable(
  "shop_interest_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interestRequestId: uuid("interest_request_id")
      .notNull()
      .references(() => shopInterestRequests.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => shopProductVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    interestRequestIdIdx: index(
      "shop_interest_items_interest_request_id_idx",
    ).on(table.interestRequestId),
    variantIdIdx: index("shop_interest_items_variant_id_idx").on(
      table.variantId,
    ),
  }),
);

export type ShopInterestItem = typeof shopInterestItems.$inferSelect;
export type NewShopInterestItem = typeof shopInterestItems.$inferInsert;

// ============================================
// Table: shop_settings
// ============================================
export const shopSettings = pgTable(
  "shop_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" })
      .unique(),
    maxInstallments: integer("max_installments").default(1).notNull(),
    isShopEnabled: boolean("is_shop_enabled").default(true).notNull(),
    pickupInstructions: text("pickup_instructions"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unitIdUnique: uniqueIndex("shop_settings_unit_id_unique").on(table.unitId),
  }),
);

export type ShopSettings = typeof shopSettings.$inferSelect;
export type NewShopSettings = typeof shopSettings.$inferInsert;


// ============================================
// Table: shop_order_payments
// ============================================
export const shopOrderPayments = pgTable(
  "shop_order_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrders.id, { onDelete: "cascade" }),
    paymentMethod: text("payment_method", { enum: paymentMethodEnum }).notNull(),
    amount: integer("amount").notNull(), // em centavos
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orderIdIdx: index("shop_order_payments_order_id_idx").on(table.orderId),
  }),
);

export type ShopOrderPayment = typeof shopOrderPayments.$inferSelect;
export type NewShopOrderPayment = typeof shopOrderPayments.$inferInsert;

// ============================================
// Zod Schemas
// ============================================
export const insertShopProductSchema = createInsertSchema(shopProducts);
export const selectShopProductSchema = createSelectSchema(shopProducts);

export const insertShopProductVariantSchema =
  createInsertSchema(shopProductVariants);
export const selectShopProductVariantSchema =
  createSelectSchema(shopProductVariants);

export const insertShopOrderSchema = createInsertSchema(shopOrders);
export const selectShopOrderSchema = createSelectSchema(shopOrders);

export const insertShopInterestRequestSchema =
  createInsertSchema(shopInterestRequests);
export const selectShopInterestRequestSchema =
  createSelectSchema(shopInterestRequests);

export const insertShopSettingsSchema = createInsertSchema(shopSettings);
export const selectShopSettingsSchema = createSelectSchema(shopSettings);

export const insertShopOrderPaymentSchema = createInsertSchema(shopOrderPayments);
export const selectShopOrderPaymentSchema = createSelectSchema(shopOrderPayments);

// End of file
