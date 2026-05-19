import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { validate } from "class-validator";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { StorageController } from "../../common/storage/storage.controller";
import { ShopAdminController } from "./shop-admin.controller";
import { ShopInterestService } from "./shop-interest.service";
import { ShopInventoryService } from "./shop-inventory.service";
import { ShopOrdersService } from "./shop-orders.service";
import { ShopProductsService } from "./shop-products.service";
import { ShopPublicController } from "./shop-public.controller";
import { PaymentsWebhookController } from "../payments/payments-webhook.controller";
import { PaymentsService } from "../payments/payments.service";
import { ShopExpirationJob } from "./jobs/shop-expiration.job";
import { CatalogFiltersDto, CreateProductDto } from "./dto/product.dto";
import { ListOrdersDto } from "./dto/order.dto";
import { gte, shopProducts, sql } from "@essencia/db";
import {
  canAccessShopSchool,
  canAccessShopUnit,
  isMasterShopScope,
} from "./shop-tenant-scope";

const mockInterestRequestInsert = {
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};
const mockInterestItemsInsert = {
  values: jest.fn().mockResolvedValue(undefined),
};
const mockOrderInsert = {
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};
const mockOrderItemsInsert = {
  values: jest.fn().mockResolvedValue(undefined),
};
const mockOrderPaymentsInsert = {
  values: jest.fn().mockResolvedValue(undefined),
};
const mockStripeWebhookEventsInsert = {
  values: jest.fn().mockResolvedValue(undefined),
};
const mockInventoryLedgerInsert = {
  values: jest.fn().mockResolvedValue(undefined),
};
const mockProductInsert = {
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};
const mockVariantInsert = {
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};
const mockInventoryInsert = {
  values: jest.fn().mockReturnThis(),
  onConflictDoNothing: jest.fn(),
};
const mockProductImagesInsert = {
  values: jest.fn().mockResolvedValue(undefined),
};

const mockRedisSet = jest.fn().mockResolvedValue("OK");
const mockRedisDel = jest.fn().mockResolvedValue(1);
const mockRedisEval = jest.fn().mockResolvedValue(1);
const mockRedisQuit = jest.fn().mockResolvedValue("OK");

const mockDb = {
  query: {
    shopInterestRequests: { findFirst: jest.fn(), findMany: jest.fn() },
    shopProductVariants: { findFirst: jest.fn(), findMany: jest.fn() },
    shopProducts: { findFirst: jest.fn(), findMany: jest.fn() },
    shopInventory: { findFirst: jest.fn(), findMany: jest.fn() },
    shopOrders: { findFirst: jest.fn(), findMany: jest.fn() },
    shopOrderItems: { findFirst: jest.fn() },
    stripeWebhookEvents: { findFirst: jest.fn() },
    shopSettings: { findFirst: jest.fn() },
    units: { findFirst: jest.fn() },
  },
  insert: jest.fn((table: { table?: string }) => {
    if (table?.table === "shop_interest_requests") {
      return mockInterestRequestInsert;
    }
    if (table?.table === "shop_interest_items") return mockInterestItemsInsert;
    if (table?.table === "shop_orders") return mockOrderInsert;
    if (table?.table === "shop_order_items") return mockOrderItemsInsert;
    if (table?.table === "shop_order_payments") return mockOrderPaymentsInsert;
    if (table?.table === "stripe_webhook_events") {
      return mockStripeWebhookEventsInsert;
    }
    if (table?.table === "shop_inventory_ledger") {
      return mockInventoryLedgerInsert;
    }
    if (table?.table === "shop_products") return mockProductInsert;
    if (table?.table === "shop_product_variants") return mockVariantInsert;
    if (table?.table === "shop_inventory") return mockInventoryInsert;
    if (table?.table === "shop_product_images") return mockProductImagesInsert;
    return { values: jest.fn().mockReturnThis(), returning: jest.fn() };
  }),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  transaction: jest.fn(),
};

mockDb.transaction.mockImplementation(
  async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
    callback(mockDb),
);

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  shopInterestRequests: {
    table: "shop_interest_requests",
    id: "id",
    contactedAt: "contacted_at",
    contactedBy: "contacted_by",
    createdAt: "created_at",
    customerEmail: "customer_email",
    customerName: "customer_name",
    customerPhone: "customer_phone",
    notes: "notes",
    schoolId: "school_id",
    status: "status",
    studentClass: "student_class",
    studentName: "student_name",
    unitId: "unit_id",
  },
  shopInterestItems: {
    table: "shop_interest_items",
    createdAt: "created_at",
    id: "id",
    interestRequestId: "interest_request_id",
    quantity: "quantity",
    variantId: "variant_id",
  },
  shopProducts: {
    table: "shop_products",
    basePrice: "base_price",
    category: "category",
    description: "description",
    id: "id",
    imageUrl: "image_url",
    isActive: "is_active",
    name: "name",
  },
  shopProductVariants: {
    table: "shop_product_variants",
    id: "id",
    isActive: "is_active",
    priceOverride: "price_override",
    productId: "product_id",
    size: "size",
    sku: "sku",
  },
  shopProductImages: { table: "shop_product_images", displayOrder: "display_order" },
  shopOrders: {
    table: "shop_orders",
    createdAt: "created_at",
    paidAt: "paid_at",
    schoolId: "school_id",
    status: "status",
    totalAmount: "total_amount",
    unitId: "unit_id",
  },
  shopOrderItems: { table: "shop_order_items" },
  shopOrderPayments: { table: "shop_order_payments" },
  stripeWebhookEvents: { table: "stripe_webhook_events" },
  shopInventory: { table: "shop_inventory" },
  shopInventoryLedger: { table: "shop_inventory_ledger" },
  shopSettings: { table: "shop_settings" },
  users: { table: "users", id: "id", name: "name" },
  units: { table: "units" },
  eq: jest.fn((column, value) => ({ type: "eq", column, value })),
  gte: jest.fn((column, value) => ({ type: "gte", column, value })),
  and: jest.fn((...conditions) => ({ type: "and", conditions })),
  or: jest.fn((...conditions) => ({ type: "or", conditions })),
  asc: jest.fn((column) => ({ type: "asc", column })),
  desc: jest.fn((column) => ({ type: "desc", column })),
  ilike: jest.fn((column, value) => ({ type: "ilike", column, value })),
  inArray: jest.fn((column, value) => ({ type: "inArray", column, value })),
  isNull: jest.fn((column) => ({ type: "isNull", column })),
  sql: jest.fn(() => ({ type: "sql" })),
}));

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    set: mockRedisSet,
    del: mockRedisDel,
    eval: mockRedisEval,
    quit: mockRedisQuit,
  }));
});

