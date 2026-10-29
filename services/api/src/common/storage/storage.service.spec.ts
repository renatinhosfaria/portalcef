import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { MultipartFile } from "@fastify/multipart";
import { StorageService } from "./storage.service";

jest.mock("@aws-sdk/client-s3", () => ({
  __mocks: {
    s3Send: jest.fn().mockResolvedValue({}),
    putObjectCommand: jest.fn().mockImplementation(function PutObjectCommand(
      input: Record<string, unknown>,
    ) {
      return { input };
    }),
  },
  S3Client: jest.fn().mockImplementation(() => {
    const { __mocks } = jest.requireMock("@aws-sdk/client-s3");
    return {
      send: __mocks.s3Send,
    };
  }),
  PutObjectCommand: jest
    .fn()
    .mockImplementation(function PutObjectCommand(
      input: Record<string, unknown>,
    ) {
      const { __mocks } = jest.requireMock("@aws-sdk/client-s3");
      __mocks.putObjectCommand(input);
      return { input };
    }),
  GetObjectCommand: jest
    .fn()
    .mockImplementation(function GetObjectCommand(
      input: Record<string, unknown>,
    ) {
      return { input };
    }),
  DeleteObjectCommand: jest
    .fn()
    .mockImplementation(function DeleteObjectCommand(
      input: Record<string, unknown>,
    ) {
      return { input };
    }),
}));

const awsMocks = jest.requireMock("@aws-sdk/client-s3").__mocks as {
  s3Send: jest.Mock;
  putObjectCommand: jest.Mock;
};

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://storage.example/arquivo"),
}));

type UploadFileComOpcoes = (
  file: MultipartFile,
  options: { allowedMimeTypes: readonly string[] },
) => Promise<{ url: string; key: string; name: string }>;

const configService = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, string> = {
      MINIO_ENDPOINT: "http://minio:9000",
      MINIO_ACCESS_KEY: "access",
      MINIO_SECRET_KEY: "secret",
      MINIO_BUCKET: "essencia-uploads",
    };
    return values[key];
  }),
  get: jest.fn((key: string) => {
    if (key === "MINIO_PUBLIC_ENDPOINT") {
      return "https://www.portalcef.com.br/storage";
    }
    return undefined;
  }),
} as unknown as ConfigService;

function criarArquivoMultipart(
  filename: string,
  mimetype: string,
  buffer: Buffer,
): MultipartFile {
  return {
    filename,
    mimetype,
    toBuffer: jest.fn().mockResolvedValue(buffer),
  } as unknown as MultipartFile;
}

const tiposImagem = ["image/jpeg", "image/png", "image/webp", "image/gif"];

describe("StorageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    awsMocks.s3Send.mockResolvedValue({});
  });

  it("rejeita HTML disfarçado de imagem", async () => {
    const service = new StorageService(configService);
    const uploadFile = service.uploadFile.bind(service) as UploadFileComOpcoes;
    const arquivo = criarArquivoMultipart(
      "ataque.png",
      "image/png",
      Buffer.from("<html><script>alert(1)</script></html>"),
    );

    await expect(
      uploadFile(arquivo, { allowedMimeTypes: tiposImagem }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(awsMocks.s3Send).not.toHaveBeenCalled();
  });

  it("usa MIME real detectado para imagem válida", async () => {
    const service = new StorageService(configService);
    const uploadFile = service.uploadFile.bind(service) as UploadFileComOpcoes;
    const pngMinimo = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const arquivo = criarArquivoMultipart("imagem.png", "text/html", pngMinimo);

    await uploadFile(arquivo, { allowedMimeTypes: tiposImagem });

    expect(awsMocks.putObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ContentType: "image/png",
        ContentDisposition: expect.stringContaining("inline"),
      }),
    );
  });

  it("aceita PNG real mesmo quando metadados textuais contem XML/SVG", async () => {
    const service = new StorageService(configService);
    const uploadFile = service.uploadFile.bind(service) as UploadFileComOpcoes;
    const pngComMetadado = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('tEXtComment\0<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    ]);
    const arquivo = criarArquivoMultipart(
      "chatgpt-image.png",
      "image/png",
      pngComMetadado,
    );

    await uploadFile(arquivo, { allowedMimeTypes: tiposImagem });

    expect(awsMocks.putObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ContentType: "image/png",
      }),
    );
  });

  it("mantem remocao tolerante para consumidores existentes", async () => {
    const service = new StorageService(configService);
    awsMocks.s3Send.mockRejectedValue(new Error("minio indisponivel"));

    await expect(service.deleteFile("arquivo.pdf")).resolves.toBeUndefined();
  });

  it("propaga falha no metodo estrito de remocao", async () => {
    const service = new StorageService(configService);
    awsMocks.s3Send.mockRejectedValue(new Error("minio indisponivel"));

    await expect(service.deleteFileStrict("arquivo.pdf")).rejects.toThrow(
      "minio indisponivel",
    );
  });

  it("aceita PDF em upload de mapa", async () => {
    const service = new StorageService(configService);
    const arquivo = criarArquivoMultipart("planta.pdf", "application/pdf", Buffer.from("%PDF-1.7\n"));
    await service.uploadMap(arquivo);
    expect(awsMocks.putObjectCommand).toHaveBeenCalledWith(expect.objectContaining({ ContentType: "application/pdf" }));
  });

  it("aceita SVG seguro e rejeita SVG ativo", async () => {
    const service = new StorageService(configService);
    await service.uploadMap(criarArquivoMultipart("planta.svg", "image/svg+xml", Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"10\" height=\"10\"/></svg>")));
    await expect(service.uploadMap(criarArquivoMultipart("ataque.svg", "image/svg+xml", Buffer.from("<svg><script>alert(1)</script></svg>")))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejeita MIME incompatível e mapas maiores que 25 MB", async () => {
    const service = new StorageService(configService);
    await expect(service.uploadMap(criarArquivoMultipart("fraude.pdf", "application/pdf", Buffer.from("not a pdf")))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadMap(criarArquivoMultipart("grande.png", "image/png", Buffer.alloc(25 * 1024 * 1024 + 1)))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadMap(criarArquivoMultipart("fraude.svg", "image/svg+xml", Buffer.from("\x89PNG\r\n\x1a\n")))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("aplica a lista de MIME permitidos ao upload de imagem do evento", async () => {
    const service = new StorageService(configService);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    const result = await service.uploadBuffer(
      jpeg,
      "capa.jpg",
      "image/jpeg",
      "eventos/event-1/imagem",
      tiposImagem,
    );

    expect(result.key).toMatch(/^eventos\/event-1\/imagem\/.+\.jpg$/);
  });

  it("rejeita conteúdo HTML no upload de imagem do evento", async () => {
    const service = new StorageService(configService);

    await expect(
      service.uploadBuffer(
        Buffer.from("<html>ataque</html>"),
        "capa.jpg",
        "image/jpeg",
        "eventos/event-1/imagem",
        tiposImagem,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(awsMocks.s3Send).not.toHaveBeenCalled();
  });

  it("remove uma URL pública do bucket convertendo-a em chave", async () => {
    const service = new StorageService(configService);

    await service.deletePublicUrl(
      "https://www.portalcef.com.br/storage/essencia-uploads/eventos/event-1/imagem/capa.jpg",
    );

    expect(awsMocks.s3Send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: "essencia-uploads",
          Key: "eventos/event-1/imagem/capa.jpg",
        },
      }),
    );
  });
});
