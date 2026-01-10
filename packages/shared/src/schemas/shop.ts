import { z } from "zod";

// ============================================
// Enums
// ============================================
export const productCategorySchema = z.enum([
  "UNIFORME_DIARIO",
  "UNIFORME_EDUCACAO_FISICA",
  "ACESSORIO",
]);

export const orderStatusSchema = z.enum([
  "AGUARDANDO_PAGAMENTO",
  "PAGO",
  "RETIRADO",
  "CANCELADO",
  "EXPIRADO",
]);

export const orderSourceSchema = z.enum(["ONLINE", "PRESENCIAL"]);

export const paymentMethodSchema = z.enum([
  "PIX",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "DINHEIRO",
]);

export const movementTypeSchema = z.enum([
  "ENTRADA",
  "VENDA_ONLINE",
  "VENDA_PRESENCIAL",
  "AJUSTE",
  "RESERVA",
  "LIBERACAO",
]);

// ============================================
// Shop Product Schemas
// ============================================
export const createProductVariantSchema = z.object({
  size: z.string().min(1, "Tamanho é obrigatório").max(20),
  sku: z.string().max(100).optional(),
  priceOverride: z.number().int().positive().optional(),
});

export const createProductSchema = z.object({
  schoolId: z.string().uuid("ID de escola inválido"),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().optional(),
  category: productCategorySchema,
  basePrice: z.number().int().positive("Preço deve ser maior que zero"),
  variants: z
    .array(createProductVariantSchema)
    .min(1, "Pelo menos uma variante é obrigatória"),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: productCategorySchema.optional(),
  basePrice: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductVariantSchema = z.object({
  size: z.string().min(1).max(20).optional(),
  sku: z.string().max(100).optional(),
  priceOverride: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================
// Order Schemas
// ============================================
export const phoneSchema = z
  .string()
  .min(10, "Telefone deve ter pelo menos 10 dígitos")
  .max(20, "Telefone deve ter no máximo 20 dígitos")
  .transform((val) => val.replace(/\D/g, "")); // Remove tudo exceto dígitos

export const createOrderItemSchema = z.object({
  variantId: z.string().uuid("ID de variante inválido"),
  studentName: z.string().min(1, "Nome do aluno é obrigatório").max(200),
  quantity: z.number().int().positive("Quantidade deve ser maior que zero"),
});

export const createOrderSchema = z.object({
  schoolId: z.string().uuid("ID de escola invalido"),
  unitId: z.string().uuid("ID de unidade inválido"),
  customerName: z.string().min(1, "Nome do cliente é obrigatório").max(200),
  customerPhone: phoneSchema,
  customerEmail: z.string().email("Email inválido").optional(),
  items: z
    .array(createOrderItemSchema)
    .min(1, "Pelo menos um item é obrigatório"),
  installments: z.number().int().min(1).max(12).default(1),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1, "Motivo de cancelamento é obrigatório"),
});

export const markOrderPickedUpSchema = z.object({
  pickedUpBy: z.string().uuid("ID de usuário inválido"),
});

// Checkout schema for frontend form validation (alias for createOrderSchema)
// Convenience export for loja app checkout page
export const checkoutSchema = z.object({
  customerName: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(200),
  customerPhone: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .refine((val) => val.length >= 10 && val.length <= 13, "Telefone inválido"),
  customerEmail: z.string().email("Email inválido").optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid("ID de variante inválido"),
        studentName: z
          .string()
          .min(3, "Nome do aluno deve ter 3+ caracteres")
          .max(200),
        quantity: z
          .number()
          .int()
          .min(1)
          .max(10, "Máximo 10 unidades por item"),
      }),
    )
    .min(1, "Carrinho vazio"),
  installments: z.number().int().min(1).max(12).default(1),
});

// ============================================
// Interest Request Schemas
// ============================================
export const createInterestItemSchema = z.object({
  variantId: z.string().uuid("ID de variante inválido"),
  quantity: z.number().int().positive("Quantidade deve ser maior que zero"),
});

export const createInterestRequestSchema = z.object({
  schoolId: z.string().uuid("ID de escola invalido"),
  unitId: z.string().uuid("ID de unidade inválido"),
  customerName: z.string().min(1, "Nome do cliente é obrigatório").max(200),
  customerPhone: phoneSchema,
  customerEmail: z.string().email("Email inválido").optional(),
  studentName: z.string().min(1, "Nome do aluno é obrigatório").max(200),
  studentClass: z.string().max(50).optional(),
  notes: z.string().optional(),
  items: z
    .array(createInterestItemSchema)
    .min(1, "Pelo menos um item é obrigatório"),
});

// ============================================
// Inventory Schemas
// ============================================
export const inventoryAdjustmentSchema = z.object({
  variantId: z.string().uuid("ID de variante inválido"),
  unitId: z.string().uuid("ID de unidade inválido"),
  quantityChange: z.number().int(),
  notes: z.string().optional(),
});

// ============================================
// Settings Schemas
// ============================================
export const updateShopSettingsSchema = z.object({
  maxInstallments: z.number().int().min(1).max(12).optional(),
  isShopEnabled: z.boolean().optional(),
  pickupInstructions: z.string().optional(),
});

// ============================================
// Query/Filter Schemas
// ============================================
export const productListQuerySchema = z.object({
  category: productCategorySchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const orderFilterQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customerPhone: phoneSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const interestRequestQuerySchema = z.object({
  contacted: z.enum(["true", "false"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Export types from schemas
// ============================================
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateInterestRequestInput = z.infer<
  typeof createInterestRequestSchema
>;
export type InventoryAdjustmentInput = z.infer<
  typeof inventoryAdjustmentSchema
>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type OrderFilterQuery = z.infer<typeof orderFilterQuerySchema>;
