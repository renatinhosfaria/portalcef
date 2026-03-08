import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import "@fastify/cookie";
import { FastifyRequest } from "fastify";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SessionService } from "../../modules/auth/session.service";

const COOKIE_NAME = "cef_session";

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    role: string;
    schoolId: string | null;
    unitId: string | null;
    stageId: string | null;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private sessionService: SessionService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Pula autenticação para rotas marcadas com @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.cookies?.[COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException("Nao autenticado");
    }

    const session = await this.sessionService.getSession(token);

    if (!session) {
      throw new UnauthorizedException("Sessao expirada");
    }

    // Attach user info to request with tenant context
    (request as AuthenticatedRequest).user = {
      userId: session.userId,
      role: session.role,
      schoolId: session.schoolId,
      unitId: session.unitId,
      stageId: session.stageId ?? null,
    };

    return true;
  }
}
