import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";

const statusToErrorCode = (status: number): string => {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "UNPROCESSABLE_ENTITY";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "TOO_MANY_REQUESTS";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "ERROR";
  }
};

const normalizeErrorCode = (value: unknown, status: number): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }
  return statusToErrorCode(status);
};

const normalizeMessage = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value.map(String).join(", ");
  }
  return fallback;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest();

    const fallbackMessage = "Erro interno do servidor";
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = fallbackMessage;
    let code = statusToErrorCode(status);
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === "string") {
        message = normalizeMessage(errorResponse, fallbackMessage);
        code = statusToErrorCode(status);
      } else if (errorResponse && typeof errorResponse === "object") {
        const payload = errorResponse as Record<string, unknown>;
        message = normalizeMessage(payload.message, fallbackMessage);
        if (payload.details && typeof payload.details === "object") {
          details = payload.details as Record<string, unknown>;
        }
        code = normalizeErrorCode(payload.code ?? payload.error, status);
      } else {
        message = normalizeMessage(exception.message, fallbackMessage);
        code = statusToErrorCode(status);
      }
    } else if (
      exception &&
      typeof exception === "object" &&
      "statusCode" in exception
    ) {
      // Erros do Fastify (ex: body vazio com Content-Type json)
      const fastifyError = exception as {
        statusCode: number;
        message?: string;
        code?: string;
      };
      status = fastifyError.statusCode;
      message = normalizeMessage(fastifyError.message, fallbackMessage);
      code = normalizeErrorCode(fastifyError.code, status);
    } else if (exception instanceof Error) {
      message = normalizeMessage(exception.message, fallbackMessage);
      code = statusToErrorCode(status);
    }

    // Log de erros 500 para debugging
    if (status >= 500) {
      console.error("[ApiExceptionFilter] Erro 500:", {
        url: request.url,
        method: request.method,
        code,
        message,
        stack: exception instanceof Error ? exception.stack : "N/A",
      });
    }

    const errorBody = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };

    // Handle Fastify response - use statusCode property and send method
    // This is more reliable than chained methods in edge cases
    if (response && typeof response.send === "function") {
      response.statusCode = status;
      response.send(errorBody);
    } else {
      // Fallback for raw HTTP response
      const rawResponse = response as unknown as {
        statusCode: number;
        end: (body: string) => void;
        setHeader: (name: string, value: string) => void;
      };
      rawResponse.statusCode = status;
      rawResponse.setHeader("Content-Type", "application/json");
      rawResponse.end(JSON.stringify(errorBody));
    }
  }
}
