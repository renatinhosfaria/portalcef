import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, getDb, units, type Unit } from "@essencia/db";

export interface TenantScopeUser {
  role: string;
  schoolId: string | null;
  unitId: string | null;
}

@Injectable()
export class TenantScopeService {
  async assertUnitAccess(
    user: TenantScopeUser,
    unitId: string | null | undefined,
  ): Promise<Unit> {
    if (user.role !== "master" && !user.schoolId) {
      throw new ForbiddenException("Usuário sem escola válida");
    }

    if (!unitId) {
      throw new ForbiddenException("Usuário sem unidade válida");
    }

    if (
      user.role !== "master" &&
      user.role !== "diretora_geral" &&
      user.unitId !== unitId
    ) {
      throw new ForbiddenException("Acesso negado - unidade diferente");
    }

    const db = getDb();
    const unit = await db.query.units.findFirst({
      where: eq(units.id, unitId),
    });

    if (!unit) {
      throw new NotFoundException("Unidade não encontrada");
    }

    if (user.role === "master") {
      return unit;
    }

    if (!user.schoolId || unit.schoolId !== user.schoolId) {
      throw new ForbiddenException("Acesso negado - escola diferente");
    }

    return unit;
  }

  async listUnitIdsForSchool(
    schoolId: string | null | undefined,
  ): Promise<string[]> {
    if (!schoolId) {
      throw new ForbiddenException("Usuário sem escola válida");
    }

    const db = getDb();
    const result = await db.query.units.findMany({
      where: eq(units.schoolId, schoolId),
      columns: { id: true },
    });

    return result.map((unit: { id: string }) => unit.id);
  }
}
