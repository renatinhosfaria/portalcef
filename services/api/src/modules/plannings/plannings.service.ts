import { and, asc, eq, getDb, sql } from "@essencia/db";
import * as schema from "@essencia/db/schema";
import {
  educationStages,
  planningContents,
  planningReviews,
  plannings,
  planoAula,
  turmas,
  users,
  type Planning,
  type Turma,
} from "@essencia/db/schema";
import type { EducationStageCode } from "@essencia/shared/types";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { CalendarService } from "../calendar/calendar.service";

/**
 * Representação de um arquivo anexado ao planejamento
 */
export interface FileAttachment {
  url: string;
  key: string;
  name: string;
}

export interface UserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

/**
 * Roles que podem acessar todos os dados (sem filtro de unidade)
 */
const GLOBAL_ACCESS_ROLES = ["master"];

/**
 * Roles que podem acessar todos os dados da escola (sem filtro de unidade)
 */
const SCHOOL_ACCESS_ROLES = ["diretora_geral"];

/**
 * Verifica se o usuário tem acesso global (todas as escolas)
 */
const hasGlobalAccess = (role: string): boolean =>
  GLOBAL_ACCESS_ROLES.includes(role);

/**
 * Verifica se o usuário tem acesso a toda a escola (todas as unidades)
 */
const hasSchoolAccess = (role: string): boolean =>
  SCHOOL_ACCESS_ROLES.includes(role) || hasGlobalAccess(role);

export interface SaveDraftInput {
  userId: string;
  turma: string;
  quinzena: string;
  stageId: string | null;
  objetivos?: string;
  metodologia?: string;
  recursos?: string;
  atividades?: string; // Mantido para compatibilidade, mas não usado no wizard novo

  // Novos campos
  materia?: string;
  tema?: string;
  habilidades?: string;
  conteudos?: string;
  avaliacao?: string;
  reforco?: string;
  anexos?: FileAttachment[];
}

export interface SaveDraftResult {
  success: boolean;
  data?: Planning;
  error?: string;
  warning?: string; // Aviso sobre dias letivos (não bloqueia)
}

export interface SubmitPlanningInput {
  userId: string;
  turma: string;
  quinzena: string;
  stageId: string | null;
  objetivos?: string;
  metodologia?: string;
  recursos?: string;

  // Novos campos
  materia?: string;
  tema?: string;
  habilidades?: string;
  conteudos?: string;
  avaliacao?: string;
  reforco?: string;
  anexos?: FileAttachment[];
}

export interface SubmitPlanningResult {
  success: boolean;
  data?: Planning;
  error?: string;
}

type Db = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

const normalizeStageCode = (value: string): EducationStageCode | null => {
  const normalized = value.trim().toUpperCase();

  if (normalized === "BERCARIO") return "BERCARIO";
  if (normalized === "INFANTIL") return "INFANTIL";
  if (normalized === "FUNDAMENTAL_I") return "FUNDAMENTAL_I";
  if (normalized === "FUNDAMENTAL_II") return "FUNDAMENTAL_II";
  if (normalized === "MEDIO") return "MEDIO";

  // Backwards compatibility: "fundamental" maps to FUNDAMENTAL_I
  if (normalized === "FUNDAMENTAL") return "FUNDAMENTAL_I";

  return null;
};

@Injectable()
export class PlanningsService {
  constructor(private readonly calendarService: CalendarService) {}

