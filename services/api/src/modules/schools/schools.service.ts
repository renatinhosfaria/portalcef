import { getDb, sql } from "@essencia/db";
import { schools, type NewSchool, type School } from "@essencia/db/schema";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

@Injectable()
export class SchoolsService {
  async findAll(): Promise<School[]> {
    const db = getDb();
    return db.query.schools.findMany({
      orderBy: (schools, { asc }) => [asc(schools.name)],
    });
  }

  async findById(id: string): Promise<School | null> {
    const db = getDb();
    const school = await db.query.schools.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
    });
    return school ?? null;
  }

  async findByCode(code: string): Promise<School | null> {
    const db = getDb();
    const school = await db.query.schools.findFirst({
      where: (fields, { eq }) => eq(fields.code, code),
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

    await db.delete(schools).where(sql`${schools.id} = ${id}`);
  }
}
