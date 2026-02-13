import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
          ContentDisposition: `inline; filename="${file.filename}"`,
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
}
