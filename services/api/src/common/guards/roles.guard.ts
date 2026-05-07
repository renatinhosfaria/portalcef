import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  EXACT_ROLES_KEY,
  ROLES_KEY,
} from "../decorators/roles.decorator";
import { AuthenticatedRequest } from "./auth.guard";

import { ROLE_HIERARCHY } from "@essencia/shared/roles";

// Role hierarchy: lower number = higher permission level
// Imported from shared package

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Pula verificação de roles para rotas marcadas com @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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

    const exactRoles = this.reflector.getAllAndOverride<boolean>(
      EXACT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Verifica se o usuário tem uma das roles declaradas.
    const hasRole = requiredRoles.includes(user.role);

    if (exactRoles) {
      if (!hasRole) {
        throw new ForbiddenException("Acesso negado - permissao insuficiente");
      }

      return true;
    }

    // Mantém a hierarquia global: roles superiores acessam endpoints inferiores.
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
