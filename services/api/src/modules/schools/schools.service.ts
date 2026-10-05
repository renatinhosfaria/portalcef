import { asc, eq, getDb, or, sql } from "@essencia/db";
import { schools, type NewSchool, type School } from "@essencia/db/schema";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

@Injectable()
export class SchoolsService {
  async findAllWithUnitCounts(): Promise<
    Array<School & { unitsCount: number }>
  > {
    const db = getDb();
    const [schoolsList, unitsList] = (await Promise.all([
      db.query.schools.findMany({
        orderBy: [asc(schools.name)],
      }),
      db.query.units.findMany({
        columns: { schoolId: true },
      }),
    ])) as [School[], Array<{ schoolId: string }>];

    const unitsBySchool = new Map<string, number>();
    for (const unit of unitsList) {
      unitsBySchool.set(
        unit.schoolId,
        (unitsBySchool.get(unit.schoolId) ?? 0) + 1,
      );
    }

    return schoolsList.map((school) => ({
      ...school,
      unitsCount: unitsBySchool.get(school.id) ?? 0,
    }));
  }

  async findAll(): Promise<School[]> {
    const db = getDb();
    return db.query.schools.findMany({
      orderBy: [asc(schools.name)],
    });
  }

  async findById(id: string): Promise<School | null> {
    const db = getDb();
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, id),
    });
    return school ?? null;
  }

  async findByIds(ids: string[]): Promise<School[]> {
    const db = getDb();
    if (!ids || ids.length === 0) return [];
    return db.query.schools.findMany({
      where: or(...ids.map((id) => eq(schools.id, id))),
      orderBy: [asc(schools.name)],
    });
  }

  async findByCode(code: string): Promise<School | null> {
    const db = getDb();
    const school = await db.query.schools.findFirst({
      where: eq(schools.code, code),
    });
    return school ?? null;
  }

  async create(data: { name: string; code: string }): Promise<School> {
    const db = getDb();

    // Check if code already exists
    const existing = await this.findByCode(data.code);
    if (existing) {
      throw new ConflictException("Codigo de escola ja existe");
    }

    const newSchool: NewSchool = {
      name: data.name,
      code: data.code,
    };

    const [created] = await db.insert(schools).values(newSchool).returning();

    return created;
  }

  async update(
    id: string,
    data: Partial<{ name: string; code: string }>,
  ): Promise<School> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Escola nao encontrada");
    }

    // Check if new code conflicts
    if (data.code && data.code !== existing.code) {
      const codeExists = await this.findByCode(data.code);
      if (codeExists) {
        throw new ConflictException("Codigo de escola ja existe");
      }
    }

    const [updated] = await db
      .update(schools)
      .set({ ...data, updatedAt: new Date() })
      .where(sql`${schools.id} = ${id}`)
      .returning();

    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Escola nao encontrada");
    }

    try {
      await db.delete(schools).where(sql`${schools.id} = ${id}`);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
      ) {
        throw new ConflictException(
          "Não é possível excluir a escola enquanto houver unidades ou usuários vinculados",
        );
      }
      throw error;
    }
  }
}
