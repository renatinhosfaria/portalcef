import { eq, getDb, inArray, type Database } from "@essencia/db";
import {
  educationStages,
  schools,
  unitStages,
  units,
  users,
} from "@essencia/db/schema";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  createSchoolProvisioningSchema,
  type CreateSchoolProvisioningInput,
} from "@essencia/shared/schemas";
import * as bcrypt from "bcrypt";

type DbTransaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

@Injectable()
export class SchoolsProvisioningService {
  async create(data: CreateSchoolProvisioningInput) {
    const parsed = createSchoolProvisioningSchema.parse(data);
    const db = getDb();

    const [existingSchool, existingUser] = await Promise.all([
      db.query.schools.findFirst({
        where: eq(schools.code, parsed.school.code),
      }),
      db.query.users.findFirst({
        where: eq(users.email, parsed.director.email),
      }),
    ]);
    if (existingSchool) {
      throw new ConflictException("Código de escola já existe");
    }
    if (existingUser) {
      throw new ConflictException("Email já está em uso");
    }

    if (parsed.stageIds.length > 0) {
      const stages = await db.query.educationStages.findMany({
        where: inArray(educationStages.id, parsed.stageIds),
        columns: { id: true },
      });
      if (stages.length !== parsed.stageIds.length) {
        throw new NotFoundException("Uma ou mais etapas não foram encontradas");
      }
    }

    return db.transaction(async (tx: DbTransaction) => {
      const [school] = await tx
        .insert(schools)
        .values(parsed.school)
        .returning();
      const [unit] = await tx
        .insert(units)
        .values({
          ...parsed.unit,
          schoolId: school.id,
          address: parsed.unit.address ?? null,
        })
        .returning();

      if (parsed.stageIds.length > 0) {
        await tx
          .insert(unitStages)
          .values(
            parsed.stageIds.map((stageId) => ({ unitId: unit.id, stageId })),
          );
      }

      const passwordHash = await bcrypt.hash(parsed.director.password, 12);
      const [director] = await tx
        .insert(users)
        .values({
          email: parsed.director.email,
          passwordHash,
          name: parsed.director.name,
          role: "diretora_geral",
          schoolId: school.id,
          unitId: null,
          stageId: null,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          schoolId: users.schoolId,
          unitId: users.unitId,
          stageId: users.stageId,
        });

      return { school, unit, director };
    });
  }
}
