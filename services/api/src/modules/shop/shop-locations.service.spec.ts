import { Test, TestingModule } from "@nestjs/testing";
import { ShopLocationsService } from "./shop-locations.service";

const mockFindManySchools = jest.fn();
const mockFindManyUnits = jest.fn();

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => ({
    query: {
      schools: { findMany: mockFindManySchools },
      units: { findMany: mockFindManyUnits },
    },
  })),
  schools: {},
  units: {},
  asc: jest.fn(),
}));

describe("ShopLocationsService", () => {
  let service: ShopLocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShopLocationsService],
    }).compile();

    service = module.get<ShopLocationsService>(ShopLocationsService);
    jest.clearAllMocks();
  });

  it("should group units by school", async () => {
    mockFindManySchools.mockResolvedValue([
      { id: "school-1", name: "School A", code: "school-a" },
      { id: "school-2", name: "School B", code: "school-b" },
    ]);
    mockFindManyUnits.mockResolvedValue([
      { id: "unit-1", name: "Unit A1", code: "unit-a1", schoolId: "school-1" },
      { id: "unit-2", name: "Unit A2", code: "unit-a2", schoolId: "school-1" },
      { id: "unit-3", name: "Unit B1", code: "unit-b1", schoolId: "school-2" },
    ]);

    const result = await service.listLocations();

    expect(result).toEqual([
      {
        id: "school-1",
        name: "School A",
        code: "school-a",
        units: [
          { id: "unit-1", name: "Unit A1", code: "unit-a1" },
          { id: "unit-2", name: "Unit A2", code: "unit-a2" },
        ],
      },
      {
        id: "school-2",
        name: "School B",
        code: "school-b",
        units: [{ id: "unit-3", name: "Unit B1", code: "unit-b1" }],
      },
    ]);
  });

  it("should return empty units when no units exist for a school", async () => {
    mockFindManySchools.mockResolvedValue([
      { id: "school-1", name: "School A", code: "school-a" },
    ]);
    mockFindManyUnits.mockResolvedValue([]);

    const result = await service.listLocations();

    expect(result).toEqual([
      { id: "school-1", name: "School A", code: "school-a", units: [] },
    ]);
  });
});
