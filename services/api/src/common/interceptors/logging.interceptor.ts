import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { FastifyRequest } from "fastify";

/**
 * Logging Interceptor
 *
 * Loga todas as requisições com correlationId, método, URL, status e tempo de resposta.
 *
 * Eventos logados:
 * - SUCCESS: Requisição bem-sucedida (200-299)
 * - AUTH_FAIL: Erro 401 (não autenticado)
 * - FORBIDDEN: Erro 403 (sem permissão)
 * - VALIDATION_ERROR: Erro 400 (validação)
 * - NOT_FOUND: Erro 404
 * - ERROR_5XX: Erro 500+ (erro interno)
 *
 * Formato de log:
 * {
 *   correlationId: string,
 *   event: string,
 *   method: string,
 *   url: string,
 *   statusCode: number,
 *   responseTime: string,
 *   userId?: string,
 *   role?: string,
 *   error?: { code: string, message: string }
 * }
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<
      FastifyRequest & {
        correlationId?: string;
        user?: { userId: string; role: string };
      }
    >();
    const { method, url } = req;
    const correlationId = req.correlationId || "unknown";
    const now = Date.now();

    // Extrair user da sessão (se existir)
    const user = req.user;

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const statusCode = res.statusCode;

        this.logger.log({
          correlationId,
          event: "SUCCESS",
          method,
          url,
          statusCode,
          responseTime: `${Date.now() - now}ms`,
          userId: user?.userId,
          role: user?.role,
        });
      }),
      catchError((error) => {
        const event = this.getEventType(error);
        const statusCode = error.status || 500;

        this.logger.error({
          correlationId,
          event,
          method,
          url,
          statusCode,
          responseTime: `${Date.now() - now}ms`,
          userId: user?.userId,
          role: user?.role,
          error: {
            code: error.code || "UNKNOWN",
            message: this.sanitizeErrorMessage(error.message),
          },
        });

        throw error;
      }),
    );
  }

  /**
   * Determina o tipo de evento com base no erro
   */
  private getEventType(error: { status?: number }): string {
    const status = error.status || 500;

    if (status === 401) return "AUTH_FAIL";
    if (status === 403) return "FORBIDDEN";
    if (status === 400) return "VALIDATION_ERROR";
    if (status === 404) return "NOT_FOUND";
    if (status >= 500) return "ERROR_5XX";

    return "ERROR";
  }

  /**
   * Sanitiza mensagem de erro para não vazar dados sensíveis
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove tokens, passwords, e outros dados sensíveis
    return message
      .replace(/token[=:]\s*["']?[\w-]+["']?/gi, "token=***")
      .replace(/password[=:]\s*["']?[^\s"']+["']?/gi, "password=***")
      .replace(/email[=:]\s*["']?[^\s"'@]+@[^\s"']+["']?/gi, "email=***");
  }
}
