import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { SharePointService } from "./sharepoint.service";
import { StorageService } from "../storage/storage.service";

describe("SharePointService", () => {
  let service: SharePointService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AZURE_TENANT_ID: "test-tenant-id",
        AZURE_CLIENT_ID: "test-client-id",
        AZURE_CLIENT_SECRET: "test-client-secret",
        SHAREPOINT_SITE_ID: "test-site-id",
        SHAREPOINT_DRIVE_ID: "test-drive-id",
      };
      return config[key];
    }),
  };

  const mockStorageService = {
    getObject: jest.fn(),
    replaceFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharePointService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<SharePointService>(SharePointService);
  });

  it("deve ser definido", () => {
    expect(service).toBeDefined();
  });

  it("deve retornar true para isConfigurado quando todas as variáveis existem", () => {
    expect(service.isConfigurado()).toBe(true);
  });

  it("deve retornar false para isConfigurado quando faltam variáveis", () => {
    mockConfigService.get.mockReturnValue(undefined as unknown as string);
    const service2 = new SharePointService(
      mockConfigService as unknown as ConfigService,
      mockStorageService as unknown as StorageService,
    );
    expect(service2.isConfigurado()).toBe(false);
  });

  it("deve construir URL ms-word corretamente", () => {
    const shareUrl = "https://escola.sharepoint.com/:w:/s/site/EaBcDeFg?e=xYz";
    const result = service.construirMsWordUrl(shareUrl);
    expect(result).toBe(`ms-word:ofe|u|${shareUrl}`);
  });
});
