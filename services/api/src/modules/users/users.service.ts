import { and, asc, eq, getDb, sql } from "@essencia/db";
import {
  users as usersTable,
  type NewUser,
  type User,
  type UserRole,
} from "@essencia/db/schema";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { ROLE_HIERARCHY, canManageRole } from "@essencia/shared/roles";
import { stageRequiredRoles } from "@essencia/shared/types";

interface CurrentUser {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
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
      stageId: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    // Get current user's hierarchy level
    const currentUserLevel = ROLE_HIERARCHY[currentUser.role] ?? 999;

    let users: Omit<User, "passwordHash">[] = [];

    // Master sees all users (global access)
    if (currentUser.role === "master") {
      users = await db.query.users.findMany({
        columns,
        orderBy: [asc(usersTable.name)],
      });
    }
    // Diretora geral sees all users in their school
    else if (currentUser.role === "diretora_geral" && currentUser.schoolId) {
      users = await db.query.users.findMany({
        where: eq(usersTable.schoolId, currentUser.schoolId!),
        columns,
        orderBy: [asc(usersTable.name)],
      });
    }
    // Other roles see only users in their unit
    else if (currentUser.schoolId && currentUser.unitId) {
      users = await db.query.users.findMany({
        where: and(
          eq(usersTable.schoolId, currentUser.schoolId!),
          eq(usersTable.unitId, currentUser.unitId!),
        ),
        columns,
        orderBy: [asc(usersTable.name)],
      });
    }

    // Stage-scoped roles only see users in their stage
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      )
    ) {
      users = users.filter((u) => u.stageId === currentUser.stageId);
    }

    // Filter by hierarchy: only show users with equal or lower permissions (higher number)
    return users.filter((u) => {
      const userLevel = ROLE_HIERARCHY[u.role] ?? 999;
      return userLevel >= currentUserLevel;
    });
  }

  async findById(id: string): Promise<Omit<User, "passwordHash"> | null> {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(usersTable.id, id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        unitId: true,
        stageId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user ?? null;
  }

  async create(
    data: {
      email: string;
      password: string;
      name: string;
      role: UserRole;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    },
    currentUser: CurrentUser,
  ): Promise<Omit<User, "passwordHash">> {
    const db = getDb();

    // Hierarchy validation: cannot create user with equal or higher privilege
    if (!canManageRole(currentUser.role, data.role)) {
      throw new ForbiddenException({
        code: "ROLE_HIERARCHY_VIOLATION",
        message: `Você não pode criar usuário com role ${data.role}`,
      });
    }

    // Check if email already exists
    const existing = await db.query.users.findFirst({
      where: eq(usersTable.email, data.email),
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
      stageId: data.stageId,
    };

    const [created] = await db.insert(usersTable).values(newUser).returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      schoolId: usersTable.schoolId,
      unitId: usersTable.unitId,
      stageId: usersTable.stageId,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    });

    return created;
  }

  async update(
    id: string,
    data: Partial<{
      email: string;
      name: string;
      password: string;
      role: UserRole;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    }>,
    currentUser: CurrentUser,
  ): Promise<Omit<User, "passwordHash">> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    // Hierarchy validation: cannot edit user with equal or higher privilege
    if (!canManageRole(currentUser.role, existing.role)) {
      throw new ForbiddenException({
        code: "ROLE_HIERARCHY_VIOLATION",
        message: `Você não pode editar usuário com role ${existing.role}`,
      });
    }

    // If changing role, validate new role is also manageable
    if (data.role && !canManageRole(currentUser.role, data.role)) {
      throw new ForbiddenException({
        code: "ROLE_HIERARCHY_VIOLATION",
        message: `Você não pode promover usuário para role ${data.role}`,
      });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    // Hash password if provided
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      delete updateData.password;
    }

    const [updated] = await db
      .update(usersTable)
      .set(updateData)
      .where(sql`${usersTable.id} = ${id}`)
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        schoolId: usersTable.schoolId,
        unitId: usersTable.unitId,
        stageId: usersTable.stageId,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      });

    return updated;
  }

  async delete(id: string, currentUser: CurrentUser): Promise<void> {
    const db = getDb();

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    // Hierarchy validation: cannot delete user with equal or higher privilege
    if (!canManageRole(currentUser.role, existing.role)) {
      throw new ForbiddenException({
        code: "ROLE_HIERARCHY_VIOLATION",
        message: `Você não pode deletar usuário com role ${existing.role}`,
      });
    }

    await db.delete(usersTable).where(sql`${usersTable.id} = ${id}`);
  }
}
