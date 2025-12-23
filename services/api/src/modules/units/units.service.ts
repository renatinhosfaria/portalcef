import { getDb, sql } from "@essencia/db";
import { units, type NewUnit, type Unit } from "@essencia/db/schema";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

@Injectable()
export class UnitsService {
  async findBySchool(schoolId: string): Promise<Unit[]> {
    const db = getDb();
    return db.query.units.findMany({
      where: (fields, { eq }) => eq(fields.schoolId, schoolId),
      orderBy: (units, { asc }) => [asc(units.name)],
    });
  }

  async findById(id: string): Promise<Unit | null> {
    const db = getDb();
    const unit = await db.query.units.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
    });
    return unit ?? null;
  }

  async findBySchoolAndCode(
    schoolId: string,
    code: string,
  ): Promise<Unit | null> {
    const db = getDb();
    const unit = await db.query.units.findFirst({
      where: (fields, { eq, and }) =>
        and(eq(fields.schoolId, schoolId), eq(fields.code, code)),
    });
    return unit ?? null;
  }

  async create(data: {
    schoolId: string;
    name: string;
    code: string;
    address?: string;
  }): Promise<Unit> {
    const db = getDb();

    // Check if code already exists in this school
    const existing = await this.findBySchoolAndCode(data.schoolId, data.code);
    if (existing) {
      throw new ConflictException("Codigo de unidade ja existe nesta escola");
    }

    const newUnit: NewUnit = {
      schoolId: data.schoolId,
      name: data.name,
      code: data.code,
      address: data.address ?? null,
    };

    const [created] = await db.insert(units).values(newUnit).returning();

    return created;
  }

  async update(
    id: string,
    data: Partial<{ name: string; code: string; address: string }>,
  ): Promise<Unit> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Unidade nao encontrada");
    }

    // Check if new code conflicts
    if (data.code && data.code !== existing.code) {
      const codeExists = await this.findBySchoolAndCode(
        existing.schoolId,
        data.code,
      );
      if (codeExists) {
        throw new ConflictException("Codigo de unidade ja existe nesta escola");
      }
    }

    const [updated] = await db
      .update(units)
      .set({ ...data, updatedAt: new Date() })
      .where(sql`${units.id} = ${id}`)
      .returning();

    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Unidade nao encontrada");
    }

    await db.delete(units).where(sql`${units.id} = ${id}`);
  }
}