describe("Regressões da loja", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterestRequestInsert.values.mockReturnThis();
    mockInterestRequestInsert.returning.mockResolvedValue([{ id: "interest-1" }]);
    mockInterestItemsInsert.values.mockResolvedValue(undefined);
    mockOrderInsert.values.mockReturnThis();
    mockOrderInsert.returning.mockResolvedValue([
      {
        id: "order-1",
        orderNumber: "123456",
        totalAmount: 4500,
        expiresAt: new Date("2026-04-27T12:00:00Z"),
      },
    ]);
    mockOrderItemsInsert.values.mockResolvedValue(undefined);
    mockOrderPaymentsInsert.values.mockResolvedValue(undefined);
    mockStripeWebhookEventsInsert.values.mockResolvedValue(undefined);
    mockInventoryLedgerInsert.values.mockResolvedValue(undefined);
    mockProductInsert.values.mockReturnThis();
    mockProductInsert.returning.mockResolvedValue([
      {
        id: "product-1",
        schoolId: "school-1",
        name: "Camiseta",
        basePrice: 4500,
        category: "UNIFORME_UNISSEX",
        imageUrl: "/camiseta.png",
        isActive: true,
      },
    ]);
    mockVariantInsert.values.mockReturnThis();
    mockVariantInsert.returning.mockResolvedValue([
      {
        id: "variant-1",
        productId: "product-1",
        size: "8",
        sku: null,
        priceOverride: null,
        isActive: true,
      },
    ]);
    mockInventoryInsert.values.mockReturnThis();
    mockInventoryInsert.onConflictDoNothing.mockResolvedValue(undefined);
    mockProductImagesInsert.values.mockResolvedValue(undefined);
    mockRedisSet.mockResolvedValue("OK");
    mockRedisDel.mockResolvedValue(1);
    mockRedisEval.mockResolvedValue(1);
    mockRedisQuit.mockResolvedValue("OK");
    mockDb.query.shopSettings.findFirst.mockResolvedValue({
      unitId: "unit-1",
      isShopEnabled: true,
      maxInstallments: 1,
      pickupInstructions: "Retirada na secretaria.",
    });
    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopOrderItems.findFirst.mockResolvedValue(null);
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([{ count: 0 }]);
  });

  it("persiste schoolId ao criar interesse público válido", async () => {
    const service = new ShopInterestService();

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findMany.mockResolvedValue([
      {
        id: "variant-1",
        isActive: true,
        product: {
          id: "product-1",
          schoolId: "school-1",
          isActive: true,
        },
      },
    ]);

    await service.createInterestRequest({
      schoolId: "school-1",
      unitId: "unit-1",
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      customerEmail: "maria@example.com",
      studentName: "João Silva",
      studentClass: "3º Ano",
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    expect(mockInterestRequestInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "school-1",
        unitId: "unit-1",
        status: "PENDENTE",
      }),
    );
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it("rejeita interesse público sem itens", async () => {
    const service = new ShopInterestService();

    await expect(
      service.createInterestRequest({
        schoolId: "school-1",
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        customerEmail: "maria@example.com",
        studentName: "João Silva",
        studentClass: "3º Ano",
        items: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockDb.query.units.findFirst).not.toHaveBeenCalled();
    expect(mockInterestRequestInsert.values).not.toHaveBeenCalled();
  });

  it("lista interesses administrativos sem query relacional com alias instável", async () => {
    const service = new ShopInterestService();
    const requestRowsBuilder = {
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockResolvedValue([]),
    };
    const countBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ count: 0 }]),
    };

    mockDb.select
      .mockReturnValueOnce(requestRowsBuilder)
      .mockReturnValueOnce(countBuilder);

    await service.getInterestRequests(
      null,
      { status: "PENDENTE", page: 1, limit: 20 },
      {
        userId: "admin-1",
        role: "gerente_unidade",
        schoolId: "school-1",
        unitId: "unit-1",
      },
    );

    expect(mockDb.query.shopInterestRequests.findMany).not.toHaveBeenCalled();
    expect(requestRowsBuilder.leftJoin).toHaveBeenCalled();
    expect(requestRowsBuilder.where).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "and",
      }),
    );
  });

  it("não interpola datas em SQL raw ao resumir interesses administrativos", async () => {
    const service = new ShopInterestService();
    const topVariantsBuilder = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    const statusCountsBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockResolvedValue([
        { status: "PENDENTE", count: 1 },
        { status: "CONTATADO", count: 2 },
      ]),
    };
    mockDb.select
      .mockReturnValueOnce(topVariantsBuilder)
      .mockReturnValueOnce(statusCountsBuilder);

    await service.getInterestSummary("unit-1", {
      userId: "admin-1",
      role: "gerente_unidade",
      schoolId: "school-1",
      unitId: "unit-1",
    });

    expect(gte).toHaveBeenCalledWith(expect.anything(), expect.any(Date));

    const chamadasSqlComData = (sql as unknown as jest.Mock).mock.calls.filter(
      (args: unknown[]) => args.some((arg: unknown) => arg instanceof Date),
    );
    expect(chamadasSqlComData).toHaveLength(0);
  });

  it("retorna detalhe público com pronta entrega e pré-venda sem estoque interno", async () => {
    const service = new ShopProductsService();

    mockDb.query.shopProducts.findFirst.mockResolvedValue({
      id: "product-1",
      schoolId: "school-1",
      name: "Camiseta",
      description: "Uniforme",
      category: "UNIFORME_UNISSEX",
      basePrice: 4500,
      imageUrl: "/camiseta.png",
      isActive: true,
      images: [{ imageUrl: "/camiseta.png" }],
      variants: [
        {
          id: "variant-active",
          size: "8",
          sku: "CAM-8",
          priceOverride: null,
          isActive: true,
          inventory: [
            {
              unitId: "unit-1",
              quantity: 10,
              reservedQuantity: 3,
            },
          ],
        },
        {
          id: "variant-pre-venda",
          size: "12",
          sku: "CAM-12",
          priceOverride: null,
          isActive: true,
          inventory: [
            {
              unitId: "unit-1",
              quantity: 0,
              reservedQuantity: 0,
            },
          ],
        },
        {
          id: "variant-inactive",
          size: "10",
          sku: "CAM-10",
          priceOverride: null,
          isActive: false,
          inventory: [
            {
              unitId: "unit-1",
              quantity: 50,
              reservedQuantity: 0,
            },
          ],
        },
      ],
    });

    const product = await service.getPublicProductById(
      "product-1",
      "school-1",
      "unit-1",
    );
    expect(mockDb.query.shopProducts.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditions: expect.arrayContaining([
            expect.objectContaining({
              column: shopProducts.isActive,
              value: true,
            }),
          ]),
        }),
      }),
    );

    expect(product.variants).toEqual([
      expect.objectContaining({
        id: "variant-active",
        availableStock: 7,
        isAvailable: true,
        modoVenda: "PRONTA_ENTREGA",
      }),
      expect.objectContaining({
        id: "variant-pre-venda",
        availableStock: 0,
        isAvailable: false,
        modoVenda: "PRE_VENDA",
      }),
    ]);
    for (const variant of product.variants) {
      expect(variant).not.toHaveProperty("inventory");
      expect(variant).not.toHaveProperty("quantity");
      expect(variant).not.toHaveProperty("reservedQuantity");
      expect(variant).not.toHaveProperty("reserved");
      expect(variant).not.toHaveProperty("total");
    }
  });

  it("classifica variantes públicas entre pronta entrega e pré-venda pelo estoque", async () => {
    const service = new ShopProductsService();
    const produtoComEstoqueMisto = {
      id: "product-1",
      schoolId: "school-1",
      name: "Moletom",
      description: "Uniforme",
      category: "UNIFORME_UNISSEX",
      basePrice: 17000,
      imageUrl: "/moletom.png",
      isActive: true,
      images: [{ imageUrl: "/moletom.png" }],
      variants: [
        {
          id: "variant-pronta-entrega",
          size: "8",
          sku: "MOL-8",
          priceOverride: null,
          isActive: true,
          inventory: [
            {
              unitId: "unit-1",
              quantity: 2,
              reservedQuantity: 0,
            },
          ],
        },
        {
          id: "variant-pre-venda",
          size: "10",
          sku: "MOL-10",
          priceOverride: null,
          isActive: true,
          inventory: [
            {
              unitId: "unit-1",
              quantity: 0,
              reservedQuantity: 0,
            },
          ],
        },
      ],
    };

    mockDb.query.shopProducts.findMany.mockResolvedValue([
      produtoComEstoqueMisto,
    ]);

    const catalogoCompleto = await service.getProducts(
      "school-1",
      "unit-1",
      {},
    );
    const produtosProntaEntrega = await service.getProducts(
      "school-1",
      "unit-1",
      { modoVenda: "PRONTA_ENTREGA" } as never,
    );
    const produtosPreVenda = await service.getProducts(
      "school-1",
      "unit-1",
      { modoVenda: "PRE_VENDA" } as never,
    );

    expect(catalogoCompleto[0].variants).toEqual([
      expect.objectContaining({
        id: "variant-pronta-entrega",
        availableStock: 2,
        isAvailable: true,
        modoVenda: "PRONTA_ENTREGA",
      }),
      expect.objectContaining({
        id: "variant-pre-venda",
        availableStock: 0,
        isAvailable: false,
        modoVenda: "PRE_VENDA",
      }),
    ]);
    expect(produtosProntaEntrega[0].variants).toEqual([
      expect.objectContaining({ id: "variant-pronta-entrega" }),
    ]);
    expect(produtosPreVenda[0].variants).toEqual([
      expect.objectContaining({ id: "variant-pre-venda" }),
    ]);
  });

  it("rejeita pedido público com variante inativa", async () => {
    const inventoryService = {
      reserveStock: jest.fn().mockResolvedValue({ success: true }),
      releaseReservation: jest.fn(),
      confirmSale: jest.fn(),
      confirmPresentialSale: jest.fn(),
      addStock: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: false,
      priceOverride: null,
      product: {
        id: "product-1",
        schoolId: "school-1",
        basePrice: 4500,
        isActive: true,
      },
    });
    mockDb.query.shopOrders.findFirst.mockResolvedValue(null);
    mockDb.query.stripeWebhookEvents.findFirst.mockResolvedValue(null);

    await expect(
      service.createOrder({
        schoolId: "school-1",
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        items: [
          {
            variantId: "variant-1",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(inventoryService.reserveStock).not.toHaveBeenCalled();
  });

  it("bloqueia catálogo público quando a loja da unidade está desabilitada", async () => {
    const service = new ShopProductsService();
    mockDb.query.shopSettings.findFirst.mockResolvedValue({
      unitId: "unit-1",
      isShopEnabled: false,
    });
    mockDb.query.shopProducts.findMany.mockResolvedValue([]);

    await expect(
      service.getProducts("school-1", "unit-1", {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockDb.query.shopProducts.findMany).not.toHaveBeenCalled();
  });

  it("rejeita catálogo público quando unidade não pertence à escola", async () => {
    const service = new ShopProductsService();
    mockDb.query.units.findFirst.mockResolvedValue(null);
    mockDb.query.shopProducts.findMany.mockResolvedValue([]);

    await expect(
      service.getProducts("school-1", "unit-outra-escola", {}),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockDb.query.shopSettings.findFirst).not.toHaveBeenCalled();
    expect(mockDb.query.shopProducts.findMany).not.toHaveBeenCalled();
  });

  it("rejeita detalhe público quando unidade não pertence à escola", async () => {
    const service = new ShopProductsService();
    mockDb.query.units.findFirst.mockResolvedValue(null);
    mockDb.query.shopProducts.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublicProductById(
        "product-1",
        "school-1",
        "unit-outra-escola",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockDb.query.shopSettings.findFirst).not.toHaveBeenCalled();
    expect(mockDb.query.shopProducts.findFirst).not.toHaveBeenCalled();
  });

  it("bloqueia criação pública de pedido quando a loja da unidade está desabilitada", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      reserveStockInTransaction: jest.fn().mockResolvedValue({ success: true }),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopSettings.findFirst.mockResolvedValue({
      unitId: "unit-1",
      isShopEnabled: false,
    });
    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      priceOverride: null,
      product: {
        id: "product-1",
        schoolId: "school-1",
        basePrice: 4500,
        isActive: true,
      },
    });

    await expect(
      service.createOrder({
        schoolId: "school-1",
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        items: [
          {
            variantId: "variant-1",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(inventoryService.withInventoryLocks).not.toHaveBeenCalled();
  });

  it("cria pedido online dentro de transação junto com reserva e itens", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      reserveStockInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
      reserveStock: jest.fn().mockResolvedValue({ success: true }),
      releaseReservation: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      priceOverride: null,
      product: {
        id: "product-1",
        schoolId: "school-1",
        basePrice: 4500,
        isActive: true,
      },
    });
    mockDb.query.shopOrders.findFirst.mockResolvedValue(null);

    await service.createOrder({
      schoolId: "school-1",
      unitId: "unit-1",
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      items: [
        {
          variantId: "variant-1",
          quantity: 1,
          studentName: "João Silva",
        },
      ],
    });

    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledWith(
      "variant-1",
      "unit-1",
      1,
      "order-1",
      mockDb,
    );
    expect(inventoryService.reserveStock).not.toHaveBeenCalled();
    expect(mockOrderItemsInsert.values).toHaveBeenCalledWith([
      expect.not.objectContaining({
        subtotal: expect.anything(),
      }),
    ]);
  });

  it("cria pedido de pré-venda sem reservar estoque e com preço recalculado", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      reserveStockInTransaction: jest.fn(),
      reserveStock: jest.fn(),
      releaseReservation: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockOrderInsert.returning.mockResolvedValue([
      {
        id: "order-pre-venda-1",
        orderNumber: "654321",
        totalAmount: 17000,
        expiresAt: null,
        orderSource: "PRE_VENDA",
      },
    ]);
    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      priceOverride: 8500,
      product: {
        id: "product-1",
        name: "Moletom",
        schoolId: "school-1",
        basePrice: 17000,
        isActive: true,
      },
    });
    mockDb.query.shopOrders.findFirst.mockResolvedValue(null);
    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 0,
      reservedQuantity: 0,
    });

    const result = await (
      service as unknown as {
        createPreSaleOrder: typeof service.createOrder;
      }
    ).createPreSaleOrder({
      schoolId: "school-1",
      unitId: "unit-1",
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      items: [
        {
          variantId: "variant-1",
          quantity: 2,
          studentName: "João Silva",
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        orderNumber: "654321",
        totalAmount: 17000,
        expiresAt: null,
      }),
    );
    expect(mockOrderInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        orderSource: "PRE_VENDA",
        status: "AGUARDANDO_PAGAMENTO",
        totalAmount: 17000,
        expiresAt: null,
      }),
    );
    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
    expect(inventoryService.reserveStock).not.toHaveBeenCalled();
    expect(mockOrderItemsInsert.values).toHaveBeenCalledWith([
      expect.objectContaining({
        orderId: "order-pre-venda-1",
        variantId: "variant-1",
        quantity: 2,
        unitPrice: 8500,
      }),
    ]);
  });

  it("revalida produto e preço da pré-venda dentro do lock de estoque", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => {
        mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
          id: "variant-1",
          isActive: false,
          priceOverride: 8500,
          product: {
            id: "product-1",
            name: "Moletom",
            schoolId: "school-1",
            basePrice: 17000,
            isActive: true,
          },
        });

        return callback();
      }),
      reserveStockInTransaction: jest.fn(),
      reserveStock: jest.fn(),
      releaseReservation: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 0,
      reservedQuantity: 0,
    });

    await expect(
      (
        service as unknown as {
          createPreSaleOrder: typeof service.createOrder;
        }
      ).createPreSaleOrder({
        schoolId: "school-1",
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        items: [
          {
            variantId: "variant-1",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "RESOURCE_NOT_FOUND",
      }),
    });

    expect(mockOrderInsert.values).not.toHaveBeenCalled();
  });

  it("rejeita pré-venda quando o tamanho já tem estoque disponível", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      reserveStockInTransaction: jest.fn(),
      reserveStock: jest.fn(),
      releaseReservation: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      priceOverride: null,
      product: {
        id: "product-1",
        name: "Moletom",
        schoolId: "school-1",
        basePrice: 17000,
        isActive: true,
      },
    });
    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 2,
      reservedQuantity: 0,
    });

    await expect(
      (
        service as unknown as {
          createPreSaleOrder: typeof service.createOrder;
        }
      ).createPreSaleOrder({
        schoolId: "school-1",
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        items: [
          {
            variantId: "variant-1",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PRE_SALE_STOCK_AVAILABLE",
        details: expect.objectContaining({
          variantId: "variant-1",
          availableStock: 2,
        }),
      }),
    });

    expect(mockOrderInsert.values).not.toHaveBeenCalled();
    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
  });

  it("rejeita pré-venda quando produto ultrapassa limite por aluno", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      reserveStockInTransaction: jest.fn(),
      reserveStock: jest.fn(),
      releaseReservation: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst
      .mockResolvedValueOnce({
        id: "variant-1",
        isActive: true,
        priceOverride: null,
        product: {
          id: "product-1",
          name: "Moletom",
          schoolId: "school-1",
          basePrice: 17000,
          isActive: true,
        },
      })
      .mockResolvedValueOnce({
        id: "variant-2",
        isActive: true,
        priceOverride: null,
        product: {
          id: "product-1",
          name: "Moletom",
          schoolId: "school-1",
          basePrice: 17000,
          isActive: true,
        },
      });
    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      unitId: "unit-1",
      quantity: 0,
      reservedQuantity: 0,
    });

    await expect(
      (
        service as unknown as {
          createPreSaleOrder: typeof service.createOrder;
        }
      ).createPreSaleOrder({
        schoolId: "school-1",
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        items: [
          {
            variantId: "variant-1",
            quantity: 2,
            studentName: "João Silva",
          },
          {
            variantId: "variant-2",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "QUANTITY_LIMIT_EXCEEDED",
        details: expect.objectContaining({
          limit: 2,
        }),
      }),
    });

    expect(mockOrderInsert.values).not.toHaveBeenCalled();
    expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
  });

  it("cria checkout Stripe com pedido reservado por 30 minutos", async () => {
    const expiresAtAntes = Date.now() + 29 * 60 * 1000;
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      reserveStockInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
    };
    const paymentsService = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        checkoutSessionId: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      }),
    };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      size: "8",
      priceOverride: null,
      product: {
        id: "product-1",
        name: "Camiseta",
        schoolId: "school-1",
        basePrice: 4500,
        isActive: true,
      },
    });
    mockDb.query.shopOrders.findFirst.mockResolvedValue(null);

    const result = await service.createCheckout({
      schoolId: "school-1",
      unitId: "unit-1",
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      customerEmail: "maria@example.com",
      items: [
        {
          variantId: "variant-1",
          quantity: 1,
          studentName: "João Silva",
        },
      ],
    });

    expect(result.checkoutUrl).toBe(
      "https://checkout.stripe.com/c/pay/cs_test_123",
    );
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThanOrEqual(
      expiresAtAntes,
    );
    expect(new Date(result.expiresAt).getTime()).toBeLessThanOrEqual(
      Date.now() + 31 * 60 * 1000,
    );
    expect(paymentsService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        orderNumber: "123456",
        totalAmount: 4500,
        customerEmail: "maria@example.com",
        items: [
          {
            name: "Camiseta - Tam. 8",
            unitAmount: 4500,
            quantity: 1,
          },
        ],
      }),
    );
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCheckoutSessionId: "cs_test_123",
      }),
    );
  });

  it("expira Checkout Session quando falha persistir vínculo Stripe no pedido", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      reserveStockInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
      releaseReservationInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
    };
    const paymentsService = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        checkoutSessionId: "cs_test_orfa",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_orfa",
      }),
      expireCheckoutSession: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      size: "8",
      priceOverride: null,
      product: {
        id: "product-1",
        name: "Camiseta",
        schoolId: "school-1",
        basePrice: 4500,
        isActive: true,
      },
    });
    mockDb.query.shopOrders.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "order-1",
        orderNumber: "123456",
        status: "AGUARDANDO_PAGAMENTO",
        totalAmount: 4500,
        unitId: "unit-1",
        items: [{ variantId: "variant-1", quantity: 1 }],
      });
    mockDb.where
      .mockRejectedValueOnce(new Error("falha ao vincular Checkout Session"))
      .mockResolvedValue([{ count: 0 }]);

    await expect(
      service.createCheckout({
        schoolId: "school-1",
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        items: [
          {
            variantId: "variant-1",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      }),
    ).rejects.toThrow("falha ao vincular Checkout Session");

    expect(paymentsService.expireCheckoutSession).toHaveBeenCalledWith(
      "cs_test_orfa",
    );
    expect(inventoryService.releaseReservationInTransaction).toHaveBeenCalledWith(
      "variant-1",
      "unit-1",
      1,
      "order-1",
      mockDb,
    );
  });

  it("confirma pagamento com lock de pedido e transação única", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      confirmSaleInTransaction: jest.fn().mockResolvedValue({ success: true }),
      confirmSale: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );
    const order = {
      id: "order-1",
      orderNumber: "123456",
      status: "AGUARDANDO_PAGAMENTO",
      totalAmount: 4500,
      unitId: "unit-1",
      expiresAt: new Date(Date.now() + 60_000),
      items: [{ variantId: "variant-1", quantity: 1 }],
    };
    mockDb.query.shopOrders.findFirst.mockResolvedValue(order);

    await service.confirmPayment(
      "order-1",
      { payments: [{ method: "PIX", amount: 4500 }] },
      "admin-1",
      {
        userId: "admin-1",
        role: "gerente_unidade",
        schoolId: "school-1",
        unitId: "unit-1",
      },
    );

    expect(inventoryService.withOrderLock).toHaveBeenCalledWith(
      "order-1",
      expect.any(Function),
    );
    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(inventoryService.confirmSaleInTransaction).toHaveBeenCalledWith(
      "variant-1",
      "unit-1",
      1,
      "order-1",
      mockDb,
    );
    expect(inventoryService.confirmSale).not.toHaveBeenCalled();
  });

  it("confirma pagamento Stripe por webhook com lock, baixa e conciliação", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      confirmSaleInTransaction: jest.fn().mockResolvedValue({ success: true }),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );
    const order = {
      id: "order-1",
      orderNumber: "123456",
      status: "AGUARDANDO_PAGAMENTO",
      totalAmount: 4500,
      unitId: "unit-1",
      stripePaymentIntentId: null,
      items: [{ variantId: "variant-1", quantity: 1 }],
    };
    mockDb.query.shopOrders.findFirst.mockResolvedValue(order);

    await service.confirmStripePayment({
      orderId: "order-1",
      paymentIntentId: "pi_123",
      paymentMethod: "PIX",
      amount: 4500,
    });

    expect(inventoryService.withOrderLock).toHaveBeenCalledWith(
      "order-1",
      expect.any(Function),
    );
    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(inventoryService.confirmSaleInTransaction).toHaveBeenCalledWith(
      "variant-1",
      "unit-1",
      1,
      "order-1",
      mockDb,
    );
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PAGO",
        paymentMethod: "PIX",
        stripePaymentIntentId: "pi_123",
      }),
    );
    expect(mockOrderPaymentsInsert.values).toHaveBeenCalledWith([
      {
        orderId: "order-1",
        paymentMethod: "PIX",
        amount: 4500,
      },
    ]);
  });

  it("rejeita pagamento Stripe divergente antes de baixar estoque", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      confirmSaleInTransaction: jest.fn().mockResolvedValue({ success: true }),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      status: "AGUARDANDO_PAGAMENTO",
      totalAmount: 4500,
      unitId: "unit-1",
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    await expect(
      service.confirmStripePayment({
        orderId: "order-1",
        paymentIntentId: "pi_123",
        paymentMethod: "PIX",
        amount: 4400,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(inventoryService.withInventoryLocks).not.toHaveBeenCalled();
    expect(inventoryService.confirmSaleInTransaction).not.toHaveBeenCalled();
    expect(mockOrderPaymentsInsert.values).not.toHaveBeenCalled();
  });

  it("libera reserva quando checkout Stripe falha antes do pagamento", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      releaseReservationInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      status: "AGUARDANDO_PAGAMENTO",
      totalAmount: 4500,
      unitId: "unit-1",
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    await service.failStripePayment({
      orderId: "order-1",
      status: "CANCELADO",
      reason: "Pagamento recusado pelo Stripe",
      paymentIntentId: "pi_123",
    });

    expect(inventoryService.withOrderLock).toHaveBeenCalledWith(
      "order-1",
      expect.any(Function),
    );
    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(inventoryService.releaseReservationInTransaction).toHaveBeenCalledWith(
      "variant-1",
      "unit-1",
      1,
      "order-1",
      mockDb,
    );
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "CANCELADO",
        stripePaymentIntentId: "pi_123",
      }),
    );
  });

  it("retorna pagamentos detalhados no detalhe administrativo do pedido", async () => {
    const inventoryService = {};
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      schoolId: "school-1",
      unitId: "unit-1",
      orderSource: "PRESENCIAL",
      status: "RETIRADO",
      totalAmount: 4500,
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      customerEmail: null,
      items: [
        {
          id: "item-1",
          variantId: "variant-1",
          studentName: "João Silva",
          quantity: 1,
          unitPrice: 4500,
          variant: {
            size: "8",
            sku: null,
            product: {
              id: "product-1",
              name: "Camiseta",
              category: "UNIFORME_UNISSEX",
              imageUrl: null,
            },
          },
        },
      ],
      payments: [
        { id: "payment-1", paymentMethod: "PIX", amount: 2500 },
        { id: "payment-2", paymentMethod: "DINHEIRO", amount: 2000 },
      ],
      paymentMethod: "MULTIPLO",
      paidAt: new Date("2026-04-28T12:00:00Z"),
      expiresAt: null,
      pickedUpAt: null,
      pickedUpBy: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      createdAt: new Date("2026-04-28T12:00:00Z"),
      updatedAt: new Date("2026-04-28T12:00:00Z"),
    });

    const result = await service.getOrderById("order-1", {
      userId: "admin-1",
      role: "gerente_unidade",
      schoolId: "school-1",
      unitId: "unit-1",
    });

    expect((result as { payments?: unknown }).payments).toEqual([
      { id: "payment-1", paymentMethod: "PIX", amount: 2500 },
      { id: "payment-2", paymentMethod: "DINHEIRO", amount: 2000 },
    ]);
  });

  it("retorna instruções de retirada da unidade na consulta pública do pedido", async () => {
    const inventoryService = {};
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      schoolId: "school-1",
      unitId: "unit-1",
      orderSource: "ONLINE",
      status: "PAGO",
      totalAmount: 4500,
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      customerEmail: null,
      items: [
        {
          id: "item-1",
          variantId: "variant-1",
          studentName: "João Silva",
          quantity: 1,
          unitPrice: 4500,
          variant: {
            size: "8",
            sku: null,
            product: {
              id: "product-1",
              name: "Camiseta",
              category: "UNIFORME_UNISSEX",
              imageUrl: null,
            },
          },
        },
      ],
      payments: [],
      paymentMethod: "PIX",
      paidAt: new Date("2026-04-28T12:00:00Z"),
      expiresAt: null,
      pickedUpAt: null,
      pickedUpBy: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      createdAt: new Date("2026-04-28T12:00:00Z"),
      updatedAt: new Date("2026-04-28T12:00:00Z"),
    });
    mockDb.query.shopSettings.findFirst.mockResolvedValue({
      unitId: "unit-1",
      pickupInstructions: "Retirada na coordenação da unidade.",
    });

    const result = await service.getOrderByNumber("123456", "11987654321");

    expect((result as { pickupInstructions?: string }).pickupInstructions).toBe(
      "Retirada na coordenação da unidade.",
    );
  });

  it("rejeita confirmação parcial com BRINDE antes de converter reserva", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      confirmSaleInTransaction: jest.fn().mockResolvedValue({ success: true }),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      status: "AGUARDANDO_PAGAMENTO",
      totalAmount: 4500,
      unitId: "unit-1",
      expiresAt: new Date(Date.now() + 60_000),
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    await expect(
      service.confirmPayment(
        "order-1",
        { payments: [{ method: "BRINDE", amount: 0 }] },
        "admin-1",
        {
          userId: "admin-1",
          role: "gerente_unidade",
          schoolId: "school-1",
          unitId: "unit-1",
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(inventoryService.withInventoryLocks).not.toHaveBeenCalled();
    expect(inventoryService.confirmSaleInTransaction).not.toHaveBeenCalled();
  });

  it("cancela pedido aguardando pagamento com lock de pedido e liberação transacional", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      releaseReservationInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
      releaseReservation: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      status: "AGUARDANDO_PAGAMENTO",
      unitId: "unit-1",
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    await service.cancelOrder("order-1", "admin-1", "Cliente solicitou", {
      userId: "admin-1",
      role: "gerente_unidade",
      schoolId: "school-1",
      unitId: "unit-1",
    });

    expect(inventoryService.withOrderLock).toHaveBeenCalledWith(
      "order-1",
      expect.any(Function),
    );
    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(inventoryService.releaseReservationInTransaction).toHaveBeenCalledWith(
      "variant-1",
      "unit-1",
      1,
      "order-1",
      mockDb,
    );
    expect(inventoryService.releaseReservation).not.toHaveBeenCalled();
  });

  it("cria venda presencial em transação junto com baixa de estoque", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      confirmPresentialSaleInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
      confirmPresentialSale: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      priceOverride: 5000,
      product: {
        id: "product-1",
        schoolId: "school-1",
        basePrice: 4500,
        isActive: true,
      },
    });
    mockDb.query.shopOrders.findFirst.mockResolvedValue(null);

    await service.createPresentialSale(
      {
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        payments: [{ method: "PIX", amount: 5000 }],
        items: [
          {
            variantId: "variant-1",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      },
      "school-1",
      "unit-1",
      "admin-1",
    );

    expect(inventoryService.withInventoryLocks).toHaveBeenCalledWith(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      expect.any(Function),
    );
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(
      inventoryService.confirmPresentialSaleInTransaction,
    ).toHaveBeenCalledWith(
      "variant-1",
      "unit-1",
      1,
      expect.any(String),
      "admin-1",
      mockDb,
    );
    expect(inventoryService.confirmPresentialSale).not.toHaveBeenCalled();
    expect(mockOrderItemsInsert.values).toHaveBeenCalledWith([
      expect.not.objectContaining({
        subtotal: expect.anything(),
      }),
    ]);
  });

  it("rejeita venda presencial parcial com BRINDE antes de baixar estoque", async () => {
    const inventoryService = {
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      confirmPresentialSaleInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      isActive: true,
      priceOverride: null,
      product: {
        id: "product-1",
        schoolId: "school-1",
        basePrice: 4500,
        isActive: true,
      },
    });
    mockDb.query.shopOrders.findFirst.mockResolvedValue(null);

    await expect(
      service.createPresentialSale(
        {
          customerName: "Maria Silva",
          customerPhone: "11987654321",
          payments: [{ method: "BRINDE", amount: 0 }],
          items: [
            {
              variantId: "variant-1",
              quantity: 1,
              studentName: "João Silva",
            },
          ],
        },
        "school-1",
        "unit-1",
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(inventoryService.withInventoryLocks).not.toHaveBeenCalled();
    expect(
      inventoryService.confirmPresentialSaleInTransaction,
    ).not.toHaveBeenCalled();
  });

  it("registra saída manual de estoque como AJUSTE no ledger", async () => {
    const service = new ShopInventoryService({
      get: jest.fn(() => "redis://localhost:6379"),
    } as never);

    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 10,
      reservedQuantity: 2,
      lowStockThreshold: 5,
    });

    await service.removeStock(
      "variant-1",
      "unit-1",
      3,
      "Produto danificado",
      "DANO",
      "admin-1",
      {
        userId: "admin-1",
        role: "master",
        schoolId: null,
        unitId: null,
      },
    );

    expect(mockInventoryLedgerInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType: "AJUSTE",
        quantityChange: -3,
        notes: "Produto danificado - Motivo: DANO",
      }),
    );
  });

  it("executa entrada manual de estoque em transação", async () => {
    const service = new ShopInventoryService({
      get: jest.fn(() => "redis://localhost:6379"),
    } as never);

    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 10,
      reservedQuantity: 2,
      lowStockThreshold: 5,
    });

    await service.addStock(
      "variant-1",
      "unit-1",
      3,
      "Reposição",
      "admin-1",
      {
        userId: "admin-1",
        role: "master",
        schoolId: null,
        unitId: null,
      },
    );

    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it("rejeita ajuste manual que deixaria reserva maior que estoque total", async () => {
    const service = new ShopInventoryService({
      get: jest.fn(() => "redis://localhost:6379"),
    } as never);

    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 10,
      reservedQuantity: 8,
      lowStockThreshold: 5,
    });

    await expect(
      service.adjustStock(
        "variant-1",
        "unit-1",
        -5,
        "Correção manual",
        "admin-1",
        {
          userId: "admin-1",
          role: "master",
          schoolId: null,
          unitId: null,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockInventoryLedgerInsert.values).not.toHaveBeenCalled();
  });

  it("libera locks Redis somente via token de ownership", async () => {
    const service = new ShopInventoryService({
      get: jest.fn(() => "redis://localhost:6379"),
    } as never);

    await service.withInventoryLocks(
      [{ variantId: "variant-1", unitId: "unit-1" }],
      async () => "ok",
    );

    expect(mockRedisSet).toHaveBeenCalledWith(
      "shop:inventory:lock:variant-1:unit-1",
      expect.any(String),
      "EX",
      expect.any(Number),
      "NX",
    );
    expect(mockRedisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call(\"get\""),
      1,
      "shop:inventory:lock:variant-1:unit-1",
      expect.any(String),
    );
    expect(mockRedisDel).not.toHaveBeenCalled();
  });

  it("não libera reserva além do reservado", async () => {
    const service = new ShopInventoryService({
      get: jest.fn(() => "redis://localhost:6379"),
    } as never);

    mockDb.query.shopInventory.findFirst.mockResolvedValue({
      id: "inventory-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 10,
      reservedQuantity: 1,
      lowStockThreshold: 5,
    });

    await expect(
      service.releaseReservation("variant-1", "unit-1", 2, "order-1"),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockInventoryLedgerInsert.values).not.toHaveBeenCalled();
  });

  it("não permite exclusão definitiva de pedido pago ou retirado", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      releaseReservation: jest.fn(),
      addStock: jest.fn(),
    };
    const paymentsService = { refundPayment: jest.fn() };
    const service = new ShopOrdersService(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      status: "PAGO",
      unitId: "unit-1",
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    await expect(
      service.deleteOrder("order-1", "admin-1", {
        userId: "admin-1",
        role: "gerente_unidade",
        schoolId: "school-1",
        unitId: "unit-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(inventoryService.addStock).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});

describe("Escopo tenant da loja", () => {
  it("não trata sessão sem schoolId como escopo master", () => {
    const scope = {
      userId: "user-1",
      role: "diretora_geral",
      schoolId: null,
      unitId: null,
    };

    expect(isMasterShopScope(scope)).toBe(false);
    expect(canAccessShopSchool(scope, "school-2")).toBe(false);
  });

  it("não libera acesso a unidade sem escopo explícito", () => {
    expect(canAccessShopUnit(undefined, "unit-1")).toBe(false);
  });

  it("não amplia role de unidade para escola inteira quando unitId está ausente", () => {
    expect(
      canAccessShopUnit(
        {
          userId: "user-1",
          role: "gerente_unidade",
          schoolId: "school-1",
          unitId: null,
        },
        "unit-1",
      ),
    ).toBe(false);
  });

  it("mantém diretora_geral sem unitId com escopo de escola", () => {
    expect(
      canAccessShopUnit(
        {
          userId: "user-1",
          role: "diretora_geral",
          schoolId: "school-1",
          unitId: null,
        },
        "unit-1",
      ),
    ).toBe(true);
  });

  it("não lista pedidos quando role de unidade está sem unitId", async () => {
    const service = new ShopOrdersService({} as never, {} as never);

    await expect(
      service.listOrders(
        {},
        {
          userId: "user-1",
          role: "gerente_unidade",
          schoolId: "school-1",
          unitId: null,
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockDb.query.shopOrders.findMany).not.toHaveBeenCalled();
  });

  it("retorna não encontrado quando telefone público não corresponde ao pedido", async () => {
    const service = new ShopOrdersService({} as never, {} as never);

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      customerPhone: "11987654321",
      items: [],
    });

    await expect(
      service.getOrderByNumber("123456", "11000000000"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("Controller público da loja", () => {
  it("inicializa checkout Stripe pelo service de pedidos", async () => {
    const ordersService = {
      createCheckout: jest.fn().mockResolvedValue({
        orderId: "order-1",
        orderNumber: "123456",
        totalAmount: 4500,
        expiresAt: new Date("2026-04-28T12:30:00Z"),
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      }),
    };
    const controller = new ShopPublicController(
      {} as never,
      ordersService as never,
      {} as never,
      {} as never,
    );

    const result = await controller.initCheckout({
      schoolId: "11111111-1111-4111-8111-111111111111",
      unitId: "22222222-2222-4222-8222-222222222222",
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      items: [
        {
          variantId: "33333333-3333-4333-8333-333333333333",
          quantity: 1,
          studentName: "João Silva",
        },
      ],
    } as never);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      }),
    });
    expect(ordersService.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPhone: "11987654321",
      }),
    );
  });

  it("cria pré-venda pública pelo service de pedidos", async () => {
    const ordersService = {
      createPreSaleOrder: jest.fn().mockResolvedValue({
        orderId: "order-pre-venda-1",
        orderNumber: "654321",
        totalAmount: 17000,
        expiresAt: null,
      }),
    };
    const controller = new ShopPublicController(
      {} as never,
      ordersService as never,
      {} as never,
      {} as never,
    );

    const result = await controller.createPreSaleOrder({
      schoolId: "11111111-1111-4111-8111-111111111111",
      unitId: "22222222-2222-4222-8222-222222222222",
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      items: [
        {
          variantId: "33333333-3333-4333-8333-333333333333",
          quantity: 1,
          studentName: "João Silva",
        },
      ],
    } as never);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        orderNumber: "654321",
        expiresAt: null,
      }),
    });
    expect(ordersService.createPreSaleOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPhone: "11987654321",
      }),
    );
  });

  it("aplica rate limit na consulta pública de pedido", () => {
    expect(
      Reflect.getMetadata(
        "THROTTLER:LIMITstrict",
        ShopPublicController.prototype.getOrderByNumber,
      ),
    ).toBeDefined();
    expect(
      Reflect.getMetadata(
        "THROTTLER:TTLstrict",
        ShopPublicController.prototype.getOrderByNumber,
      ),
    ).toBeDefined();
  });

  it("aplica rate limit na criação pública de interesse", () => {
    expect(
      Reflect.getMetadata(
        "THROTTLER:LIMITstrict",
        ShopPublicController.prototype.createInterestRequest,
      ),
    ).toBeDefined();
    expect(
      Reflect.getMetadata(
        "THROTTLER:TTLstrict",
        ShopPublicController.prototype.createInterestRequest,
      ),
    ).toBeDefined();
  });

  it("aplica rate limit na inicialização pública do Checkout Stripe", () => {
    expect(
      Reflect.getMetadata(
        "THROTTLER:LIMITstrict",
        ShopPublicController.prototype.initCheckout,
      ),
    ).toBeDefined();
    expect(
      Reflect.getMetadata(
        "THROTTLER:TTLstrict",
        ShopPublicController.prototype.initCheckout,
      ),
    ).toBeDefined();
  });

  it("aplica rate limit na criação pública de pré-venda", () => {
    expect(
      Reflect.getMetadata(
        "THROTTLER:LIMITstrict",
        ShopPublicController.prototype.createPreSaleOrder,
      ),
    ).toBeDefined();
    expect(
      Reflect.getMetadata(
        "THROTTLER:TTLstrict",
        ShopPublicController.prototype.createPreSaleOrder,
      ),
    ).toBeDefined();
  });

  it("valida UUIDs em rotas públicas antes de consultar services", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/shop/shop-public.controller.ts"),
      "utf8",
    );

    expect(source).toContain("ParseUUIDPipe");
    expect(source).toContain('@Param("schoolId", new ParseUUIDPipe');
    expect(source).toContain('@Param("unitId", new ParseUUIDPipe');
    expect(source).toContain('@Param("id", new ParseUUIDPipe');
    expect(source).toContain('@Query("schoolId", new ParseUUIDPipe');
    expect(source).toContain('@Query("unitId", new ParseUUIDPipe');
  });
});

