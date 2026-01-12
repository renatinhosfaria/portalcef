// ============================================
// Shop Types - CEF Shop Module
// ============================================

export type ProductCategory =
  | "UNIFORME_DIARIO"
  | "UNIFORME_EDUCACAO_FISICA"
  | "ACESSORIO";
export type OrderStatus =
  | "AGUARDANDO_PAGAMENTO"
  | "PAGO"
  | "RETIRADO"
  | "CANCELADO"
  | "EXPIRADO";
export type OrderSource = "ONLINE" | "PRESENCIAL";
export type PaymentMethod =
  | "PIX"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "DINHEIRO";
export type MovementType =
  | "ENTRADA"
  | "VENDA_ONLINE"
  | "VENDA_PRESENCIAL"
  | "AJUSTE"
  | "RESERVA"
  | "LIBERACAO";

// ============================================
// Product
// ============================================
export interface ShopProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  displayOrder: number;
  createdAt: Date;
}

export interface ShopProduct {
  id: string;
  schoolId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  basePrice: number; // em centavos
  category: ProductCategory;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopProductWithImages extends ShopProduct {
  images: string[];
}

export interface ShopProductVariant {
  id: string;
  productId: string;
  size: string;
  sku?: string | null;
  priceOverride?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopProductWithVariants extends ShopProduct {
  variants: ShopProductVariant[];
}

// ============================================
// Inventory
// ============================================
export interface ShopInventory {
  id: string;
  variantId: string;
  unitId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold?: number | null;
  updatedAt: Date;
}

export interface ShopInventoryLedger {
  id: string;
  inventoryId: string;
  movementType: MovementType;
  quantityChange: number;
  referenceId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: Date;
}

// ============================================
// Order
// ============================================
export interface ShopOrder {
  id: string;
  schoolId: string;
  unitId: string;
  orderNumber: string;
  status: OrderStatus;
  orderSource: OrderSource;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  totalAmount: number;
  installments: number;
  paymentMethod?: PaymentMethod | null;
  stripePaymentIntentId?: string | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  pickedUpAt?: Date | null;
  pickedUpBy?: string | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  createdAt: Date;
}

export interface ShopOrderItem {
  id: string;
  orderId: string;
  variantId: string;
  studentName: string;
  quantity: number;
  unitPrice: number;
}

export interface ShopOrderWithItems extends ShopOrder {
  items: ShopOrderItem[];
}

// ============================================
// Interest Request
// ============================================
export interface ShopInterestRequest {
  id: string;
  schoolId: string;
  unitId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  studentName: string;
  studentClass?: string | null;
  notes?: string | null;
  contactedAt?: Date | null;
  contactedBy?: string | null;
  createdAt: Date;
}

export interface ShopInterestItem {
  id: string;
  interestRequestId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
}

export interface ShopInterestRequestWithItems extends ShopInterestRequest {
  items: ShopInterestItem[];
}

// ============================================
// Settings
// ============================================
export interface ShopSettings {
  id: string;
  unitId: string;
  maxInstallments: number;
  isShopEnabled: boolean;
  pickupInstructions?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API Request/Response Types
// ============================================

// Product Listing (Catalog)
export interface ProductCatalogVariant {
  id: string;
  size: string;
  sku?: string | null;
  price: number; // basePrice or priceOverride
  availableStock: number;
  isAvailable: boolean;
}

export interface ProductCatalogItem extends ShopProductWithImages {
  variants: ProductCatalogVariant[];
}

export interface ProductListQuery {
  category?: ProductCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  success: true;
  data: ProductCatalogItem[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

// Create Order
export interface CreateOrderItem {
  variantId: string;
  studentName: string;
  quantity: number;
}

export interface CreateOrderRequest {
  schoolId: string;
  unitId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: CreateOrderItem[];
  installments?: number;
}

export interface CreateOrderResponse {
  success: true;
  data: {
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    expiresAt: string;
    stripeClientSecret: string;
    stripePublishableKey: string;
  };
}

// Interest Request
export interface CreateInterestItem {
  variantId: string;
  quantity: number;
}

export interface CreateInterestRequest {
  schoolId: string;
  unitId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  studentName: string;
  studentClass?: string;
  notes?: string;
  items: CreateInterestItem[];
}

// Admin - Product Management
export interface CreateProductRequest {
  schoolId: string;
  name: string;
  description?: string;
  category: ProductCategory;
  basePrice: number;
  variants: Array<{
    size: string;
    sku?: string;
    priceOverride?: number;
  }>;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  category?: ProductCategory;
  basePrice?: number;
  isActive?: boolean;
}

// Admin - Inventory Management
export interface InventoryAdjustment {
  variantId: string;
  unitId: string;
  quantityChange: number;
  notes?: string;
}

// Admin - Order Management
export interface OrderFilterQuery {
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  customerPhone?: string;
  page?: number;
  limit?: number;
}

export interface CancelOrderRequest {
  reason: string;
}

export interface MarkOrderPickedUpRequest {
  pickedUpBy: string; // userId
}
