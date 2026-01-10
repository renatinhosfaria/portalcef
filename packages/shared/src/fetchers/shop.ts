import { api, FetchError } from "./client.js";
import { serverApi, ServerFetchError } from "./server.js";
import type {
  ShopProductWithVariants,
  ShopOrderWithItems,
  ShopInterestRequestWithItems,
  ShopSettings,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateInterestRequest,
  ShopInventory,
  ShopInventoryLedger,
  CreateProductRequest,
  UpdateProductRequest,
  InventoryAdjustment,
  CancelOrderRequest,
  ProductCategory,
  OrderStatus,
} from "../types/shop.js";

// ============================================
// Types
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
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

export interface CatalogFilters {
  category?: ProductCategory;
  size?: string;
  inStock?: boolean;
  search?: string;
}

export interface OrderFilters {
  status?: OrderStatus;
  source?: "ONLINE" | "PRESENCIAL";
  search?: string;
  page?: number;
  limit?: number;
}

export interface InterestFilters {
  status?: "PENDENTE" | "CONTATADO" | "TODOS";
  search?: string;
  page?: number;
  limit?: number;
}

export interface InterestSummary {
  total: number;
  pending: number;
  contacted: number;
  topVariants: Array<{
    variantId: string;
    productName: string;
    size: string;
    count: number;
  }>;
}

// ============================================
// Client-Side Fetchers (use in React components)
// ============================================

export const shopApi = {
  // ============================================
  // Public Endpoints (no auth required)
  // ============================================

  /**
   * Fetch catalog products with stock availability
   */
  getCatalog: async (
    schoolId: string,
    unitId: string,
    filters?: CatalogFilters,
  ): Promise<ShopProductWithVariants[]> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.size) params.append("size", filters.size);
    if (filters?.inStock !== undefined)
      params.append("inStock", String(filters.inStock));
    if (filters?.search) params.append("search", filters.search);

    const query = params.toString() ? `?${params.toString()}` : "";
    return api.get<ShopProductWithVariants[]>(
      `/shop/catalog/${schoolId}/${unitId}${query}`,
    );
  },

  /**
   * Get product detail with variants and stock
   */
  getProduct: async (productId: string): Promise<ShopProductWithVariants> => {
    return api.get<ShopProductWithVariants>(`/shop/products/${productId}`);
  },

  /**
   * Create order and get Stripe payment intent
   */
  createOrder: async (
    data: CreateOrderRequest,
  ): Promise<CreateOrderResponse["data"]> => {
    return api.post<CreateOrderResponse["data"]>("/shop/orders", data);
  },

  /**
   * Lookup order by number + phone (public, requires phone validation)
   */
  getOrderByNumber: async (
    orderNumber: string,
    phone: string,
  ): Promise<ShopOrderWithItems> => {
    return api.get<ShopOrderWithItems>(
      `/shop/orders/${orderNumber}?phone=${encodeURIComponent(phone)}`,
    );
  },

  /**
   * Register interest for out-of-stock items
   */
  createInterest: async (
    data: CreateInterestRequest,
  ): Promise<{ requestId: string; message: string }> => {
    return api.post<{ requestId: string; message: string }>(
      "/shop/interest",
      data,
    );
  },

  // ============================================
  // Admin Endpoints (auth required)
  // ============================================

  admin: {
    // ---------- Products ----------

    /**
     * Create a new product with variants
     */
    createProduct: async (
      data: CreateProductRequest,
    ): Promise<ShopProductWithVariants> => {
      return api.post<ShopProductWithVariants>("/shop/admin/products", data);
    },

    /**
     * Update product details
     */
    updateProduct: async (
      productId: string,
      data: UpdateProductRequest,
    ): Promise<ShopProductWithVariants> => {
      return api.patch<ShopProductWithVariants>(
        `/shop/admin/products/${productId}`,
        data,
      );
    },

    /**
     * Soft delete product
     */
    deleteProduct: async (productId: string): Promise<void> => {
      return api.delete(`/shop/admin/products/${productId}`);
    },

    // ---------- Inventory ----------

    /**
     * Get inventory for a variant at a unit
     */
    getInventory: async (
      variantId: string,
      unitId: string,
    ): Promise<ShopInventory> => {
      return api.get<ShopInventory>(
        `/shop/admin/inventory/${variantId}/${unitId}`,
      );
    },

    /**
     * Add stock (ENTRADA)
     */
    addStock: async (
      data: InventoryAdjustment & { quantity: number },
    ): Promise<ShopInventory> => {
      return api.post<ShopInventory>("/shop/admin/inventory/entry", data);
    },

    /**
     * Adjust stock manually (AJUSTE)
     */
    adjustStock: async (data: InventoryAdjustment): Promise<ShopInventory> => {
      return api.post<ShopInventory>("/shop/admin/inventory/adjust", data);
    },

    /**
     * Get inventory movement history
     */
    getInventoryLedger: async (
      variantId: string,
    ): Promise<ShopInventoryLedger[]> => {
      return api.get<ShopInventoryLedger[]>(
        `/shop/admin/inventory/ledger/${variantId}`,
      );
    },

    // ---------- Orders ----------

    /**
     * List orders with filters and pagination
     */
    listOrders: async (
      filters?: OrderFilters,
    ): Promise<PaginatedResponse<ShopOrderWithItems>> => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.source) params.append("source", filters.source);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const query = params.toString() ? `?${params.toString()}` : "";
      return api.get<PaginatedResponse<ShopOrderWithItems>>(
        `/shop/admin/orders${query}`,
      );
    },

    /**
     * Get order by ID (admin, no phone validation)
     */
    getOrder: async (orderId: string): Promise<ShopOrderWithItems> => {
      return api.get<ShopOrderWithItems>(`/shop/admin/orders/${orderId}`);
    },

    /**
     * Mark order as picked up
     */
    markPickedUp: async (orderId: string): Promise<ShopOrderWithItems> => {
      return api.patch<ShopOrderWithItems>(
        `/shop/admin/orders/${orderId}/pickup`,
        {},
      );
    },

    /**
     * Cancel order with mandatory reason
     */
    cancelOrder: async (
      orderId: string,
      data: CancelOrderRequest,
    ): Promise<ShopOrderWithItems> => {
      return api.patch<ShopOrderWithItems>(
        `/shop/admin/orders/${orderId}/cancel`,
        data,
      );
    },

    /**
     * Create presential sale (directly RETIRADO)
     */
    createPresentialSale: async (data: {
      unitId: string;
      customerName: string;
      customerPhone: string;
      paymentMethod: "DINHEIRO" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "PIX";
      items: Array<{
        variantId: string;
        studentName: string;
        quantity: number;
      }>;
    }): Promise<ShopOrderWithItems> => {
      return api.post<ShopOrderWithItems>(
        "/shop/admin/orders/presential",
        data,
      );
    },

    // ---------- Interest ----------

    /**
     * List interest requests with filters
     */
    listInterests: async (
      filters?: InterestFilters,
    ): Promise<PaginatedResponse<ShopInterestRequestWithItems>> => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const query = params.toString() ? `?${params.toString()}` : "";
      return api.get<PaginatedResponse<ShopInterestRequestWithItems>>(
        `/shop/admin/interest${query}`,
      );
    },

    /**
     * Get interest summary/analytics
     */
    getInterestSummary: async (): Promise<InterestSummary> => {
      return api.get<InterestSummary>("/shop/admin/interest/summary");
    },

    /**
     * Mark interest request as contacted
     */
    markContacted: async (
      requestId: string,
    ): Promise<ShopInterestRequestWithItems> => {
      return api.patch<ShopInterestRequestWithItems>(
        `/shop/admin/interest/${requestId}/contacted`,
        {},
      );
    },

    // ---------- Settings ----------

    /**
     * Get shop settings for a unit
     */
    getSettings: async (unitId: string): Promise<ShopSettings> => {
      return api.get<ShopSettings>(`/shop/admin/settings/${unitId}`);
    },

    /**
     * Update shop settings
     */
    updateSettings: async (
      unitId: string,
      data: Partial<
        Omit<ShopSettings, "id" | "unitId" | "createdAt" | "updatedAt">
      >,
    ): Promise<ShopSettings> => {
      return api.patch<ShopSettings>(`/shop/admin/settings/${unitId}`, data);
    },

    // ---------- Dashboard ----------

    /**
     * Get dashboard metrics
     */
    getDashboard: async (): Promise<{
      todayOrders: number;
      todayRevenue: number;
      pendingPickups: number;
      lowStockAlerts: number;
      pendingInterests: number;
      recentOrders: ShopOrderWithItems[];
    }> => {
      return api.get("/shop/admin/dashboard");
    },
  },
};

