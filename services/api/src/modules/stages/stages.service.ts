import { and, asc, eq, getDb, inArray, type Database } from "@essencia/db";
import {
  educationStages,
  unitStages,
  type EducationStage,
  type UnitStage,
} from "@essencia/db/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

type DatabaseExecutor = Pick<Database, "query" | "insert" | "update">;

@Injectable()
export class StagesService {
  /**
   * Lista todas as etapas globais (tabela de referencia)
   */
  async findAll(): Promise<EducationStage[]> {
    const db = getDb();
    return db.query.educationStages.findMany({
      orderBy: [asc(educationStages.name)],
    });
  }

  /**
   * Lista as etapas atribuidas a uma unidade especifica
   */
  async findByUnit(unitId: string): Promise<EducationStage[]> {
    const db = getDb();

    // Buscar os IDs das etapas da unidade
    const unitStageRecords = await db.query.unitStages.findMany({
      where: and(eq(unitStages.unitId, unitId), eq(unitStages.isActive, true)),
    });

    if (unitStageRecords.length === 0) {
      return [];
    }

    const stageIds = unitStageRecords.map((us: UnitStage) => us.stageId);

    // Buscar as etapas completas
    return db.query.educationStages.findMany({
      where: inArray(educationStages.id, stageIds),
      orderBy: [asc(educationStages.name)],
    });
  }

  /**
   * Atribui etapas a uma unidade
   * @param unitId ID da unidade
   * @param stageIds IDs das etapas a serem atribuidas
   */
  async assignToUnit(unitId: string, stageIds: string[]): Promise<UnitStage[]> {
    const db = getDb();

    if (!stageIds || stageIds.length === 0) {
      return [];
    }

    this.assertUniqueStageIds(stageIds);

    await this.assertStagesExist(db, stageIds);

    return this.assignToUnitWithDb(db, unitId, stageIds);
  }

  private assertUniqueStageIds(stageIds: string[]) {
    if (new Set(stageIds).size !== stageIds.length) {
      throw new BadRequestException(
        "Uma etapa não pode ser informada mais de uma vez",
      );
    }
  }

  private async assertStagesExist(
    db: DatabaseExecutor,
    stageIds: string[],
  ): Promise<void> {
    const existingStages = await db.query.educationStages.findMany({
      where: inArray(educationStages.id, stageIds),
      columns: { id: true },
    });

    if (existingStages.length !== stageIds.length) {
      throw new NotFoundException("Uma ou mais etapas não foram encontradas");
    }
  }

  private async assignToUnitWithDb(
    db: DatabaseExecutor,
    unitId: string,
    stageIds: string[],
  ): Promise<UnitStage[]> {
    // Inserir ou atualizar (se ja existe, reativar)
    const results: UnitStage[] = [];

    for (const stageId of stageIds) {
      // Verificar se ja existe
      const existing = await db.query.unitStages.findFirst({
        where: and(
          eq(unitStages.unitId, unitId),
          eq(unitStages.stageId, stageId),
        ),
      });

      if (existing) {
        // Se existir mas estiver inativo, reativar
        if (!existing.isActive) {
          const [updated] = await db
            .update(unitStages)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(unitStages.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          results.push(existing);
        }
      } else {
        // Criar novo
        const [created] = await db
          .insert(unitStages)
          .values({ unitId, stageId })
          .returning();
        results.push(created);
      }
    }

    return results;
  }

  /**
   * Remove uma etapa de uma unidade (soft delete - marca como inativo)
   */
  async removeFromUnit(unitId: string, stageId: string): Promise<void> {
    const db = getDb();

    const existing = await db.query.unitStages.findFirst({
      where: and(
        eq(unitStages.unitId, unitId),
        eq(unitStages.stageId, stageId),
      ),
    });

    if (!existing) {
      throw new NotFoundException("Etapa nao esta atribuida a esta unidade");
    }

    await db
      .update(unitStages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(unitStages.id, existing.id));
  }

  /**
   * Substitui todas as etapas de uma unidade
   * Remove as antigas e adiciona as novas
   */
  async replaceUnitStages(
    unitId: string,
    stageIds: string[],
  ): Promise<UnitStage[]> {
    const db = getDb();

    this.assertUniqueStageIds(stageIds);
    if (stageIds.length > 0) {
      await this.assertStagesExist(db, stageIds);
    }

    return db.transaction(async (tx: DatabaseExecutor) => {
      await tx
        .update(unitStages)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(unitStages.unitId, unitId));

      if (stageIds.length === 0) {
        return [];
      }

      return this.assignToUnitWithDb(tx, unitId, stageIds);
    });
  }
}
