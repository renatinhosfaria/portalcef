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
});
