import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import fastifyCookie, { FastifyCookieOptions } from "@fastify/cookie";
import { closeDb } from "@essencia/db";
import type { FastifyPluginCallback } from "fastify";

import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());

  // Register Fastify cookie plugin
  const cookieOptions: FastifyCookieOptions = {
    secret: process.env.COOKIE_SECRET ?? "dev-secret-change-in-production",
  };

  await app.register(
    fastifyCookie as FastifyPluginCallback<FastifyCookieOptions>,
    cookieOptions,
  );

  // Enable CORS for the frontend apps
  app.enableCors({
    origin: [
      "http://localhost:3000", // home
      "http://localhost:3003", // login
      "http://localhost:3004", // usuarios
    ],
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