describe("Webhook Stripe da loja", () => {
  it("retorna erro para Stripe tentar novamente quando processamento falha", async () => {
    const event = {
      id: "evt_retry",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_test_retry",
          payment_intent: "pi_retry",
          amount_total: 4500,
          metadata: {
            orderId: "order-1",
            orderNumber: "123456",
          },
        },
      },
    };
    const ordersService = {
      confirmStripePayment: jest
        .fn()
        .mockRejectedValue(new Error("falha temporária no banco")),
      failStripePayment: jest.fn(),
    };
    const controller = new PaymentsWebhookController(
      { get: jest.fn((key: string) => (key === "STRIPE_WEBHOOK_SECRET" ? "whsec_test" : undefined)) } as never,
      {
        getStripeClient: jest.fn(() => ({
          webhooks: {
            constructEvent: jest.fn().mockReturnValue(event),
          },
        })),
      } as never,
      ordersService as never,
    );

    mockDb.query.stripeWebhookEvents.findFirst.mockResolvedValue(null);

    await expect(
      controller.handleWebhook(
        { rawBody: Buffer.from("{}") } as never,
        Buffer.from("{}"),
        "assinatura",
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(ordersService.confirmStripePayment).toHaveBeenCalledTimes(1);
    expect(mockStripeWebhookEventsInsert.values).not.toHaveBeenCalledWith({
      id: "evt_retry",
      type: "checkout.session.async_payment_succeeded",
    });
  });

  it("processa evento de checkout pago uma única vez por eventId", async () => {
    const ordersService = {
      confirmStripePayment: jest.fn().mockResolvedValue({ success: true }),
      failStripePayment: jest.fn(),
    };
    const controller = new PaymentsWebhookController(
      { get: jest.fn((key: string) => (key === "STRIPE_WEBHOOK_SECRET" ? "whsec_test" : undefined)) } as never,
      {} as never,
      ordersService as never,
    );
    const event = {
      id: "evt_123",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_test_123",
          payment_intent: "pi_123",
          amount_total: 4500,
          metadata: {
            orderId: "order-1",
            orderNumber: "123456",
          },
        },
      },
    };

    mockDb.query.stripeWebhookEvents.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "evt_123", type: event.type });

    await (
      controller as unknown as {
        processWebhookEvent: (event: unknown) => Promise<void>;
      }
    ).processWebhookEvent(event);
    await (
      controller as unknown as {
        processWebhookEvent: (event: unknown) => Promise<void>;
      }
    ).processWebhookEvent(event);

    expect(ordersService.confirmStripePayment).toHaveBeenCalledTimes(1);
    expect(ordersService.confirmStripePayment).toHaveBeenCalledWith({
      orderId: "order-1",
      paymentIntentId: "pi_123",
      paymentMethod: "PIX",
      amount: 4500,
    });
    expect(mockStripeWebhookEventsInsert.values).toHaveBeenCalledWith({
      id: "evt_123",
      type: "checkout.session.async_payment_succeeded",
    });
  });

  it("cancela reserva quando checkout Stripe expira", async () => {
    const ordersService = {
      confirmStripePayment: jest.fn(),
      failStripePayment: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new PaymentsWebhookController(
      { get: jest.fn((key: string) => (key === "STRIPE_WEBHOOK_SECRET" ? "whsec_test" : undefined)) } as never,
      {} as never,
      ordersService as never,
    );

    await (
      controller as unknown as {
        processWebhookEvent: (event: {
          id: string;
          type: string;
          data: { object: unknown };
        }) => Promise<void>;
      }
    ).processWebhookEvent({
      id: "evt_expired",
      type: "checkout.session.expired",
      data: {
        object: {
          payment_intent: "pi_123",
          metadata: {
            orderId: "order-1",
            orderNumber: "123456",
          },
        },
      },
    });

    expect(ordersService.failStripePayment).toHaveBeenCalledWith({
      orderId: "order-1",
      status: "EXPIRADO",
      reason: "Checkout Stripe expirado",
      paymentIntentId: "pi_123",
    });
  });

  it("aguarda evento de Checkout quando PaymentIntent succeeded tem método ambíguo", async () => {
    const ordersService = {
      confirmStripePayment: jest.fn(),
      failStripePayment: jest.fn(),
    };
    const controller = new PaymentsWebhookController(
      { get: jest.fn((key: string) => (key === "STRIPE_WEBHOOK_SECRET" ? "whsec_test" : undefined)) } as never,
      {} as never,
      ordersService as never,
    );

    mockDb.query.stripeWebhookEvents.findFirst.mockResolvedValue(null);

    await (
      controller as unknown as {
        processWebhookEvent: (event: {
          id: string;
          type: string;
          data: { object: unknown };
        }) => Promise<void>;
      }
    ).processWebhookEvent({
      id: "evt_pi_ambiguous",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_ambiguous",
          amount: 4500,
          metadata: {
            orderId: "order-1",
            orderNumber: "123456",
          },
          payment_method_types: ["card", "pix"],
        },
      },
    });

    expect(ordersService.confirmStripePayment).not.toHaveBeenCalled();
    expect(mockStripeWebhookEventsInsert.values).toHaveBeenCalledWith({
      id: "evt_pi_ambiguous",
      type: "payment_intent.succeeded",
    });
  });
});

