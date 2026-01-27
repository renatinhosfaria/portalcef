import { closeDb } from "@essencia/db";
import fastifyCookie, { FastifyCookieOptions } from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { FastifyPluginCallback } from "fastify";

import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { obterOrigensCors } from "./config/cors";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: 50 * 1024 * 1024, // 50MB body limit for file uploads
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades não declaradas no DTO
      forbidNonWhitelisted: true, // Lança erro se propriedades extras forem enviadas
      transform: true, // Transforma payloads em instâncias de DTO
      transformOptions: {
        enableImplicitConversion: true, // Converte tipos automaticamente
      },
    }),
  );

  // Enable global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Register Fastify cookie plugin
  const cookieOptions: FastifyCookieOptions = {
    secret: process.env.COOKIE_SECRET ?? "dev-secret-change-in-production",
  };

  await app.register(
    fastifyCookie as FastifyPluginCallback<FastifyCookieOptions>,
    cookieOptions,
  );

  // Register Fastify multipart plugin
  await app.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 1000000, // Max field value size in bytes (1MB)
      fields: 10, // Max number of non-file fields
      fileSize: 50 * 1024 * 1024, // 50MB max file size
      files: 5, // Max number of file fields
      headerPairs: 2000, // Max number of header key=>value pairs
    },
  });

  // Set global prefix (exclude health check)
  app.setGlobalPrefix("api", {
    exclude: ["/health"],
  });

  // Enable CORS for the frontend apps
  app.enableCors({
    origin: obterOrigensCors(),
    credentials: true, // Allow cookies
  });

  const port = process.env.API_PORT ?? process.env.PORT ?? 3001;
  const host = process.env.API_HOST ?? "0.0.0.0";

  await app.listen(port, host);
  console.log(`API running on http://${host}:${port}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    await closeDb();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap();
