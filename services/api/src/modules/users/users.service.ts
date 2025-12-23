import { getDb, sql } from "@essencia/db";
import {
  users,
  type NewUser,
  type User,
  type UserRole,
} from "@essencia/db/schema";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";

interface CurrentUser {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
}

@Injectable()
export class UsersService {
  /**
   * Find all users within tenant scope
   * Master: sees all users (global access)
   * Diretora Geral: sees all users in their school
   * Other roles: see only users in their unit
   */
  async findAllByTenant(
    currentUser: CurrentUser,
  ): Promise<Omit<User, "passwordHash">[]> {
    const db = getDb();

    const columns = {
      id: true,
      email: true,
      name: true,
      role: true,
      schoolId: true,
      unitId: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    // Master sees all users (global access)
    if (currentUser.role === "master") {
      return db.query.users.findMany({
        columns,
        orderBy: (users, { asc }) => [asc(users.name)],
      });
    }

    // Diretora geral sees all users in their school
    if (currentUser.role === "diretora_geral" && currentUser.schoolId) {
      return db.query.users.findMany({
        where: (fields, { eq }) => eq(fields.schoolId, currentUser.schoolId!),
        columns,
        orderBy: (users, { asc }) => [asc(users.name)],
      });
    }

    // Other roles see only users in their unit
    if (currentUser.schoolId && currentUser.unitId) {
      return db.query.users.findMany({
        where: (fields, { and, eq }) =>
          and(
            eq(fields.schoolId, currentUser.schoolId!),
            eq(fields.unitId, currentUser.unitId!),
          ),
        columns,
        orderBy: (users, { asc }) => [asc(users.name)],
      });
    }

    // Fallback: return empty array if no valid scope
    return [];
  }

  async findById(id: string): Promise<Omit<User, "passwordHash"> | null> {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.id, id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        unitId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user ?? null;
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    schoolId: string | null;
    unitId: string | null;
  }): Promise<Omit<User, "passwordHash">> {
    const db = getDb();

    // Check if email already exists
    const existing = await db.query.users.findFirst({
      where: (fields, { eq }) => eq(fields.email, data.email),
    });

    if (existing) {
      throw new ConflictException("Email ja esta em uso");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    const newUser: NewUser = {
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role,
      schoolId: data.schoolId,
      unitId: data.unitId,
    };

    const [created] = await db.insert(users).values(newUser).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      schoolId: users.schoolId,
      unitId: users.unitId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

    return created;
  }

  async update(
    id: string,
    data: Partial<{
      email: string;
      name: string;
      role: UserRole;
      schoolId: string | null;
      unitId: string | null;
    }>,
  ): Promise<Omit<User, "passwordHash">> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(sql`${users.id} = ${id}`)
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        schoolId: users.schoolId,
        unitId: users.unitId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    await db.delete(users).where(sql`${users.id} = ${id}`);
  }
}