describe("PaymentsService da loja", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("envia expires_at com margem mínima aceita pelo Stripe Checkout", async () => {
    const now = new Date("2026-04-28T12:00:00.500Z");
    jest.useFakeTimers().setSystemTime(now);

    const createSession = jest.fn().mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
      payment_intent: "pi_123",
    });
    const service = new PaymentsService({
      get: jest.fn((key: string) => {
        if (key === "STRIPE_SECRET_KEY") return "sk_test_123";
        if (key === "LOJA_PUBLIC_URL") return "https://loja.portalcef.com.br";
        return undefined;
      }),
    } as never);

    (
      service as unknown as {
        stripe: {
          checkout: { sessions: { create: typeof createSession } };
        };
      }
    ).stripe = {
      checkout: { sessions: { create: createSession } },
    };

    await service.createCheckoutSession({
      orderId: "order-1",
      orderNumber: "123456",
      totalAmount: 4500,
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000 - 501),
      items: [{ name: "Camiseta - Tam. 8", unitAmount: 4500, quantity: 1 }],
    });

    const params = createSession.mock.calls[0][0];
    expect(params.expires_at).toBeGreaterThanOrEqual(
      Math.floor(now.getTime() / 1000) + 30 * 60,
    );
  });
});

describe("Expiração de pedidos da loja", () => {
  it("registra motivo específico quando checkout Stripe online expira", async () => {
    const inventoryService = {
      withOrderLock: jest.fn(async (_orderId, callback) => callback()),
      withInventoryLocks: jest.fn(async (_items, callback) => callback()),
      releaseReservationInTransaction: jest
        .fn()
        .mockResolvedValue({ success: true }),
    };
    const paymentsService = {
      cancelPaymentIntent: jest.fn(),
      expireCheckoutSession: jest.fn().mockResolvedValue(undefined),
    };
    const job = new ShopExpirationJob(
      inventoryService as never,
      paymentsService as never,
    );

    mockDb.query.shopOrders.findFirst.mockResolvedValue({
      id: "order-1",
      orderNumber: "123456",
      status: "AGUARDANDO_PAGAMENTO",
      unitId: "unit-1",
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: null,
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    await (
      job as unknown as {
        expireOrder: (order: unknown) => Promise<void>;
      }
    ).expireOrder({
      id: "order-1",
      orderNumber: "123456",
      unitId: "unit-1",
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: null,
      items: [{ variantId: "variant-1", quantity: 1 }],
    });

    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationReason:
          "Checkout Stripe expirado - pagamento online nao finalizado dentro do prazo de 30 minutos",
      }),
    );
    expect(paymentsService.expireCheckoutSession).toHaveBeenCalledWith(
      "cs_test_123",
    );
  });
});

