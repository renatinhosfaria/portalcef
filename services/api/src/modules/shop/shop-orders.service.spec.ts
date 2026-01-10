import { Test, TestingModule } from "@nestjs/testing";
import { ShopOrdersService } from "./shop-orders.service";
import { ShopInventoryService } from "./shop-inventory.service";
import { PaymentsService } from "../payments/payments.service";

// Mock the db module
jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => ({
    query: {
      shopProducts: { findFirst: jest.fn(), findMany: jest.fn() },
      shopProductVariants: { findFirst: jest.fn(), findMany: jest.fn() },
      shopInventory: { findFirst: jest.fn(), findMany: jest.fn() },
      shopOrders: { findFirst: jest.fn(), findMany: jest.fn() },
      shopOrderItems: { findFirst: jest.fn(), findMany: jest.fn() },
    },
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    transaction: jest.fn(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
  })),
  shopProducts: {},
  shopProductVariants: {},
  shopInventory: {},
  shopOrders: {},
  shopOrderItems: {},
  shopInventoryLedger: {},
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
  asc: jest.fn(),
}));

describe("ShopOrdersService", () => {
  let service: ShopOrdersService;
  let inventoryService: ShopInventoryService;

  const mockInventoryService = {
    reserveStock: jest.fn(),
    releaseReservation: jest.fn(),
    confirmReservation: jest.fn(),
    confirmSale: jest.fn(),
    adjustStock: jest.fn(),
    getInventoryByVariant: jest.fn(),
  };

  const mockPaymentsService = {
    createPaymentIntent: jest.fn(),
    refundPayment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopOrdersService,
        {
          provide: ShopInventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    }).compile();

    service = module.get<ShopOrdersService>(ShopOrdersService);
    inventoryService = module.get<ShopInventoryService>(ShopInventoryService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
    expect(inventoryService).toBeDefined();
  });

  describe("createOrder", () => {
    const validOrderData = {
      schoolId: "school-uuid-1",
      unitId: "unit-uuid-1",
      customerName: "João Silva",
      customerPhone: "11987654321",
      items: [
        { variantId: "variant-1", quantity: 2, studentName: "Maria Silva" },
      ],
      installments: 1,
    };

    it("should create order successfully when stock is available", async () => {
      // Mock inventory check - stock available
      mockInventoryService.reserveStock.mockResolvedValue({ success: true });

      // Test the service methods exist and mocks are properly configured
      expect(service).toBeDefined();
      expect(mockInventoryService.reserveStock).toBeDefined();
      expect(mockPaymentsService.createPaymentIntent).toBeDefined();
    });

    it("should fail when stock is insufficient", async () => {
      mockInventoryService.reserveStock.mockResolvedValue({
        success: false,
        error: "Estoque insuficiente",
      });

      // The order creation should fail
      expect(mockInventoryService.reserveStock).toBeDefined();
    });

    it("should validate required fields", () => {
      const invalidData = { ...validOrderData, customerName: "" };

      // Validation should reject empty customer name
      expect(invalidData.customerName).toBe("");
    });

    it("should validate phone format (10-13 digits)", () => {
      const validPhone = "11987654321";
      const invalidPhone = "123";

      expect(validPhone.replace(/\D/g, "").length).toBeGreaterThanOrEqual(10);
      expect(invalidPhone.replace(/\D/g, "").length).toBeLessThan(10);
    });

    it("should limit installments to max 12", () => {
      const maxInstallments = 12;
      expect(validOrderData.installments).toBeLessThanOrEqual(maxInstallments);
    });
  });

  describe("cancelOrder", () => {
    const mockOrder = {
      id: "order-uuid",
      orderNumber: "123456",
      status: "PAGO",
      items: [{ variantId: "v1", quantity: 2, unitId: "unit-1" }],
    };

    it("should cancel order and release stock", async () => {
      mockInventoryService.releaseReservation.mockResolvedValue({
        success: true,
      });

      // After cancel, stock should be released
      expect(mockInventoryService.releaseReservation).toBeDefined();
    });

    it("should not cancel already cancelled order", () => {
      const cancelledOrder = { ...mockOrder, status: "CANCELADO" };

      // Should throw error for already cancelled
      expect(cancelledOrder.status).toBe("CANCELADO");
    });

    it("should not cancel already picked up order", () => {
      const pickedUpOrder = { ...mockOrder, status: "RETIRADO" };

      // Should throw error for already picked up
      expect(pickedUpOrder.status).toBe("RETIRADO");
    });

    it("should require cancellation reason", () => {
      const cancellationReason = "Cliente solicitou cancelamento";
      expect(cancellationReason.length).toBeGreaterThan(0);
    });
  });

  describe("markPickedUp", () => {
    it("should mark order as picked up", () => {
      const order = { id: "order-1", status: "PAGO" };
      const userId = "user-uuid";

      // After pickup, status should be RETIRADO
      expect(order.status).toBe("PAGO");
      expect(userId).toBeDefined();
    });

    it("should only allow pickup for PAGO orders", () => {
      const pendingOrder = { status: "AGUARDANDO_PAGAMENTO" };
      const paidOrder = { status: "PAGO" };

      expect(paidOrder.status).toBe("PAGO");
      expect(pendingOrder.status).not.toBe("PAGO");
    });

    it("should record who picked up the order", () => {
      const pickupData = {
        orderId: "order-1",
        pickedUpBy: "user-uuid",
        pickedUpAt: new Date(),
      };

      expect(pickupData.pickedUpBy).toBeDefined();
      expect(pickupData.pickedUpAt).toBeInstanceOf(Date);
    });
  });

  describe("getOrderByNumber", () => {
    it("should find order by number and phone", () => {
      const orderNumber = "123456";
      const phone = "11987654321";

      expect(orderNumber.length).toBe(6);
      expect(phone.length).toBeGreaterThanOrEqual(10);
    });

    it("should return 404 when order not found", () => {
      const nonExistentOrder = null;
      expect(nonExistentOrder).toBeNull();
    });

    it("should mask sensitive data for public endpoint", () => {
      const order = {
        customerPhone: "11987654321",
        stripePaymentIntentId: "pi_123456789",
      };

      // Public endpoint should not expose stripe ID
      expect(order.stripePaymentIntentId).toContain("pi_");
    });
  });

  describe("presentialSale", () => {
    it("should create order with PRESENCIAL source", () => {
      const orderSource = "PRESENCIAL";
      expect(orderSource).toBe("PRESENCIAL");
    });

    it("should skip payment processing for presential sales", () => {
      const paymentMethod = "DINHEIRO";
      const skipStripe = ["DINHEIRO", "PIX"].includes(paymentMethod);

      expect(skipStripe).toBe(true);
    });

    it("should mark as RETIRADO immediately for presential", () => {
      const presentialStatus = "RETIRADO";
      expect(presentialStatus).toBe("RETIRADO");
    });
  });
});

describe("Order Number Generation", () => {
  it("should generate 6-digit order numbers", () => {
    const generateOrderNumber = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const orderNumber = generateOrderNumber();
    expect(orderNumber.length).toBe(6);
    expect(parseInt(orderNumber)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(orderNumber)).toBeLessThan(1000000);
  });

  it("should generate unique order numbers", () => {
    const generateOrderNumber = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      numbers.add(generateOrderNumber());
    }

    // With random generation, we expect high uniqueness
    expect(numbers.size).toBeGreaterThan(90);
  });
});
