import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import { AuthenticatedRequest } from "./auth.guard";

/**
 * TenantGuard ensures users can only access resources within their tenant scope.
 *
 * - Master: Has global access (can access all schools and units)
 * - Diretora Geral: Has school-level access (can access all units in their school)
 * - Other roles: Have unit-level access (can only access their own unit)
 *
 * This guard checks:
 * 1. If user is master, allow all access
 * 2. If a schoolId is in the request params/body, it must match the user's schoolId
 * 3. If user is diretora_geral, allow school-wide access
 * 4. If a unitId is in the request params/body, it must match user's unitId
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Acesso negado");
    }

    // Master has global access
    if (user.role === "master") {
      return true;
    }

    // Get resource identifiers from request
    const params = request.params as { schoolId?: string; unitId?: string };
    const body = request.body as { schoolId?: string; unitId?: string } | null;
    const resourceSchoolId = params?.schoolId || body?.schoolId;
    const resourceUnitId = params?.unitId || body?.unitId;

    // Verify user can only access their school (required for all non-master roles)
    if (resourceSchoolId && resourceSchoolId !== user.schoolId) {
      throw new ForbiddenException("Acesso negado - escola diferente");
    }

    // Diretora geral has school-level access (can access any unit in their school)
    if (user.role === "diretora_geral") {
      return true;
    }

    // Other roles can only access their own unit
    if (resourceUnitId && resourceUnitId !== user.unitId) {
      throw new ForbiddenException("Acesso negado - unidade diferente");
    }

    return true;
  }
}
