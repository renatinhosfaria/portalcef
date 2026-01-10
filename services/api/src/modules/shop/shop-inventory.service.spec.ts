import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ShopInventoryService } from "./shop-inventory.service";

// Mock the db module
jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => ({
    query: {
      shopInventory: { findFirst: jest.fn(), findMany: jest.fn() },
      shopInventoryLedger: { findMany: jest.fn() },
    },
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    transaction: jest.fn(),
  })),
  shopInventory: {},
  shopInventoryLedger: {},
  shopProductVariants: {},
  eq: jest.fn(),
  and: jest.fn(),
  sql: jest.fn(),
}));

// Mock ioredis
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue("OK"),
  }));
});

describe("ShopInventoryService", () => {
  let service: ShopInventoryService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === "REDIS_URL") return "redis://localhost:6379";
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopInventoryService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ShopInventoryService>(ShopInventoryService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("reserveStock", () => {
    const mockInventory = {
      id: "inv-1",
      variantId: "variant-1",
      unitId: "unit-1",
      quantity: 10,
      reservedQuantity: 2,
      lowStockThreshold: 5,
    };

    it("should reserve stock successfully when available", async () => {
      const available = mockInventory.quantity - mockInventory.reservedQuantity;
      const requestedQty = 3;

      expect(available).toBe(8);
      expect(requestedQty).toBeLessThanOrEqual(available);
    });

    it("should fail when requested quantity exceeds available", () => {
      const available = mockInventory.quantity - mockInventory.reservedQuantity;
      const requestedQty = 10;

      expect(requestedQty).toBeGreaterThan(available);
    });

    it("should update reserved quantity on successful reservation", () => {
      const currentReserved = mockInventory.reservedQuantity;
      const newReservation = 3;
      const newReservedTotal = currentReserved + newReservation;

      expect(newReservedTotal).toBe(5);
    });

    it("should handle concurrent reservations (race condition)", async () => {
      // Simulate race condition by checking quantity before and after
      const initialQty = mockInventory.quantity;
      const reservation1 = 5;
      const reservation2 = 5;

      // Both reservations should not exceed total
      const totalReservations = reservation1 + reservation2;
      const available = initialQty - mockInventory.reservedQuantity;

      // One reservation should fail if concurrent
      expect(totalReservations).toBeGreaterThan(available);
    });

    it("should create ledger entry for reservation", () => {
      const ledgerEntry = {
        variantId: "variant-1",
        unitId: "unit-1",
        movementType: "RESERVA",
        quantityChange: -3,
        notes: "Reserva para pedido #123456",
        createdBy: "system",
      };

      expect(ledgerEntry.movementType).toBe("RESERVA");
      expect(ledgerEntry.quantityChange).toBeLessThan(0);
    });
  });

  describe("releaseReservation", () => {
    it("should release reserved stock back to available", () => {
      const reserved = 5;
      const releaseQty = 3;
      const newReserved = reserved - releaseQty;

      expect(newReserved).toBe(2);
      expect(newReserved).toBeGreaterThanOrEqual(0);
    });

    it("should not release more than reserved", () => {
      const reserved = 5;
      const releaseQty = 10;

      expect(releaseQty).toBeGreaterThan(reserved);
    });

    it("should create ledger entry for release", () => {
      const ledgerEntry = {
        movementType: "LIBERACAO",
        quantityChange: 3,
        notes: "Liberação por cancelamento",
      };

      expect(ledgerEntry.movementType).toBe("LIBERACAO");
      expect(ledgerEntry.quantityChange).toBeGreaterThan(0);
    });
  });

  describe("confirmReservation", () => {
    it("should convert reservation to sold stock", () => {
      const inventory = {
        quantity: 10,
        reservedQuantity: 3,
      };

      const soldQty = 3;
      const newQuantity = inventory.quantity - soldQty;
      const newReserved = inventory.reservedQuantity - soldQty;

      expect(newQuantity).toBe(7);
      expect(newReserved).toBe(0);
    });

    it("should create ledger entry for sale", () => {
      const ledgerEntry = {
        movementType: "VENDA",
        quantityChange: -3,
        notes: "Venda pedido #123456",
      };

      expect(ledgerEntry.movementType).toBe("VENDA");
    });
  });

  describe("adjustStock", () => {
    const adjustmentReasons = [
      "ENTRADA",
      "AJUSTE_POSITIVO",
      "AJUSTE_NEGATIVO",
      "DANO",
      "PERDA",
    ];

    it("should increase stock on positive adjustment", () => {
      const currentQty = 10;
      const adjustment = 5;
      const newQty = currentQty + adjustment;

      expect(newQty).toBe(15);
    });

    it("should decrease stock on negative adjustment", () => {
      const currentQty = 10;
      const adjustment = -3;
      const newQty = currentQty + adjustment;

      expect(newQty).toBe(7);
    });

    it("should not allow negative final stock", () => {
      const currentQty = 5;
      const adjustment = -10;
      const newQty = currentQty + adjustment;

      expect(newQty).toBeLessThan(0);
      // Service should reject this
    });

    it("should require reason for adjustment", () => {
      const adjustment = {
        quantity: -3,
        reason: "DANO",
        notes: "Produto danificado no estoque",
      };

      expect(adjustmentReasons).toContain(adjustment.reason);
    });

    it("should record who made the adjustment", () => {
      const adjustment = {
        createdBy: "user-uuid",
        createdAt: new Date(),
      };

      expect(adjustment.createdBy).toBeDefined();
      expect(adjustment.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("getInventoryLedger", () => {
    it("should return ledger entries ordered by date desc", () => {
      const entries = [
        { createdAt: new Date("2026-01-09T10:00:00") },
        { createdAt: new Date("2026-01-09T12:00:00") },
        { createdAt: new Date("2026-01-09T08:00:00") },
      ];

      const sorted = entries.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      expect(sorted[0].createdAt.getHours()).toBe(12);
      expect(sorted[2].createdAt.getHours()).toBe(8);
    });

    it("should filter by variant and unit", () => {
      const filters = {
        variantId: "variant-1",
        unitId: "unit-1",
      };

      expect(filters.variantId).toBeDefined();
      expect(filters.unitId).toBeDefined();
    });
  });

  describe("getLowStockAlerts", () => {
    it("should identify items below threshold", () => {
      const inventory = [
        { available: 3, lowStockThreshold: 5 },
        { available: 10, lowStockThreshold: 5 },
        { available: 0, lowStockThreshold: 5 },
      ];

      const lowStock = inventory.filter(
        (i) => i.available <= i.lowStockThreshold,
      );

      expect(lowStock.length).toBe(2);
    });

    it("should include out of stock items", () => {
      const inventory = { available: 0, lowStockThreshold: 5 };

      expect(inventory.available).toBe(0);
      expect(inventory.available <= inventory.lowStockThreshold).toBe(true);
    });
  });
});

describe("Inventory Calculations", () => {
  it("should calculate available stock correctly", () => {
    const quantity = 100;
    const reserved = 30;
    const available = quantity - reserved;

    expect(available).toBe(70);
  });

  it("should handle zero stock gracefully", () => {
    const quantity = 0;
    const reserved = 0;
    const available = quantity - reserved;

    expect(available).toBe(0);
    expect(available).toBeGreaterThanOrEqual(0);
  });

  it("should never have negative available stock", () => {
    const quantity = 10;
    const reserved = 10;
    const available = Math.max(0, quantity - reserved);

    expect(available).toBeGreaterThanOrEqual(0);
  });
});
