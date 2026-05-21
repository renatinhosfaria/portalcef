import { and, asc, eq, getDb } from "@essencia/db";
import { turmas, type Turma } from "@essencia/db/schema";
import { Injectable } from "@nestjs/common";

export interface UserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

@Injectable()
export class PlanningsService {
  /**
   * Lista turmas disponíveis para a professora no escopo da sessão.
   */
  async getTurmas(user: UserContext): Promise<{
    success: boolean;
    data?: Turma[];
    error?: string;
  }> {
    const db = getDb();

    try {
      if (!user.unitId || !user.stageId) {
        return { success: true, data: [] };
      }

      const turmasData = await db.query.turmas.findMany({
        where: and(
          eq(turmas.isActive, true),
          eq(turmas.unitId, user.unitId),
          eq(turmas.stageId, user.stageId),
          eq(turmas.professoraId, user.userId),
        ),
        orderBy: [asc(turmas.name)],
      });

      return { success: true, data: turmasData };
    } catch (error) {
      console.error("getTurmas error:", error);
      return { success: false, error: "Erro ao buscar turmas" };
    }
  }
}
