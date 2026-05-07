import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MultipartFile } from "@fastify/multipart";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

export const RASTER_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type UploadFileOptions = {
  allowedMimeTypes?: readonly string[];
};

const SAFE_INLINE_MIME_TYPES = new Set<string>(RASTER_IMAGE_MIME_TYPES);
const SCRIPTABLE_MIME_TYPES = new Set([
  "text/html",
  "image/svg+xml",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
]);

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  /**
   * Codifica o Content-Disposition de forma segura para S3/MinIO.
   * Caracteres não-ASCII (acentos, ç, etc.) causam erro de assinatura
   * no MinIO quando enviados diretamente no header.
   * Usa RFC 5987 (filename*=UTF-8''...) para nomes com caracteres especiais.
   */
  private buildContentDisposition(filename: string, mimetype: string): string {
    const disposition = SAFE_INLINE_MIME_TYPES.has(mimetype)
      ? "inline"
      : "attachment";
    const hasNonAscii = /[^\x20-\x7E]/.test(filename);
    if (!hasNonAscii) {
      return `${disposition}; filename="${filename}"`;
    }
    const encoded = encodeURIComponent(filename);
    return `${disposition}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
  }

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.getOrThrow<string>("MINIO_ENDPOINT");
    const region = "us-east-1"; // MinIO default
    const accessKeyId =
      this.configService.getOrThrow<string>("MINIO_ACCESS_KEY");
    const secretAccessKey =
      this.configService.getOrThrow<string>("MINIO_SECRET_KEY");
    this.bucketName = this.configService.getOrThrow<string>("MINIO_BUCKET");

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true, // Required for MinIO
      // Evita adicionar x-amz-checksum-mode=ENABLED nas presigned URLs de GetObject.
      // O ONLYOFFICE (request-filtering interno) pode alterar a requisição e
      // causar 400/assinatura inválida no MinIO.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private detectMimeType(buffer: Buffer): string | null {
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return "image/png";
    }

    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return "image/jpeg";
    }

    const header6 = buffer.subarray(0, 6).toString("ascii");
    if (header6 === "GIF87a" || header6 === "GIF89a") {
      return "image/gif";
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }

    if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
      return "application/pdf";
    }

    return null;
  }

  private hasActiveTextContent(buffer: Buffer): boolean {
    const prefix = buffer.subarray(0, 1024).toString("utf8").toLowerCase();
    return /<\s*(html|script|svg|iframe|object|embed|!doctype)|<\?xml/.test(
      prefix,
    );
  }

  private resolveUploadMimeType(
    buffer: Buffer,
    declaredMimeType: string,
    allowedMimeTypes?: readonly string[],
  ): string {
    const detectedMimeType = this.detectMimeType(buffer);
    const mimeType = detectedMimeType ?? declaredMimeType;
    const requiresRasterSignature =
      allowedMimeTypes?.every((allowed) =>
        RASTER_IMAGE_MIME_TYPES.includes(
          allowed as (typeof RASTER_IMAGE_MIME_TYPES)[number],
        ),
      ) ?? false;

    if (requiresRasterSignature && !detectedMimeType) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message: "Arquivo de imagem inválido",
      });
    }

    if (
      this.hasActiveTextContent(buffer) ||
      (!detectedMimeType && SCRIPTABLE_MIME_TYPES.has(declaredMimeType))
    ) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message: "Tipo de arquivo não permitido",
      });
    }

    if (allowedMimeTypes && !allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message: "Tipo de arquivo não permitido",
      });
    }

    return mimeType;
  }

  async uploadFile(
    file: MultipartFile,
    options: UploadFileOptions = {},
  ): Promise<{ url: string; key: string; name: string }> {
    const fileId = randomUUID();
    const extension = extname(file.filename);
    const key = `${fileId}${extension}`;

    try {
      const buffer = await file.toBuffer();
      const mimetype = this.resolveUploadMimeType(
        buffer,
        file.mimetype,
        options.allowedMimeTypes,
      );

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          ContentDisposition: this.buildContentDisposition(
            file.filename,
            mimetype,
          ),
        }),
      );

      // Construct public URL
      // Use MINIO_PUBLIC_ENDPOINT if available, otherwise fallback to internal endpoint
      const publicEndpoint = this.configService.get<string>(
        "MINIO_PUBLIC_ENDPOINT",
      );
      const endpoint =
        publicEndpoint || this.configService.get<string>("MINIO_ENDPOINT");

      // Ensure no double slashes if endpoint has trailing slash or if we just concat
      // But typically config values are without trailing slash
      const url = `${endpoint}/${this.bucketName}/${key}`;

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        url,
        key,
        name: file.filename,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error uploading file: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Error uploading file: ${String(error)}`);
      }
      throw error;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    prefix: string = "",
  ): Promise<{ url: string; key: string; name: string }> {
    const fileId = randomUUID();
    const ext = extname(filename);
    const key = prefix ? `${prefix}/${fileId}${ext}` : `${fileId}${ext}`;

    try {
      const resolvedMimeType = this.resolveUploadMimeType(buffer, mimetype);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: resolvedMimeType,
          ContentDisposition: this.buildContentDisposition(
            filename,
            resolvedMimeType,
          ),
        }),
      );

      const publicEndpoint = this.configService.get<string>(
        "MINIO_PUBLIC_ENDPOINT",
      );
      const endpoint =
        publicEndpoint || this.configService.get<string>("MINIO_ENDPOINT");

      const url = `${endpoint}/${this.bucketName}/${key}`;

      this.logger.log(`Buffer uploaded successfully: ${key}`);

      return {
        url,
        key,
        name: filename,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error uploading buffer: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Error uploading buffer: ${String(error)}`);
      }
      throw error;
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getObject(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return this.s3Client.send(command);
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao remover ${key} do MinIO: ${mensagem}`);
    }
  }

  async replaceFile(
    key: string,
    buffer: Buffer,
    mimetype: string,
    filename: string,
  ): Promise<void> {
    try {
      const resolvedMimeType = this.resolveUploadMimeType(buffer, mimetype);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: resolvedMimeType,
          ContentDisposition: this.buildContentDisposition(
            filename,
            resolvedMimeType,
          ),
        }),
      );
      this.logger.log(`File replaced successfully: ${key}`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error replacing file: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Error replacing file: ${String(error)}`);
      }
      throw error;
    }
  }
}
