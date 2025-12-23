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
    } else if (exception instanceof Error) {
      message = normalizeMessage(exception.message, fallbackMessage);
      code = statusToErrorCode(status);
    }

    response.status(status).send({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    });
  }
}
