import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const bucketName = process.env.MINIO_BUCKET;
const endpoint = process.env.MINIO_ENDPOINT;
const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT ?? endpoint;
const accessKeyId = process.env.MINIO_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_SECRET_KEY;

if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Configuracao do MinIO ausente. Defina MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY e MINIO_BUCKET.",
  );
}

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export async function baixarArquivo(storageKey: string, destino: string) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    }),
  );

  if (!response.Body) {
    throw new Error("Arquivo nao encontrado no storage");
  }

  const bodyStream = response.Body as Readable;
  await pipeline(bodyStream, createWriteStream(destino));
}

export async function enviarPdf(caminho: string) {
  const buffer = await readFile(caminho);
  const key = `${randomUUID()}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    }),
  );

  if (!publicEndpoint) {
    throw new Error("MINIO_PUBLIC_ENDPOINT ou MINIO_ENDPOINT nao definido");
  }

  const url = `${publicEndpoint}/${bucketName}/${key}`;

  return { key, url };
}