describe("Ambiente de produção da loja", () => {
  it("documenta LOJA_PUBLIC_URL no env docker e no guia de deploy", () => {
    const envDocker = readFileSync(join(process.cwd(), "../../.env.docker"), "utf8");
    const deploymentDoc = readFileSync(
      join(process.cwd(), "../../docs/DEPLOYMENT.md"),
      "utf8",
    );

    expect(envDocker).toContain("LOJA_PUBLIC_URL=https://loja.portalcef.com.br");
    expect(deploymentDoc).toContain("LOJA_PUBLIC_URL=https://loja.portalcef.com.br");
  });

  it("mantém migration idempotente para tabela de pagamentos dos pedidos", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "../../packages/db/drizzle/0024_shop_order_payments_idempotente.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "shop_order_payments"');
    expect(migration).toContain(
      'CONSTRAINT "shop_order_payments_order_id_shop_orders_id_fk"',
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "shop_order_payments_order_id_idx"',
    );
  });

  it("mantém migration idempotente para status das solicitações de interesse", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "../../packages/db/drizzle/0025_shop_interest_status_idempotente.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      'ALTER TABLE "shop_interest_requests" ADD COLUMN IF NOT EXISTS "status"',
    );
    expect(migration).toContain(
      "WHEN \"contacted_at\" IS NOT NULL THEN 'CONTATADO'",
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "shop_interest_requests_status_idx"',
    );
  });
});

