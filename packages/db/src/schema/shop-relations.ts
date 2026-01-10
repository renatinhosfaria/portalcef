import { relations } from "drizzle-orm";
import {
  shopProducts,
  shopProductVariants,
  shopInventory,
  shopInventoryLedger,
  shopOrders,
  shopOrderItems,
  shopInterestRequests,
  shopInterestItems,
  shopSettings,
} from "./shop";
import { schools } from "./schools";
import { units } from "./units";
import { users } from "./users";

// ============================================
// Shop Products Relations
// ============================================
export const shopProductsRelations = relations(
  shopProducts,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [shopProducts.schoolId],
      references: [schools.id],
    }),
    variants: many(shopProductVariants),
  }),
);

// ============================================
// Shop Product Variants Relations
// ============================================
export const shopProductVariantsRelations = relations(
  shopProductVariants,
  ({ one, many }) => ({
    product: one(shopProducts, {
      fields: [shopProductVariants.productId],
      references: [shopProducts.id],
    }),
    inventory: many(shopInventory),
    orderItems: many(shopOrderItems),
    interestItems: many(shopInterestItems),
  }),
);

// ============================================
// Shop Inventory Relations
// ============================================
export const shopInventoryRelations = relations(
  shopInventory,
  ({ one, many }) => ({
    variant: one(shopProductVariants, {
      fields: [shopInventory.variantId],
      references: [shopProductVariants.id],
    }),
    unit: one(units, {
      fields: [shopInventory.unitId],
      references: [units.id],
    }),
    ledger: many(shopInventoryLedger),
  }),
);

// ============================================
// Shop Inventory Ledger Relations
// ============================================
export const shopInventoryLedgerRelations = relations(
  shopInventoryLedger,
  ({ one }) => ({
    inventory: one(shopInventory, {
      fields: [shopInventoryLedger.inventoryId],
      references: [shopInventory.id],
    }),
    createdByUser: one(users, {
      fields: [shopInventoryLedger.createdBy],
      references: [users.id],
    }),
  }),
);

// ============================================
// Shop Orders Relations
// ============================================
export const shopOrdersRelations = relations(shopOrders, ({ one, many }) => ({
  school: one(schools, {
    fields: [shopOrders.schoolId],
    references: [schools.id],
  }),
  unit: one(units, {
    fields: [shopOrders.unitId],
    references: [units.id],
  }),
  pickedUpByUser: one(users, {
    fields: [shopOrders.pickedUpBy],
    references: [users.id],
    relationName: "pickedUpBy",
  }),
  cancelledByUser: one(users, {
    fields: [shopOrders.cancelledBy],
    references: [users.id],
    relationName: "cancelledBy",
  }),
  items: many(shopOrderItems),
}));

// ============================================
// Shop Order Items Relations
// ============================================
export const shopOrderItemsRelations = relations(shopOrderItems, ({ one }) => ({
  order: one(shopOrders, {
    fields: [shopOrderItems.orderId],
    references: [shopOrders.id],
  }),
  variant: one(shopProductVariants, {
    fields: [shopOrderItems.variantId],
    references: [shopProductVariants.id],
  }),
}));

// ============================================
// Shop Interest Requests Relations
// ============================================
export const shopInterestRequestsRelations = relations(
  shopInterestRequests,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [shopInterestRequests.schoolId],
      references: [schools.id],
    }),
    unit: one(units, {
      fields: [shopInterestRequests.unitId],
      references: [units.id],
    }),
    contactedByUser: one(users, {
      fields: [shopInterestRequests.contactedBy],
      references: [users.id],
    }),
    items: many(shopInterestItems),
  }),
);

// ============================================
// Shop Interest Items Relations
// ============================================
export const shopInterestItemsRelations = relations(
  shopInterestItems,
  ({ one }) => ({
    interestRequest: one(shopInterestRequests, {
      fields: [shopInterestItems.interestRequestId],
      references: [shopInterestRequests.id],
    }),
    variant: one(shopProductVariants, {
      fields: [shopInterestItems.variantId],
      references: [shopProductVariants.id],
    }),
  }),
);

// ============================================
// Shop Settings Relations
// ============================================
export const shopSettingsRelations = relations(shopSettings, ({ one }) => ({
  unit: one(units, {
    fields: [shopSettings.unitId],
    references: [units.id],
  }),
}));
