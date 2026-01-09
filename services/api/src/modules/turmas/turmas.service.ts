import { and, asc, eq, getDb, inArray } from "@essencia/db";
import {
  turmas,
  units,
  users,
  type Turma,
  type User,
} from "@essencia/db/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateTurmaDto } from "./dto/create-turma.dto";
import { UpdateTurmaDto } from "./dto/update-turma.dto";

@Injectable()
export class TurmasService {
  /**
   * Lista todas as turmas com filtros opcionais
   *
   * @param filters.schoolId - Filtra turmas por escola (via units.schoolId)
   * @param filters.unitId - Filtra turmas por unidade específica
   * @param filters.stageId - Filtra turmas por etapa
   * @param filters.year - Filtra turmas por ano letivo
   */
  async findAll(filters?: {
    schoolId?: string;
    unitId?: string;
    stageId?: string;
    year?: number;
  }): Promise<Turma[]> {
    const db = getDb();

    const conditions = [eq(turmas.isActive, true)];

    // Se filtro por escola, precisamos filtrar via units.schoolId
    // Usamos subquery para pegar turmas de unidades da escola
    if (filters?.schoolId) {
      // Buscar unitIds da escola
      const schoolUnits = await db.query.units.findMany({
        where: eq(units.schoolId, filters.schoolId),
        columns: { id: true },
      });

      const unitIds = schoolUnits.map((u: { id: string }) => u.id);

      // Se escola não tem unidades, retorna vazio
      if (unitIds.length === 0) {
        return [];
      }

      // Adiciona condição: unitId IN (unitIds)
      conditions.push(inArray(turmas.unitId, unitIds));
    }

    if (filters?.unitId) {
      conditions.push(eq(turmas.unitId, filters.unitId));
    }

    if (filters?.stageId) {
      conditions.push(eq(turmas.stageId, filters.stageId));
    }

    if (filters?.year !== undefined) {
      conditions.push(eq(turmas.year, filters.year));
    }

    const turmasData = await db.query.turmas.findMany({
      where: and(...conditions),
      orderBy: [asc(turmas.name)],
      with: {
        professora: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return turmasData;
  }

  /**
   * Busca turma por ID
   */
  async findById(id: string): Promise<Turma | null> {
    const db = getDb();

    return db.query.turmas.findFirst({
      where: eq(turmas.id, id),
    });
  }

  /**
   * Lista turmas de uma unidade específica
   */
  async findByUnit(unitId: string, year?: number): Promise<Turma[]> {
    return this.findAll({ unitId, year });
  }

  /**
   * Lista turmas de uma unidade e etapa específicas
   */
  async findByUnitAndStage(
    unitId: string,
    stageId: string,
    year?: number,
  ): Promise<Turma[]> {
    return this.findAll({ unitId, stageId, year });
  }

  /**
   * Cria nova turma
   * @throws ConflictException se código já existe para a unidade/ano
   */
  async create(data: CreateTurmaDto): Promise<Turma> {
    const db = getDb();

    // Verificar se código já existe para esta unidade e ano
    const existing = await db.query.turmas.findFirst({
      where: and(
        eq(turmas.unitId, data.unitId),
        eq(turmas.code, data.code),
        eq(turmas.year, data.year),
      ),
    });

    if (existing) {
      throw new ConflictException(
        `Turma com código "${data.code}" já existe para esta unidade no ano ${data.year}`,
      );
    }

    const [created] = await db
      .insert(turmas)
      .values({
        unitId: data.unitId,
        stageId: data.stageId,
        name: data.name,
        code: data.code,
        year: data.year,
        shift: data.shift || null,
        capacity: data.capacity || null,
      })
      .returning();

    return created;
  }

  /**
   * Atualiza turma
   * @throws NotFoundException se turma não existe
   * @throws ConflictException se novo código já existe
   */
  async update(id: string, data: UpdateTurmaDto): Promise<Turma> {
    const db = getDb();

    // Verificar se turma existe
    const existing = await db.query.turmas.findFirst({
      where: eq(turmas.id, id),
    });

    if (!existing) {
      throw new NotFoundException("Turma não encontrada");
    }

    // Se mudar código ou ano, verificar conflito
    if (data.code || data.year !== undefined) {
      const newCode = data.code || existing.code;
      const newYear = data.year !== undefined ? data.year : existing.year;

      const conflict = await db.query.turmas.findFirst({
        where: and(
          eq(turmas.unitId, existing.unitId),
          eq(turmas.code, newCode),
          eq(turmas.year, newYear),
          // Exclusão do ID atual para permitir atualização
          // do próprio registro
        ),
      });

      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `Código "${newCode}" já existe para esta unidade no ano ${newYear}`,
        );
      }
    }

    const updateData: Partial<Turma> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.year !== undefined) updateData.year = data.year;
    if (data.shift !== undefined) updateData.shift = data.shift;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;

    const [updated] = await db
      .update(turmas)
      .set(updateData)
      .where(eq(turmas.id, id))
      .returning();

    return updated;
  }

