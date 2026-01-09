import { Injectable, NestMiddleware } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";

type ResponseWithHeader = {
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
  raw?: { setHeader?: (name: string, value: string) => void };
};

/**
 * Correlation ID Middleware
 *
 * Adiciona um ID único de correlação a cada request para rastreabilidade.
 *
 * - Se o cliente enviar `x-correlation-id`, usa esse valor
 * - Caso contrário, gera um novo UUID
 * - Adiciona o ID no header de resposta para o cliente
 * - Armazena em `req.correlationId` para uso em logs
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    req: FastifyRequest,
    res: FastifyReply | ResponseWithHeader,
    next: () => void,
  ) {
    const correlationId =
      (req.headers["x-correlation-id"] as string) || randomUUID();

    // Adiciona ao request para uso em logs
    (req as FastifyRequest & { correlationId: string }).correlationId =
      correlationId;

    // Adiciona ao header de resposta
    const response = res as ResponseWithHeader;
    if (typeof response.header === "function") {
      response.header("x-correlation-id", correlationId);
    } else if (typeof response.setHeader === "function") {
      response.setHeader("x-correlation-id", correlationId);
    } else if (response.raw && typeof response.raw.setHeader === "function") {
      response.raw.setHeader("x-correlation-id", correlationId);
    }

    next();
  }
}
