import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuthenticatedRequest } from "./auth.guard";

// Role hierarchy: lower number = higher permission level
const ROLE_HIERARCHY: Record<string, number> = {
  master: 0,
  diretora_geral: 1,
  gerente_unidade: 2,
  gerente_financeiro: 3,
  coordenadora_geral: 4,
  coordenadora_infantil: 5,
  coordenadora_fundamental: 6,
  analista_pedagogico: 7,
  professora: 8,
  auxiliar_administrativo: 9,
  auxiliar_sala: 10,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Acesso negado");
    }

    // Check if user has any of the required roles
    const hasRole = requiredRoles.includes(user.role);

    // Also check hierarchy: higher roles can access lower role endpoints
    const userLevel = ROLE_HIERARCHY[user.role] ?? 999;
    const hasHigherRole = requiredRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role] ?? 0;
      return userLevel <= requiredLevel;
    });

    if (!hasRole && !hasHigherRole) {
      throw new ForbiddenException("Acesso negado - permissao insuficiente");
    }

    return true;
  }
}