  /**
   * Exclui turma permanentemente do banco de dados
   * @throws NotFoundException se turma não existe
   */
  async delete(id: string): Promise<void> {
    const db = getDb();

    const existing = await db.query.turmas.findFirst({
      where: eq(turmas.id, id),
    });

    if (!existing) {
      throw new NotFoundException("Turma não encontrada");
    }

    await db.delete(turmas).where(eq(turmas.id, id));
  }

  /**
   * Desativa turma (soft delete) - mantido para compatibilidade
   * @throws NotFoundException se turma não existe
   */
  async deactivate(id: string): Promise<void> {
    const db = getDb();

    const existing = await db.query.turmas.findFirst({
      where: eq(turmas.id, id),
    });

    if (!existing) {
      throw new NotFoundException("Turma não encontrada");
    }

    await db
      .update(turmas)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(turmas.id, id));
  }

  /**
   * Atribui professora titular a uma turma
   * @throws NotFoundException se turma ou professora não existe
   * @throws BadRequestException se professora não pertence à mesma unidade/etapa
   */
  async assignProfessora(
    turmaId: string,
    professoraId: string,
  ): Promise<Turma> {
    const db = getDb();

    // Verificar se turma existe
    const turma = await db.query.turmas.findFirst({
      where: eq(turmas.id, turmaId),
    });

    if (!turma) {
      throw new NotFoundException("Turma não encontrada");
    }

    // Verificar se professora existe e tem role "professora"
    const professora = await db.query.users.findFirst({
      where: eq(users.id, professoraId),
    });

    if (!professora) {
      throw new NotFoundException("Professora não encontrada");
    }

    if (professora.role !== "professora") {
      throw new BadRequestException("Usuário selecionado não é professora");
    }

    // Verificar se professora pertence à mesma unidade e etapa
    if (professora.unitId !== turma.unitId) {
      throw new BadRequestException(
        "Professora deve pertencer à mesma unidade da turma",
      );
    }

    if (professora.stageId !== turma.stageId) {
      throw new BadRequestException(
        "Professora deve pertencer à mesma etapa da turma",
      );
    }

    // Atualizar turma com a professora
    const [updated] = await db
      .update(turmas)
      .set({ professoraId, updatedAt: new Date() })
      .where(eq(turmas.id, turmaId))
      .returning();

    return updated;
  }

  /**
   * Remove professora titular de uma turma
   * @throws NotFoundException se turma não existe
   */
  async removeProfessora(turmaId: string): Promise<Turma> {
    const db = getDb();

    const existing = await db.query.turmas.findFirst({
      where: eq(turmas.id, turmaId),
    });

    if (!existing) {
      throw new NotFoundException("Turma não encontrada");
    }

    const [updated] = await db
      .update(turmas)
      .set({ professoraId: null, updatedAt: new Date() })
      .where(eq(turmas.id, turmaId))
      .returning();

    return updated;
  }

  /**
   * Lista professoras disponíveis para atribuição a uma turma
   * (professoras da mesma unidade e etapa)
   * @throws NotFoundException se turma não existe
   */
  async findAvailableProfessoras(
    turmaId: string,
  ): Promise<Omit<User, "passwordHash">[]> {
    const db = getDb();

    const turma = await db.query.turmas.findFirst({
      where: eq(turmas.id, turmaId),
    });

    if (!turma) {
      throw new NotFoundException("Turma não encontrada");
    }

    // Buscar professoras da mesma unidade e etapa
    const professoras = await db.query.users.findMany({
      where: and(
        eq(users.role, "professora"),
        eq(users.unitId, turma.unitId),
        eq(users.stageId, turma.stageId),
      ),
      orderBy: [asc(users.name)],
    });

    // Remover passwordHash das professoras por segurança
    return professoras.map((prof: User) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...professoraSemSenha } = prof;
      return professoraSemSenha;
    });
  }
}