// ============================================
// Server-Side Fetchers (use in Server Components)
// ============================================

export const shopServerApi = {
  /**
   * Fetch catalog products (server-side)
   */
  getCatalog: async (
    schoolId: string,
    unitId: string,
    filters?: CatalogFilters,
    cookies?: string,
  ): Promise<ShopProductWithVariants[]> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.size) params.append("size", filters.size);
    if (filters?.inStock !== undefined)
      params.append("inStock", String(filters.inStock));
    if (filters?.search) params.append("search", filters.search);

    const query = params.toString() ? `?${params.toString()}` : "";
    return serverApi.get<ShopProductWithVariants[]>(
      `/shop/catalog/${schoolId}/${unitId}${query}`,
      { cookies },
    );
  },

  /**
   * Get product detail (server-side)
   */
  getProduct: async (
    productId: string,
    cookies?: string,
  ): Promise<ShopProductWithVariants> => {
    return serverApi.get<ShopProductWithVariants>(
      `/shop/products/${productId}`,
      { cookies },
    );
  },

  /**
   * Get order by number + phone (server-side)
   */
  getOrderByNumber: async (
    orderNumber: string,
    phone: string,
    cookies?: string,
  ): Promise<ShopOrderWithItems> => {
    return serverApi.get<ShopOrderWithItems>(
      `/shop/orders/${orderNumber}?phone=${encodeURIComponent(phone)}`,
      { cookies },
    );
  },

  /**
   * Get shop settings (server-side)
   */
  getSettings: async (
    unitId: string,
    cookies?: string,
  ): Promise<ShopSettings> => {
    return serverApi.get<ShopSettings>(`/shop/admin/settings/${unitId}`, {
      cookies,
    });
  },
};

// Re-export errors for convenience
export { FetchError, ServerFetchError };
