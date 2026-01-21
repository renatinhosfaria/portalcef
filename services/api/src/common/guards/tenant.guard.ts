import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import { AuthenticatedRequest } from "./auth.guard";
import { stageRequiredRoles, UserRole } from "@essencia/shared/types";

/**
 * Roles com acesso total a todas as etapas da sua unidade.
 * Estes roles NAO sao restringidos por stageId.
 *
 * Inclui:
 * - gerente_unidade: Gestao administrativa com visao completa da unidade
 * - gerente_financeiro: Gestao financeira com visao completa da unidade
 * - coordenadora_geral: Coordenacao geral de todas as etapas
 * - analista_pedagogico: Analise pedagogica de todas as etapas
 */
const FULL_UNIT_ACCESS_ROLES: UserRole[] = [
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "analista_pedagogico",
  "auxiliar_administrativo",
];

/**
 * TenantGuard ensures users can only access resources within their tenant scope.
 *
 * Hierarquia de acesso:
 * - Master: Acesso global (todas as escolas e unidades)
 * - Diretora Geral: Acesso a toda a escola (todas as unidades)
 * - Gerentes + Coordenadora Geral + Analista: Acesso a toda a unidade (todas as etapas)
 * - Coordenadoras de etapa: Acesso a unidade + sua etapa especifica
 * - Professora/Auxiliar: Acesso a unidade + sua etapa especifica
 *
 * Grupos organizacionais:
 * - ADMIN: master
 * - CLIENTES: diretora_geral
 * - ESCOLA_ADMINISTRATIVO: gerente_unidade, gerente_financeiro, auxiliar_administrativo
 * - ESCOLA_PEDAGOGICO: coordenadoras, analista_pedagogico, professora, auxiliar_sala
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
    const params = request.params as {
      schoolId?: string;
      unitId?: string;
      stageId?: string;
    };
    const body = request.body as {
      schoolId?: string;
      unitId?: string;
      stageId?: string;
    } | null;
    const resourceSchoolId = params?.schoolId || body?.schoolId;
    const resourceUnitId = params?.unitId || body?.unitId;
    const resourceStageId = params?.stageId || body?.stageId;

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

    // Roles com acesso total a unidade podem acessar qualquer etapa
    if (FULL_UNIT_ACCESS_ROLES.includes(user.role as UserRole)) {
      return true;
    }

    // Stage-scoped roles can only access their own stage
    if (
      resourceStageId &&
      stageRequiredRoles.includes(
        user.role as (typeof stageRequiredRoles)[number],
      ) &&
      resourceStageId !== user.stageId
    ) {
      throw new ForbiddenException("Acesso negado - etapa diferente");
    }

    return true;
  }
}
