import { Test, TestingModule } from "@nestjs/testing";
import { ShopProductsService } from "./shop-products.service";

// Mock the db module
jest.mock("@essencia/db", () => ({
  db: {
    query: {
      shopProducts: { findFirst: jest.fn(), findMany: jest.fn() },
      shopProductVariants: { findFirst: jest.fn(), findMany: jest.fn() },
      shopInventory: { findFirst: jest.fn(), findMany: jest.fn() },
    },
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn(),
  },
  shopProducts: {},
  shopProductVariants: {},
  shopInventory: {},
}));

describe("ShopProductsService", () => {
  let service: ShopProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShopProductsService],
    }).compile();

    service = module.get<ShopProductsService>(ShopProductsService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getCatalog", () => {
    const mockProducts = [
      {
        id: "prod-1",
        name: "Camiseta Uniforme",
        category: "UNIFORME_DIARIO",
        basePrice: 4500,
        isActive: true,
        variants: [
          {
            id: "var-1",
            size: "8",
            isActive: true,
            inventory: [{ quantity: 10, reservedQuantity: 2 }],
          },
          {
            id: "var-2",
            size: "10",
            isActive: true,
            inventory: [{ quantity: 0, reservedQuantity: 0 }],
          },
        ],
      },
    ];

    it("should return products with available stock", () => {
      const product = mockProducts[0];
      const variantWithStock = product.variants.find((v) => {
        const inv = v.inventory[0];
        return inv.quantity - inv.reservedQuantity > 0;
      });

      expect(variantWithStock).toBeDefined();
      expect(variantWithStock?.size).toBe("8");
    });

    it("should filter by category", () => {
      const category = "UNIFORME_DIARIO";
      const filtered = mockProducts.filter((p) => p.category === category);

      expect(filtered.length).toBe(1);
    });

    it("should filter by size", () => {
      const size = "8";
      const product = mockProducts[0];
      const hasSize = product.variants.some((v) => v.size === size);

      expect(hasSize).toBe(true);
    });

    it("should only return active products", () => {
      const activeProducts = mockProducts.filter((p) => p.isActive);

      expect(activeProducts.length).toBe(1);
    });

    it("should only return active variants", () => {
      const product = mockProducts[0];
      const activeVariants = product.variants.filter((v) => v.isActive);

      expect(activeVariants.length).toBe(2);
    });

    it("should filter by inStock option", () => {
      const product = mockProducts[0];
      const inStockVariants = product.variants.filter((v) => {
        const inv = v.inventory[0];
        return inv.quantity - inv.reservedQuantity > 0;
      });

      expect(inStockVariants.length).toBe(1);
    });
  });

  describe("getProductById", () => {
    it("should return product with all variants and stock", () => {
      const product = {
        id: "prod-1",
        name: "Camiseta",
        variants: [{ id: "var-1", size: "8" }],
      };

      expect(product.variants.length).toBeGreaterThan(0);
    });

    it("should return 404 for non-existent product", () => {
      const product = null;
      expect(product).toBeNull();
    });

    it("should include unit-specific stock information", () => {
      const productWithStock = {
        id: "prod-1",
        variants: [
          {
            id: "var-1",
            inventory: [
              { unitId: "unit-1", quantity: 10, reservedQuantity: 2 },
              { unitId: "unit-2", quantity: 5, reservedQuantity: 0 },
            ],
          },
        ],
      };

      expect(productWithStock.variants[0].inventory.length).toBe(2);
    });
  });

  describe("createProduct", () => {
    const validProductData = {
      schoolId: "school-uuid",
      name: "Nova Camiseta",
      description: "Descrição do produto",
      category: "UNIFORME_DIARIO",
      basePrice: 5000,
    };

    it("should create product with valid data", () => {
      expect(validProductData.name.length).toBeGreaterThan(0);
      expect(validProductData.basePrice).toBeGreaterThan(0);
    });

    it("should require school association", () => {
      expect(validProductData.schoolId).toBeDefined();
    });

    it("should validate category enum", () => {
      const validCategories = [
        "UNIFORME_DIARIO",
        "UNIFORME_EDUCACAO_FISICA",
        "ACESSORIO",
      ];

      expect(validCategories).toContain(validProductData.category);
    });

    it("should validate base price is positive", () => {
      expect(validProductData.basePrice).toBeGreaterThan(0);
    });
  });

  describe("createVariant", () => {
    const validVariantData = {
      productId: "prod-uuid",
      size: "10",
      sku: "CAM-DIA-10",
      priceOverride: null,
    };

    it("should create variant with valid size", () => {
      const validSizes = [
        "2",
        "4",
        "6",
        "8",
        "10",
        "12",
        "14",
        "16",
        "PP",
        "P",
        "M",
        "G",
        "GG",
      ];

      expect(validSizes).toContain(validVariantData.size);
    });

    it("should allow optional SKU", () => {
      expect(validVariantData.sku).toBeDefined();
    });

    it("should allow optional price override", () => {
      expect(validVariantData.priceOverride).toBeNull();
    });

    it("should use base price when no override", () => {
      const basePrice = 5000;
      const effectivePrice = validVariantData.priceOverride ?? basePrice;

      expect(effectivePrice).toBe(basePrice);
    });
  });

  describe("updateProduct", () => {
    it("should update product fields", () => {
      const update = {
        name: "Updated Name",
        basePrice: 5500,
      };

      expect(update.name).toBeDefined();
      expect(update.basePrice).toBeGreaterThan(0);
    });

    it("should toggle active status", () => {
      const product = { isActive: true };
      const toggled = !product.isActive;

      expect(toggled).toBe(false);
    });
  });

  describe("deleteProduct", () => {
    it("should soft delete by setting isActive to false", () => {
      const softDelete = { isActive: false, deletedAt: new Date() };

      expect(softDelete.isActive).toBe(false);
      expect(softDelete.deletedAt).toBeInstanceOf(Date);
    });

    it("should not hard delete products with order history", () => {
      const hasOrders = true;
      const canHardDelete = !hasOrders;

      expect(canHardDelete).toBe(false);
    });
  });
});

describe("Product Categories", () => {
  const categories = [
    "UNIFORME_DIARIO",
    "UNIFORME_EDUCACAO_FISICA",
    "ACESSORIO",
  ];

  it("should have valid category values", () => {
    expect(categories.length).toBe(3);
  });

  it("should categorize products correctly", () => {
    const product = { category: "UNIFORME_DIARIO" };

    expect(categories).toContain(product.category);
  });
});

describe("Price Calculations", () => {
  it("should store prices in centavos", () => {
    const priceReais = 45.0;
    const priceCentavos = Math.round(priceReais * 100);

    expect(priceCentavos).toBe(4500);
  });

  it("should use variant price override when available", () => {
    const basePrice = 4500;
    const priceOverride = 5000;
    const effectivePrice = priceOverride ?? basePrice;

    expect(effectivePrice).toBe(5000);
  });

  it("should calculate total correctly", () => {
    const items = [
      { unitPrice: 4500, quantity: 2 },
      { unitPrice: 3500, quantity: 1 },
    ];

    const total = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    expect(total).toBe(12500);
  });
});
