import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import "@fastify/cookie";
import { FastifyRequest } from "fastify";

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
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
