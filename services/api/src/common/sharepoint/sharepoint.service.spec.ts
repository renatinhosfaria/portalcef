import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { SharePointService } from "./sharepoint.service";
import { StorageService } from "../storage/storage.service";

describe("SharePointService", () => {
  let service: SharePointService;

  const obterConfigPadrao = (key: string) => {
    const config: Record<string, string> = {
      AZURE_TENANT_ID: "test-tenant-id",
      AZURE_CLIENT_ID: "test-client-id",
      AZURE_CLIENT_SECRET: "test-client-secret",
      SHAREPOINT_SITE_ID: "test-site-id",
      SHAREPOINT_DRIVE_ID: "test-drive-id",
    };
    return config[key];
  };

  const mockConfigService = {
    get: jest.fn(obterConfigPadrao),
  };

  const mockStorageService = {
    getObject: jest.fn(),
    replaceFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation(obterConfigPadrao);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharePointService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<SharePointService>(SharePointService);
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it("deve criar link de edição com expiração padrão de 8 horas", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-04T12:00:00.000Z"));

    const post = jest.fn().mockResolvedValue({
      id: "permissao-123",
      link: { webUrl: "https://sharepoint.test/link-edicao" },
    });

    (service as any).client = {
      api: jest.fn().mockReturnValue({ post }),
    };
    (service as any).driveWebUrl =
      "https://colegio.sharepoint.com/sites/Colegio/Documentos%20Compartilhados";

    await service.criarLinkCompartilhamento(
      "item-123",
      "documento-123",
      "arquivo.docx",
    );

    expect(post).toHaveBeenCalledWith({
      type: "edit",
      scope: "anonymous",
      expirationDateTime: "2026-05-04T20:00:00.000Z",
    });
  });

  it("deve respeitar SHAREPOINT_EDIT_TTL_HOURS ao criar link de edição", async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === "SHAREPOINT_EDIT_TTL_HOURS") return "12";
      return obterConfigPadrao(key);
    });
    const serviceComConfig = new SharePointService(
      mockConfigService as unknown as ConfigService,
      mockStorageService as unknown as StorageService,
    );

    jest.useFakeTimers().setSystemTime(new Date("2026-05-04T12:00:00.000Z"));

    const post = jest.fn().mockResolvedValue({
      id: "permissao-123",
      link: { webUrl: "https://sharepoint.test/link-edicao" },
    });

    (serviceComConfig as any).client = {
      api: jest.fn().mockReturnValue({ post }),
    };
    (serviceComConfig as any).driveWebUrl =
      "https://colegio.sharepoint.com/sites/Colegio/Documentos%20Compartilhados";

    await serviceComConfig.criarLinkCompartilhamento(
      "item-123",
      "documento-123",
      "arquivo.docx",
    );

    expect(post).toHaveBeenCalledWith({
      type: "edit",
      scope: "anonymous",
      expirationDateTime: "2026-05-05T00:00:00.000Z",
    });
  });

  it("deve tratar itemNotFound como arquivo já removido no SharePoint", async () => {
    const erro = Object.assign(new Error("The resource could not be found."), {
      code: "itemNotFound",
      statusCode: 404,
    });
    const deleteMock = jest.fn().mockRejectedValue(erro);

    (service as unknown as { client: { api: jest.Mock } }).client = {
      api: jest.fn().mockReturnValue({ delete: deleteMock }),
    };

    await expect(service.removerArquivo("item-inexistente")).resolves.toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});