describe("Validação de DTOs da loja", () => {
  it.each(["PRONTA_ENTREGA", "PRE_VENDA"] as const)(
    "valida modoVenda %s no filtro de catálogo",
    async (modoVenda) => {
      const dto = Object.assign(new CatalogFiltersDto(), { modoVenda });

      const errors = await validate(dto);

      expect(errors).toEqual([]);
    },
  );

  it("valida rejeição de modoVenda fora do contrato", async () => {
    const dto = Object.assign(new CatalogFiltersDto(), {
      modoVenda: "ONLINE",
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "modoVenda",
        }),
      ]),
    );
  });

  it.each(["ONLINE", "PRESENCIAL", "PRE_VENDA"] as const)(
    "valida orderSource %s no filtro administrativo de pedidos",
    async (orderSource) => {
      const dto = Object.assign(new ListOrdersDto(), { orderSource });

      const errors = await validate(dto);

      expect(errors).toEqual([]);
    },
  );

  it("valida rejeição de orderSource fora do contrato", async () => {
    const dto = Object.assign(new ListOrdersDto(), {
      orderSource: "WHATSAPP",
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "orderSource",
        }),
      ]),
    );
  });
});

describe("Persistência de produto da loja", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProductInsert.values.mockReturnThis();
    mockProductInsert.returning.mockResolvedValue([
      {
        id: "product-1",
        schoolId: "school-1",
        name: "Camiseta",
        basePrice: 4500,
        category: "UNIFORME_UNISSEX",
        imageUrl: "/camiseta.png",
        isActive: true,
      },
    ]);
    mockProductImagesInsert.values.mockResolvedValue(undefined);
    mockDb.delete.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.query.shopProducts.findFirst.mockResolvedValue({
      id: "product-1",
      schoolId: "school-1",
      name: "Camiseta",
      basePrice: 4500,
      category: "UNIFORME_UNISSEX",
      imageUrl: "/camiseta-antiga.png",
      isActive: true,
    });
    mockDb.returning.mockResolvedValue([
      {
        id: "product-1",
        schoolId: "school-1",
        name: "Camiseta Atualizada",
        basePrice: 5000,
        category: "UNIFORME_UNISSEX",
        imageUrl: "/camiseta-nova.png",
        isActive: true,
      },
    ]);
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue(null);
    mockDb.query.shopOrderItems.findFirst.mockResolvedValue(null);
  });

  it("cria produto e imagens na mesma transação", async () => {
    const service = new ShopProductsService();

    await service.createProduct(
      {
        schoolId: "school-1",
        name: "Camiseta",
        category: "UNIFORME_UNISSEX",
        basePrice: 4500,
        images: ["/camiseta.png"],
        isActive: true,
      },
      "admin-1",
      {
        userId: "admin-1",
        role: "diretora_geral",
        schoolId: "school-1",
        unitId: null,
      },
    );

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockProductInsert.values).toHaveBeenCalled();
    expect(mockProductImagesInsert.values).toHaveBeenCalledWith([
      {
        productId: "product-1",
        imageUrl: "/camiseta.png",
        displayOrder: 0,
      },
    ]);
  });

  it("rejeita produto com preço base zero na validação da API", async () => {
    const dto = Object.assign(new CreateProductDto(), {
      schoolId: "11111111-1111-4111-8111-111111111111",
      name: "Camiseta",
      category: "UNIFORME_UNISSEX",
      basePrice: 0,
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "basePrice",
        }),
      ]),
    );
  });

  it("atualiza produto e sincroniza imagens na mesma transação", async () => {
    const service = new ShopProductsService();

    await service.updateProduct(
      "product-1",
      {
        name: "Camiseta Atualizada",
        basePrice: 5000,
        images: ["/camiseta-nova.png"],
      },
      "admin-1",
      {
        userId: "admin-1",
        role: "diretora_geral",
        schoolId: "school-1",
        unitId: null,
      },
    );

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockProductImagesInsert.values).toHaveBeenCalledWith([
      {
        productId: "product-1",
        imageUrl: "/camiseta-nova.png",
        displayOrder: 0,
      },
    ]);
  });

  it("desativa produto e variantes em vez de apagar histórico", async () => {
    const service = new ShopProductsService();

    mockDb.query.shopProducts.findFirst.mockResolvedValue({
      id: "product-1",
      schoolId: "school-1",
      variants: [{ id: "variant-1" }, { id: "variant-2" }],
    });
    mockDb.query.shopOrderItems.findFirst.mockResolvedValue(null);

    await service.deleteProduct("product-1", "admin-1", {
      userId: "admin-1",
      role: "diretora_geral",
      schoolId: "school-1",
      unitId: null,
    });

    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
      }),
    );
  });

  it("cria variante e inventário inicial na mesma transação", async () => {
    const service = new ShopProductsService();

    mockDb.query.shopProducts.findFirst.mockResolvedValue({
      id: "product-1",
      schoolId: "school-1",
    });
    mockDb.query.shopProductVariants.findFirst.mockResolvedValue(null);

    await service.createVariant(
      {
        productId: "product-1",
        size: "8",
        sku: "CAM-8",
      },
      "admin-1",
      "unit-1",
      {
        userId: "admin-1",
        role: "gerente_unidade",
        schoolId: "school-1",
        unitId: "unit-1",
      },
    );

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockVariantInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product-1",
        size: "8",
      }),
    );
    expect(mockInventoryInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: "variant-1",
        unitId: "unit-1",
        quantity: 0,
        reservedQuantity: 0,
      }),
    );
  });

  it("rejeita atualização de variante para tamanho duplicado no mesmo produto", async () => {
    const service = new ShopProductsService();

    let variantLookupCount = 0;
    mockDb.query.shopProductVariants.findFirst.mockImplementation(async () => {
      variantLookupCount += 1;

      if (variantLookupCount === 1) {
        return {
        id: "variant-1",
        productId: "product-1",
        size: "8",
        product: {
          id: "product-1",
          schoolId: "school-1",
        },
        };
      }

      return {
        id: "variant-2",
        productId: "product-1",
        size: "10",
      };
    });

    await expect(
      service.updateVariant(
        "variant-1",
        { size: "10" },
        "admin-1",
        {
          userId: "admin-1",
          role: "diretora_geral",
          schoolId: "school-1",
          unitId: null,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("rejeita exclusão de variante com pedidos associados", async () => {
    const service = new ShopProductsService();

    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      productId: "product-1",
      product: {
        id: "product-1",
        schoolId: "school-1",
      },
    });
    mockDb.query.shopOrderItems.findFirst.mockResolvedValue({
      id: "order-item-1",
      variantId: "variant-1",
    });

    await expect(
      service.deleteVariant("variant-1", "admin-1", {
        userId: "admin-1",
        role: "diretora_geral",
        schoolId: "school-1",
        unitId: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("desativa variante em vez de apagar inventário e ledger por cascade", async () => {
    const service = new ShopProductsService();

    mockDb.query.shopProductVariants.findFirst.mockResolvedValue({
      id: "variant-1",
      productId: "product-1",
      product: {
        id: "product-1",
        schoolId: "school-1",
      },
    });
    mockDb.query.shopOrderItems.findFirst.mockResolvedValue(null);

    await service.deleteVariant("variant-1", "admin-1", {
      userId: "admin-1",
      role: "diretora_geral",
      schoolId: "school-1",
      unitId: null,
    });

    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
      }),
    );
  });
});

describe("Permissões administrativas da loja", () => {
  const metodosBloqueadosParaAuxiliar = [
    "createProduct",
    "updateProduct",
    "deleteProduct",
    "createVariant",
    "updateVariant",
    "deleteVariant",
    "addInventory",
    "removeInventory",
    "adjustInventory",
    "updateSettings",
  ] as const;

  it.each(metodosBloqueadosParaAuxiliar)(
    "não permite auxiliar_administrativo em %s",
    (methodName) => {
      const roles =
        Reflect.getMetadata(
          ROLES_KEY,
          ShopAdminController.prototype[methodName],
        ) ?? [];

      expect(roles).not.toContain("auxiliar_administrativo");
    },
  );

  it("restringe upload de storage a roles de gestão da loja", () => {
    const roles =
      Reflect.getMetadata(ROLES_KEY, StorageController.prototype.upload) ?? [];

    expect(roles).toEqual([
      "master",
      "diretora_geral",
      "gerente_unidade",
    ]);
  });
});

describe("Controller admin da loja", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([{ count: 0 }]);
    mockDb.query.shopOrders.findMany.mockResolvedValue([]);
  });

  const userWithoutSchool = {
    userId: "user-1",
    role: "diretora_geral",
    schoolId: null as never,
    unitId: null,
  };

  it("não lista produtos globalmente quando usuário não-master está sem schoolId", async () => {
    const controller = new ShopAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.getAllProducts({ user: userWithoutSchool }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockDb.query.shopProducts.findMany).not.toHaveBeenCalled();
  });

  it("não lista produtos da escola inteira quando role de unidade está sem unitId", async () => {
    const controller = new ShopAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.getAllProducts({
        user: {
          userId: "user-1",
          role: "gerente_unidade",
          schoolId: "school-1",
          unitId: null,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockDb.query.shopProducts.findMany).not.toHaveBeenCalled();
  });

  it("marca controller administrativo da loja para correspondência exata de roles", () => {
    expect(Reflect.getMetadata("roles:exact", ShopAdminController)).toBe(true);
  });

  it("não calcula dashboard globalmente quando usuário não-master está sem schoolId", async () => {
    const controller = new ShopAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.getDashboard({ user: userWithoutSchool }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("não interpola datas em SQL raw ao calcular vendas do dashboard", async () => {
    const controller = new ShopAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await controller.getDashboard({
      user: {
        userId: "admin-1",
        role: "gerente_unidade",
        schoolId: "school-1",
        unitId: "unit-1",
      },
    });

    expect(gte).toHaveBeenCalledTimes(2);
    expect(gte).toHaveBeenCalledWith(expect.anything(), expect.any(Date));

    const chamadasSqlComData = (sql as unknown as jest.Mock).mock.calls.filter(
      (args: unknown[]) => args.some((arg: unknown) => arg instanceof Date),
    );
    expect(chamadasSqlComData).toHaveLength(0);
  });

  it("permite venda presencial para escopo de escola quando unidade é informada no payload", async () => {
    const ordersService = {
      createPresentialSale: jest.fn().mockResolvedValue({ id: "order-1" }),
    };
    const controller = new ShopAdminController(
      {} as never,
      {} as never,
      ordersService as never,
      {} as never,
      {} as never,
    );

    await controller.createPresentialSale(
      {
        user: {
          userId: "admin-1",
          role: "diretora_geral",
          schoolId: "school-1",
          unitId: null,
        },
      },
      {
        unitId: "unit-1",
        customerName: "Maria Silva",
        customerPhone: "11987654321",
        payments: [{ method: "PIX", amount: 4500 }],
        items: [
          {
            variantId: "variant-1",
            quantity: 1,
            studentName: "João Silva",
          },
        ],
      } as never,
    );

    expect(ordersService.createPresentialSale).toHaveBeenCalledWith(
      expect.any(Object),
      "school-1",
      "unit-1",
      "admin-1",
    );
  });

  it("não calcula dashboard para role de unidade sem unitId", async () => {
    const controller = new ShopAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.getDashboard({
        user: {
          userId: "admin-1",
          role: "gerente_unidade",
          schoolId: "school-1",
          unitId: null,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("não permite venda presencial para role de unidade sem unitId mesmo com payload", async () => {
    const ordersService = {
      createPresentialSale: jest.fn().mockResolvedValue({ id: "order-1" }),
    };
    const controller = new ShopAdminController(
      {} as never,
      {} as never,
      ordersService as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.createPresentialSale(
        {
          user: {
            userId: "admin-1",
            role: "gerente_unidade",
            schoolId: "school-1",
            unitId: null,
          },
        },
        {
          unitId: "unit-2",
          customerName: "Maria Silva",
          customerPhone: "11987654321",
          payments: [{ method: "PIX", amount: 4500 }],
          items: [
            {
              variantId: "variant-1",
              quantity: 1,
              studentName: "João Silva",
            },
          ],
        } as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(ordersService.createPresentialSale).not.toHaveBeenCalled();
  });
});