  /**
   * Salva ou atualiza um rascunho de planejamento.
   * UPSERT baseado na chave única (userId, turmaId, quinzena).
   * Retorna warning se a quinzena não tiver dias letivos (mas não bloqueia).
   */
  async saveDraft(
    input: SaveDraftInput,
    unitId?: string,
  ): Promise<SaveDraftResult> {
    const db = getDb();

    // Validar dias letivos da quinzena (apenas warning, não bloqueia)
    let schoolDaysWarning: string | undefined;
    if (input.quinzena && unitId) {
      const validation = await this.calendarService.validateQuinzenaSchoolDays(
        unitId,
        input.quinzena,
      );
      if (!validation.isValid) {
        schoolDaysWarning = validation.message;
      }
    }

    try {
      const result = await db.transaction(async (tx: DbTransaction) => {
        // UPSERT Planning
        const [planning] = await tx
          .insert(plannings)
          .values({
            userId: input.userId,
            turmaId: input.turma,
            quinzena: input.quinzena,
            stageId: input.stageId,
            status: "RASCUNHO",
          })
          .onConflictDoUpdate({
            target: [plannings.userId, plannings.turmaId, plannings.quinzena],
            set: {
              stageId: input.stageId,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!planning) {
          throw new Error("Falha ao criar/atualizar registro de planejamento");
        }

        // UPSERT Content
        await tx
          .insert(planningContents)
          .values({
            planningId: planning.id,
            objetivos: input.objetivos,
            metodologia: input.metodologia,
            recursos: input.recursos,
            atividades: input.atividades,
            materia: input.materia,
            tema: input.tema,
            habilidades: input.habilidades,
            conteudos: input.conteudos,
            avaliacao: input.avaliacao,
            reforco: input.reforco,
            anexos: input.anexos,
          })
          .onConflictDoUpdate({
            target: [planningContents.planningId],
            set: {
              objetivos: input.objetivos,
              metodologia: input.metodologia,
              recursos: input.recursos,
              atividades: input.atividades,
              materia: input.materia,
              tema: input.tema,
              habilidades: input.habilidades,
              conteudos: input.conteudos,
              avaliacao: input.avaliacao,
              reforco: input.reforco,
              anexos: input.anexos,
              updatedAt: new Date(),
            },
          });

        return planning;
      });

      return { success: true, data: result, warning: schoolDaysWarning };
    } catch (error) {
      console.error("saveDraft error:", error);
      return { success: false, error: "Erro interno ao salvar rascunho" };
    }
  }

  /**
   * Submete o planejamento para coordenação.
   * Atualiza status para PENDENTE e registra submitted_at.
   * BLOQUEIA se a quinzena não tiver dias letivos.
   * Story 3.5 - Envio para Coordenação
   */
  async submitPlanning(
    input: SubmitPlanningInput,
    unitId?: string,
  ): Promise<SubmitPlanningResult> {
    // BLOQUEIA se a quinzena não tiver dias letivos
    if (input.quinzena && unitId) {
      const validation = await this.calendarService.validateQuinzenaSchoolDays(
        unitId,
        input.quinzena,
      );
      if (!validation.isValid) {
        return {
          success: false,
          error: `Não é possível submeter planejamento: ${validation.message}`,
        };
      }
    }

    console.log(
      "[submitPlanning] Iniciando submissão:",
      JSON.stringify(input, null, 2),
    );
    const db = getDb();

    try {
      const result = await db.transaction(async (tx: DbTransaction) => {
        // Primeiro, garantir que o planning existe com os dados mais recentes
        const [planning] = await tx
          .insert(plannings)
          .values({
            userId: input.userId,
            turmaId: input.turma,
            quinzena: input.quinzena,
            stageId: input.stageId,
            status: "PENDENTE",
            submittedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [plannings.userId, plannings.turmaId, plannings.quinzena],
            set: {
              status: "PENDENTE",
              submittedAt: new Date(),
              stageId: input.stageId,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!planning) {
          throw new Error("Falha ao submeter planejamento");
        }

        // Atualizar/criar o conteúdo
        await tx
          .insert(planningContents)
          .values({
            planningId: planning.id,
            objetivos: input.objetivos,
            metodologia: input.metodologia,
            recursos: input.recursos,
            materia: input.materia,
            tema: input.tema,
            habilidades: input.habilidades,
            conteudos: input.conteudos,
            avaliacao: input.avaliacao,
            reforco: input.reforco,
            anexos: input.anexos,
          })
          .onConflictDoUpdate({
            target: [planningContents.planningId],
            set: {
              objetivos: input.objetivos,
              metodologia: input.metodologia,
              recursos: input.recursos,
              materia: input.materia,
              tema: input.tema,
              habilidades: input.habilidades,
              conteudos: input.conteudos,
              avaliacao: input.avaliacao,
              reforco: input.reforco,
              anexos: input.anexos,
              updatedAt: new Date(),
            },
          });

        return planning;
      });

      return { success: true, data: result };
    } catch (error) {
      console.error("submitPlanning error:", error);
      return { success: false, error: "Erro interno ao submeter planejamento" };
    }
  }

  /**
   * Busca planejamentos pendentes por segmento (para coordenadoras).
   * Story 4.1 - Lista de Planejamentos por Segmento
   * Filtrado por tenant (schoolId/unitId) conforme RBAC
   */
  async getPlanningsBySegment(
    user: UserContext,
    segment: string,
  ): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      professorName: string;
      turma: string;
      quinzena: string;
      status: string;
      submittedAt: Date | null;
    }>;
    error?: string;
  }> {
    const db = getDb();

    try {
      const stageCode = normalizeStageCode(segment);
      if (!stageCode) {
        return { success: false, error: "Etapa invalida" };
      }

      // Construir condições de filtro incluindo tenant
      const conditions = [
        eq(plannings.status, "PENDENTE"),
        eq(educationStages.code, stageCode),
      ];

      // Aplicar filtro de tenant baseado no role
      if (!hasGlobalAccess(user.role)) {
        if (user.schoolId) {
          conditions.push(eq(users.schoolId, user.schoolId));
        }
        // Se não tem acesso a toda escola, filtrar por unidade
        if (!hasSchoolAccess(user.role) && user.unitId) {
          conditions.push(eq(users.unitId, user.unitId));
        }
      }

      // Buscar planejamentos pendentes com join para obter nome do professor
      type PlanningBySegmentRow = {
        id: string;
        turma: string;
        quinzena: string;
        status: string;
        submittedAt: Date | null;
        professorName: string;
      };

      const result: PlanningBySegmentRow[] = await db
        .select({
          id: plannings.id,
          turma: plannings.turmaId,
          quinzena: plannings.quinzena,
          status: plannings.status,
          submittedAt: plannings.submittedAt,
          professorName: users.name,
        })
        .from(plannings)
        .innerJoin(users, eq(plannings.userId, users.id))
        .innerJoin(educationStages, eq(plannings.stageId, educationStages.id))
        .where(and(...conditions))
        .orderBy(asc(plannings.submittedAt)); // FIFO: mais antigos primeiro (urgência)

      return {
        success: true,
        data: result.map((r) => ({
          id: r.id,
          professorName: r.professorName,
          turma: r.turma,
          quinzena: r.quinzena,
          status: r.status,
          submittedAt: r.submittedAt,
        })),
      };
    } catch (error) {
      console.error("getPlanningsBySegment error:", error);
      return { success: false, error: "Erro ao buscar planejamentos" };
    }
  }

  /**
   * Busca dados consolidados para o dashboard.
   * Story 5.1, 5.4 - Dashboard com indicadores semafóricos e visão global
   * Filtrado por tenant (schoolId/unitId) conforme RBAC
   */
  async getDashboardData(
    user: UserContext,
    segment?: string,
  ): Promise<{
    success: boolean;
    data?: {
      teachers: Array<{
        id: string;
        name: string;
        turma: string;
        segment: string;
        planningId: string | null;
        planningStatus: string | null;
        submittedAt: Date | null;
        updatedAt: Date | null;
      }>;
      currentQuinzena: string;
      deadline: Date;
    };
    error?: string;
  }> {
    const db = getDb();

    try {
      const stageFilter = segment ? normalizeStageCode(segment) : null;
      if (segment && !stageFilter) {
        return { success: false, error: "Etapa invalida" };
      }

      // Buscar todos os professores com seus planejamentos da quinzena atual
      const currentQuinzena = this.getCurrentQuinzena();

      // Deadline padrão: sexta-feira 23:59 da quinzena
      const deadline = new Date();
      deadline.setDate(
        deadline.getDate() + ((5 - deadline.getDay() + 7) % 7) || 7,
      );
      deadline.setHours(23, 59, 59, 999);

      // Construir condições de filtro incluindo tenant
      const conditions = [eq(users.role, "professora")];

      // Aplicar filtro de tenant baseado no role
      if (!hasGlobalAccess(user.role)) {
        if (user.schoolId) {
          conditions.push(eq(users.schoolId, user.schoolId));
        }
        // Se não tem acesso a toda escola, filtrar por unidade
        if (!hasSchoolAccess(user.role) && user.unitId) {
          conditions.push(eq(users.unitId, user.unitId));
        }
      }

      // Buscar professores com plannings
      type TeacherPlanningRow = {
        userId: string;
        userName: string;
        userRole: string;
        stageCode: string | null;
        planningId: string | null;
        turma: string | null;
        planningStatus: string | null;
        submittedAt: Date | null;
        updatedAt: Date | null;
      };

      type TeacherPlanning = {
        id: string;
        name: string;
        turma: string;
        segment: string;
        planningId: string | null;
        planningStatus: string | null;
        submittedAt: Date | null;
        updatedAt: Date | null;
      };

      const result: TeacherPlanningRow[] = await db
        .select({
          userId: users.id,
          userName: users.name,
          userRole: users.role,
          stageCode: educationStages.code,
          planningId: plannings.id,
          turma: plannings.turmaId,
          planningStatus: plannings.status,
          submittedAt: plannings.submittedAt,
          updatedAt: plannings.updatedAt,
        })
        .from(users)
        .leftJoin(educationStages, eq(users.stageId, educationStages.id))
        .leftJoin(
          plannings,
          and(
            eq(users.id, plannings.userId),
            eq(plannings.quinzena, currentQuinzena),
          ),
        )
        .where(and(...conditions));

      const teachers: TeacherPlanning[] = result.map((r) => {
        const turma = r.turma || "Sem turma";
        const teacherStage = r.stageCode || "SEM_ETAPA";

        return {
          id: r.userId,
          name: r.userName,
          turma,
          segment: teacherStage,
          planningId: r.planningId,
          planningStatus: r.planningStatus,
          submittedAt: r.submittedAt,
          updatedAt: r.updatedAt,
        };
      });

      const filteredTeachers = teachers.filter(
        (teacher) => !stageFilter || teacher.segment === stageFilter,
      );

      return {
        success: true,
        data: {
          teachers: filteredTeachers,
          currentQuinzena,
          deadline,
        },
      };
    } catch (error) {
      console.error("getDashboardData error:", error);
      return { success: false, error: "Erro ao buscar dados do dashboard" };
    }
  }

  /**
   * TODO: Refatorar para usar API de períodos dinâmicos
   * Retorna o ID da quinzena atual baseada no calendário escolar.
   *
   * TEMPORÁRIO: Retorna string vazia até implementar novo sistema de períodos.
   */
  private getCurrentQuinzena(): string {
    // TODO: Implementar busca de período atual via API /plano-aula-periodo
    // Por enquanto retorna vazio para não quebrar chamadas existentes
    return "";
  }

  /**
   * Busca detalhes de um planejamento pelo ID.
   * Story 4.2 - Visualizador de PDF Integrado
   * Verifica acesso: owner (professora) ou coordenadora/gestão do mesmo tenant
   */
  async getPlanningById(
    user: UserContext,
    planningId: string,
  ): Promise<{
    success: boolean;
    data?: {
      id: string;
      userId: string;
      professorName: string;
      turma: string;
      quinzena: string;
      status: string;
      objetivos?: string | null;
      metodologia?: string | null;
      recursos?: string | null;
      submittedAt: Date | null;
      materia?: string | null;
      tema?: string | null;
      habilidades?: string | null;
      conteudos?: string | null;
      avaliacao?: string | null;
      reforco?: string | null;
      anexos?: FileAttachment[] | null;
    };
    error?: string;
  }> {
    const db = getDb();

    try {
      const result = await db
        .select({
          id: plannings.id,
          userId: plannings.userId,
          turma: plannings.turmaId,
          quinzena: plannings.quinzena,
          status: plannings.status,
          submittedAt: plannings.submittedAt,
          professorName: users.name,
          professorSchoolId: users.schoolId,
          professorUnitId: users.unitId,

          objetivos: planningContents.objetivos,
          metodologia: planningContents.metodologia,
          recursos: planningContents.recursos,
          materia: planningContents.materia,
          tema: planningContents.tema,
          habilidades: planningContents.habilidades,
          conteudos: planningContents.conteudos,
          avaliacao: planningContents.avaliacao,
          reforco: planningContents.reforco,
          anexos: planningContents.anexos,
        })
        .from(plannings)
        .innerJoin(users, eq(plannings.userId, users.id))
        .leftJoin(
          planningContents,
          eq(plannings.id, planningContents.planningId),
        )
        .where(eq(plannings.id, planningId))
        .limit(1);

      if (result.length === 0) {
        return { success: false, error: "Planejamento não encontrado" };
      }

      const r = result[0];

      // Verificar acesso baseado em tenant e ownership
      const isOwner = r.userId === user.userId;
      const isGlobalAccess = hasGlobalAccess(user.role);
      const isSchoolAccess =
        hasSchoolAccess(user.role) && r.professorSchoolId === user.schoolId;
      const isUnitAccess =
        r.professorSchoolId === user.schoolId &&
        r.professorUnitId === user.unitId;

      if (!isOwner && !isGlobalAccess && !isSchoolAccess && !isUnitAccess) {
        throw new ForbiddenException(
          "Acesso negado: você não tem permissão para visualizar este planejamento",
        );
      }

      return {
        success: true,
        data: {
          id: r.id,
          userId: r.userId,
          professorName: r.professorName,
          turma: r.turma,
          quinzena: r.quinzena,
          status: r.status,
          objetivos: r.objetivos,
          metodologia: r.metodologia,
          recursos: r.recursos,
          materia: r.materia,
          tema: r.tema,
          habilidades: r.habilidades,
          conteudos: r.conteudos,
          avaliacao: r.avaliacao,
          reforco: r.reforco,
          anexos: r.anexos,
          submittedAt: r.submittedAt,
        },
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      console.error("getPlanningById error:", error);
      return { success: false, error: "Erro ao buscar planejamento" };
    }
  }

  /**
   * Aprova um planejamento.
   * Story 4.3 - Ação de Aprovar Planejamento
   * Story 5.3 - Calcula e persiste firstPassYield
   */
  async approvePlanning(
    planningId: string,
    reviewerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const db = getDb();

    try {
      await db.transaction(async (tx: DbTransaction) => {
        // Buscar o planning atual para calcular firstPassYield
        const [currentPlanning] = await tx
          .select({ reviewCycles: plannings.reviewCycles })
          .from(plannings)
          .where(eq(plannings.id, planningId))
          .limit(1);

        if (!currentPlanning) {
          throw new Error("Planejamento não encontrado");
        }

        // Calcular firstPassYield: true se aprovado sem nenhum ciclo de revisão
        const firstPassYield = currentPlanning.reviewCycles === 0;

        // Atualizar status do planejamento com firstPassYield e approvedAt
        await tx
          .update(plannings)
          .set({
            status: "APROVADO",
            firstPassYield,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(plannings.id, planningId));

        // Inserir registro de review
        await tx.insert(planningReviews).values({
          planningId,
          reviewerId,
          status: "APROVADO",
          comentario: "Planejamento aprovado",
        });
      });

      return { success: true };
    } catch (error) {
      console.error("approvePlanning error:", error);
      return { success: false, error: "Erro ao aprovar planejamento" };
    }
  }

  /**
   * Solicita ajustes em um planejamento.
   * Story 4.4 - Ação de Solicitar Ajustes com Comentário
   */
  async requestChanges(
    planningId: string,
    reviewerId: string,
    comment: string,
  ): Promise<{ success: boolean; error?: string }> {
    const db = getDb();

    try {
      await db.transaction(async (tx: DbTransaction) => {
        // Atualizar status e incrementar ciclos de review
        await tx
          .update(plannings)
          .set({
            status: "EM_AJUSTE",
            reviewCycles: sql`${plannings.reviewCycles} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(plannings.id, planningId));

        // Inserir registro de review com comentário
        await tx.insert(planningReviews).values({
          planningId,
          reviewerId,
          status: "EM_AJUSTE",
          comentario: comment,
        });
      });

      return { success: true };
    } catch (error) {
      console.error("requestChanges error:", error);
      return { success: false, error: "Erro ao solicitar ajustes" };
    }
  }

  /**
   * Lista turmas disponíveis para o usuário baseado no seu stageId.
   * Task 7 - Turmas dinâmicas para o wizard
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
        ),
        orderBy: [asc(turmas.name)],
      });

      return { success: true, data: turmasData };
    } catch (error) {
      console.error("getTurmas error:", error);
      return { success: false, error: "Erro ao buscar turmas" };
    }
  }

  /**
   * Lista quinzenas disponíveis (atual e próximas) do ano letivo 2026.
   * Task 7 - Quinzenas dinâmicas para o wizard
   *
   * Retorna as próximas 4 quinzenas baseadas no calendário escolar.
   * Durante férias de julho, retorna as quinzenas do 2º semestre.
   * Inclui contagem de dias letivos quando unitId é fornecido.
   *
   * Regra de liberação por aprovação:
   * - Q01: sempre liberada para todas as turmas do usuário
   * - Q02+: liberada apenas para turmas que tiveram Q(N-1) aprovada
   */
  async getQuinzenas(
    _unitId?: string,
    _userId?: string,
  ): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      label: string;
      isCurrent: boolean;
      startDate: string;
      endDate: string;
      deadline: string;
      semester: 1 | 2;
      schoolDaysCount?: number;
      hasSchoolDays?: boolean;
      unlockedTurmaIds: string[];
    }>;
    isVacation?: boolean;
    error?: string;
  }> {
    try {
      // TODO: Refatorar para buscar períodos da API /plano-aula-periodo
      // Sistema de quinzenas hardcoded removido
      return {
        success: true,
        data: [], // Retorna vazio até implementar novo sistema
        isVacation: false
      };
    } catch (error) {
      console.error("getQuinzenas error:", error);
      return { success: false, error: "Erro ao buscar quinzenas" };
    }
  }

  /**
   * Lista todos os planejamentos do usuário logado, opcionalmente filtrado por quinzena.
   * Usado para exibir os planos de aula na página de detalhes da quinzena.
   */
  async getMyPlannings(
    userId: string,
    quinzena?: string,
  ): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      turma: string;
      quinzena: string;
      status: string;
      materia?: string | null;
      tema?: string | null;
      updatedAt: Date;
    }>;
    error?: string;
  }> {
    const db = getDb();

    try {
      console.log(
        "[getMyPlannings] Buscando planejamentos para userId:",
        userId,
        "quinzena:",
        quinzena,
      );
      const conditions = [eq(plannings.userId, userId)];

      if (quinzena) {
        conditions.push(eq(plannings.quinzena, quinzena));
      }

      type MyPlanningRow = {
        id: string;
        turma: string | null;
        quinzena: string;
        status: string;
        updatedAt: Date;
        materia: string | null;
        tema: string | null;
      };

      const result: MyPlanningRow[] = await db
        .select({
          id: plannings.id,
          turma: turmas.name,
          quinzena: plannings.quinzena,
          status: plannings.status,
          updatedAt: plannings.updatedAt,
          materia: planningContents.materia,
          tema: planningContents.tema,
        })
        .from(plannings)
        .leftJoin(turmas, eq(plannings.turmaId, turmas.code))
        .leftJoin(
          planningContents,
          eq(plannings.id, planningContents.planningId),
        )
        .where(and(...conditions))
        .orderBy(asc(plannings.updatedAt));

      return {
        success: true,
        data: result.map((r: MyPlanningRow) => ({
          id: r.id,
          turma: r.turma || "Turma não encontrada",
          quinzena: r.quinzena,
          status: r.status,
          materia: r.materia,
          tema: r.tema,
          updatedAt: r.updatedAt,
        })),
      };
    } catch (error) {
      console.error("getMyPlannings error:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      return { success: false, error: "Erro ao buscar planejamentos" };
    }
  }

  /**
   * Busca o planejamento atual da professora logada.
   * Task 3 - Endpoint /plannings/me/current
   */
  async getMyCurrentPlanning(userId: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      turma: string;
      quinzena: string;
      status: string;
      objetivos?: string | null;
      metodologia?: string | null;
      recursos?: string | null;
      submittedAt: Date | null;
      updatedAt: Date | null;
      hasDraft: boolean;
    } | null;
    error?: string;
  }> {
    const db = getDb();

    try {
      const currentQuinzena = this.getCurrentQuinzena();

      const result = await db
        .select({
          id: plannings.id,
          turma: plannings.turmaId,
          quinzena: plannings.quinzena,
          status: plannings.status,
          submittedAt: plannings.submittedAt,
          updatedAt: plannings.updatedAt,
          objetivos: planningContents.objetivos,
          metodologia: planningContents.metodologia,
          recursos: planningContents.recursos,
          materia: planningContents.materia,
          tema: planningContents.tema,
          habilidades: planningContents.habilidades,
          conteudos: planningContents.conteudos,
          avaliacao: planningContents.avaliacao,
          reforco: planningContents.reforco,
          anexos: planningContents.anexos,
        })
        .from(plannings)
        .leftJoin(
          planningContents,
          eq(plannings.id, planningContents.planningId),
        )
        .where(
          and(
            eq(plannings.userId, userId),
            eq(plannings.quinzena, currentQuinzena),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return { success: true, data: null };
      }

      const r = result[0];
      return {
        success: true,
        data: {
          id: r.id,
          turma: r.turma,
          quinzena: r.quinzena,
          status: r.status,
          objetivos: r.objetivos,
          metodologia: r.metodologia,
          recursos: r.recursos,
          submittedAt: r.submittedAt,
          updatedAt: r.updatedAt,
          hasDraft: r.status === "RASCUNHO",
        },
      };
    } catch (error) {
      console.error("getMyCurrentPlanning error:", error);
      return { success: false, error: "Erro ao buscar planejamento atual" };
    }
  }

  /**
   * Busca o feedback pendente do planejamento da professora (se status EM_AJUSTE).
   * Task 3 - Endpoint /plannings/me/feedback
   */
  async getMyPendingFeedback(userId: string): Promise<{
    success: boolean;
    data?: {
      planningId: string;
      status: string;
      comment: string;
      reviewerName: string;
      createdAt: Date;
    } | null;
    error?: string;
  }> {
    const db = getDb();

    try {
      const currentQuinzena = this.getCurrentQuinzena();

      // Buscar planejamento atual com status EM_AJUSTE
      const [planning] = await db
        .select({
          id: plannings.id,
          status: plannings.status,
        })
        .from(plannings)
        .where(
          and(
            eq(plannings.userId, userId),
            eq(plannings.quinzena, currentQuinzena),
            eq(plannings.status, "EM_AJUSTE"),
          ),
        )
        .limit(1);

      if (!planning) {
        return { success: true, data: null };
      }

      // Buscar o último review (feedback mais recente)
      const [review] = await db
        .select({
          comment: planningReviews.comentario,
          createdAt: planningReviews.createdAt,
          reviewerName: users.name,
        })
        .from(planningReviews)
        .innerJoin(users, eq(planningReviews.reviewerId, users.id))
        .where(eq(planningReviews.planningId, planning.id))
        .orderBy(sql`${planningReviews.createdAt} DESC`)
        .limit(1);

      if (!review) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          planningId: planning.id,
          status: planning.status,
          comment: review.comment,
          reviewerName: review.reviewerName,
          createdAt: review.createdAt,
        },
      };
    } catch (error) {
      console.error("getMyPendingFeedback error:", error);
      return { success: false, error: "Erro ao buscar feedback" };
    }
  }

  /**
   * Busca o histórico de reviews de um planejamento.
   * Task 4 - Histórico de Reviews
   */
  async getPlanningReviewHistory(
    user: UserContext,
    planningId: string,
  ): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      status: string;
      comment: string;
      reviewerName: string;
      createdAt: Date;
    }>;
    error?: string;
  }> {
    const db = getDb();

    try {
      // Primeiro verificar se o usuário tem acesso ao planejamento
      const planningResult = await this.getPlanningById(user, planningId);
      if (!planningResult.success) {
        return { success: false, error: planningResult.error };
      }

      // Tipo para o resultado da query
      type ReviewRow = {
        id: string;
        status: string;
        comment: string;
        reviewerName: string;
        createdAt: Date;
      };

      // Buscar histórico de reviews
      const reviews: ReviewRow[] = await db
        .select({
          id: planningReviews.id,
          status: planningReviews.status,
          comment: planningReviews.comentario,
          reviewerName: users.name,
          createdAt: planningReviews.createdAt,
        })
        .from(planningReviews)
        .innerJoin(users, eq(planningReviews.reviewerId, users.id))
        .where(eq(planningReviews.planningId, planningId))
        .orderBy(sql`${planningReviews.createdAt} DESC`);

      return {
        success: true,
        data: reviews.map((r: ReviewRow) => ({
          id: r.id,
          status: r.status,
          comment: r.comment,
          reviewerName: r.reviewerName,
          createdAt: r.createdAt,
        })),
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      console.error("getPlanningReviewHistory error:", error);
      return { success: false, error: "Erro ao buscar histórico de reviews" };
    }
  }

  /**
   * Busca um período por ID.
   * Task 9 - Suporte para edição de períodos
   */
  async buscarPorId(periodoId: string) {
    const db = getDb();
    const [periodo] = await db
      .select()
      .from(schema.planoAulaPeriodo)
      .where(eq(schema.planoAulaPeriodo.id, periodoId));

    if (!periodo) {
      throw new BadRequestException("Período não encontrado");
    }
    return periodo;
  }

  /**
   * Conta quantos planos de aula estão vinculados a um período.
   * Task 9 - Suporte para edição controlada de períodos
   */
  private async contarPlanosVinculados(periodoId: string): Promise<number> {
    const db = getDb();
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(planoAula)
      .where(eq(planoAula.planoAulaPeriodoId, periodoId));

    return result?.count || 0;
  }

  /**
   * Edita um período existente com regras de proteção.
   * Task 9 - Edição controlada de períodos
   *
   * Regras:
   * - Descrição pode sempre ser editada
   * - Datas só podem ser editadas se:
   *   - Prazo não expirou OU
   *   - Não há planos vinculados
   */
  async editarPeriodo(
    periodoId: string,
    dto: { descricao?: string; dataInicio?: string; dataFim?: string; dataMaximaEntrega?: string },
  ) {
    const db = getDb();
    const periodo = await this.buscarPorId(periodoId);
    const planosVinculados = await this.contarPlanosVinculados(periodoId);
    const temPlanosVinculados = planosVinculados > 0;
    const agora = new Date();
    const prazoPassou = new Date(periodo.dataMaximaEntrega) < agora;

    // Bloquear edição de datas se prazo passou E há planos vinculados
    if (prazoPassou && temPlanosVinculados) {
      const tentandoEditarDatas =
        dto.dataInicio || dto.dataFim || dto.dataMaximaEntrega;
      if (tentandoEditarDatas) {
        throw new BadRequestException(
          "Não é possível alterar datas de um período com prazo expirado e planos vinculados",
        );
      }
    }

    // Atualizar apenas os campos fornecidos
    const updateData: {
      atualizadoEm: Date;
      descricao?: string;
      dataInicio?: string;
      dataFim?: string;
      dataMaximaEntrega?: string;
    } = { atualizadoEm: new Date() };
    if (dto.descricao !== undefined) updateData.descricao = dto.descricao;
    if (dto.dataInicio) updateData.dataInicio = dto.dataInicio;
    if (dto.dataFim) updateData.dataFim = dto.dataFim;
    if (dto.dataMaximaEntrega) updateData.dataMaximaEntrega = dto.dataMaximaEntrega;

    await db
      .update(schema.planoAulaPeriodo)
      .set(updateData)
      .where(eq(schema.planoAulaPeriodo.id, periodoId));
  }

  /**
   * Renumera períodos após exclusão para manter sequência sem gaps.
   * Task 10 - Suporte para exclusão de períodos
   */
  private async renumerarPeriodosSeNecessario(
    unidadeId: string,
    etapa: string,
  ) {
    const db = getDb();

    // Buscar todos os períodos restantes ordenados por número
    const periodos = await db
      .select()
      .from(schema.planoAulaPeriodo)
      .where(
        and(
          eq(schema.planoAulaPeriodo.unidadeId, unidadeId),
          eq(schema.planoAulaPeriodo.etapa, etapa),
        ),
      )
      .orderBy(asc(schema.planoAulaPeriodo.numero));

    // Renumerar se necessário
    for (let i = 0; i < periodos.length; i++) {
      const numeroEsperado = i + 1;
      if (periodos[i].numero !== numeroEsperado) {
        await db
          .update(schema.planoAulaPeriodo)
          .set({ numero: numeroEsperado, atualizadoEm: new Date() })
          .where(eq(schema.planoAulaPeriodo.id, periodos[i].id));
      }
    }
  }

  /**
   * Exclui um período se não houver planos vinculados.
   * Task 10 - Exclusão protegida de períodos
   *
   * Regras:
   * - Não pode excluir se há planos vinculados
   * - Após exclusão, renumera períodos restantes
   */
  async excluirPeriodo(periodoId: string) {
    const planosVinculados = await this.contarPlanosVinculados(periodoId);

    if (planosVinculados > 0) {
      throw new BadRequestException(
        `Não é possível excluir. ${planosVinculados} professoras já iniciaram este período.`,
      );
    }

    const db = getDb();
    const periodo = await this.buscarPorId(periodoId);

    await db
      .delete(schema.planoAulaPeriodo)
      .where(eq(schema.planoAulaPeriodo.id, periodoId));

    await this.renumerarPeriodosSeNecessario(periodo.unidadeId, periodo.etapa);
  }
}
