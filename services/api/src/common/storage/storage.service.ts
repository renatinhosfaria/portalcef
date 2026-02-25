import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MultipartFile } from "@fastify/multipart";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

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
  private buildContentDisposition(filename: string): string {
    const hasNonAscii = /[^\x20-\x7E]/.test(filename);
    if (!hasNonAscii) {
      return `inline; filename="${filename}"`;
    }
    const encoded = encodeURIComponent(filename);
    return `inline; filename="${encoded}"; filename*=UTF-8''${encoded}`;
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
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(
    file: MultipartFile,
  ): Promise<{ url: string; key: string; name: string }> {
    const fileId = randomUUID();
    const extension = extname(file.filename);
    const key = `${fileId}${extension}`;

    try {
      const buffer = await file.toBuffer();

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype,
          ContentDisposition: this.buildContentDisposition(file.filename),
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
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          ContentDisposition: this.buildContentDisposition(filename),
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

  async replaceFile(
    key: string,
    buffer: Buffer,
    mimetype: string,
    filename: string,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ContentDisposition: this.buildContentDisposition(filename),
      }),
    );
    this.logger.log(`File replaced successfully: ${key}`);
  }
}
