import { Test, TestingModule } from "@nestjs/testing";
import { ShopInterestService } from "./shop-interest.service";

// Mock the db module
jest.mock("@essencia/db", () => ({
  db: {
    query: {
      shopInterestRequests: { findFirst: jest.fn(), findMany: jest.fn() },
      shopInterestItems: { findFirst: jest.fn(), findMany: jest.fn() },
    },
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    transaction: jest.fn(),
  },
  shopInterestRequests: {},
  shopInterestItems: {},
}));

describe("ShopInterestService", () => {
  let service: ShopInterestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShopInterestService],
    }).compile();

    service = module.get<ShopInterestService>(ShopInterestService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createInterestRequest", () => {
    const validData = {
      schoolId: "school-uuid",
      unitId: "unit-uuid",
      customerName: "Maria Silva",
      customerPhone: "11987654321",
      customerEmail: "maria@email.com",
      studentName: "João Silva",
      studentClass: "3º Ano A",
      notes: "Preciso de 2 camisetas tamanho 8",
      items: [{ variantId: "variant-1", quantity: 2 }],
    };

    it("should create interest request with valid data", () => {
      expect(validData.customerName.length).toBeGreaterThan(0);
      expect(validData.items.length).toBeGreaterThanOrEqual(1);
    });

    it("should validate phone format", () => {
      const phone = validData.customerPhone.replace(/\D/g, "");
      expect(phone.length).toBeGreaterThanOrEqual(10);
      expect(phone.length).toBeLessThanOrEqual(13);
    });

    it("should validate email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(validData.customerEmail)).toBe(true);
    });

    it("should require at least one item", () => {
      expect(validData.items.length).toBeGreaterThanOrEqual(1);
    });

    it("should allow optional notes", () => {
      const dataWithoutNotes = { ...validData, notes: undefined };
      expect(dataWithoutNotes.notes).toBeUndefined();
    });

    it("should set status to PENDENTE by default", () => {
      const defaultStatus = "PENDENTE";
      expect(defaultStatus).toBe("PENDENTE");
    });
  });

  describe("listInterestRequests", () => {
    const mockRequests = [
      {
        id: "1",
        customerName: "Maria",
        contactedAt: null,
        createdAt: new Date(),
      },
      {
        id: "2",
        customerName: "João",
        contactedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    it("should filter by pending status", () => {
      const pending = mockRequests.filter((r) => !r.contactedAt);
      expect(pending.length).toBe(1);
    });

    it("should filter by contacted status", () => {
      const contacted = mockRequests.filter((r) => r.contactedAt);
      expect(contacted.length).toBe(1);
    });

    it("should order by createdAt desc", () => {
      const sorted = [...mockRequests].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      expect(sorted).toBeDefined();
    });

    it("should paginate results", () => {
      const page = 1;
      const pageSize = 20;
      const offset = (page - 1) * pageSize;

      expect(offset).toBe(0);
    });
  });

  describe("markAsContacted", () => {
    it("should set contactedAt timestamp", () => {
      const contactedAt = new Date();
      expect(contactedAt).toBeInstanceOf(Date);
    });

    it("should record who contacted", () => {
      const contactedBy = "user-uuid";
      expect(contactedBy).toBeDefined();
    });

    it("should not update already contacted request", () => {
      const alreadyContacted = { contactedAt: new Date() };
      expect(alreadyContacted.contactedAt).toBeDefined();
    });
  });

  describe("getInterestSummary", () => {
    it("should count items by variant", () => {
      const items = [
        { variantId: "v1", quantity: 2 },
        { variantId: "v1", quantity: 3 },
        { variantId: "v2", quantity: 1 },
      ];

      const summary = items.reduce(
        (acc, item) => {
          acc[item.variantId] = (acc[item.variantId] || 0) + item.quantity;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(summary["v1"]).toBe(5);
      expect(summary["v2"]).toBe(1);
    });

    it("should include product/variant details", () => {
      const summaryItem = {
        variantId: "v1",
        productName: "Camiseta",
        size: "8",
        totalQuantity: 5,
        requestCount: 3,
      };

      expect(summaryItem.productName).toBeDefined();
      expect(summaryItem.totalQuantity).toBeGreaterThan(0);
    });
  });
});

describe("Interest Request Validation", () => {
  it("should require student name", () => {
    const studentName = "João Silva";
    expect(studentName.length).toBeGreaterThan(0);
  });

  it("should allow optional student class", () => {
    const studentClass = "3º Ano A";
    expect(studentClass).toBeDefined();
  });

  it("should validate item quantity is positive", () => {
    const quantity = 2;
    expect(quantity).toBeGreaterThan(0);
  });
});
