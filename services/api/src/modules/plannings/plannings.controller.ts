import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  DashboardQueryDto,
  RequestChangesDto,
  SaveDraftDto,
  SubmitPlanningDto,
} from "./dto";
import {
  PlanningsService,
  SaveDraftResult,
  SubmitPlanningResult,
} from "./plannings.service";

interface UserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

/**
 * PlanningsController
 *
 * NOTA SOBRE TENANTGUARD:
 * Este controller NÃO usa TenantGuard porque o isolamento de tenant é feito
 * via UserContext (userId, schoolId, unitId, stageId da sessão).
 *
 * Os endpoints não recebem schoolId/unitId no body/params - eles usam
 * o contexto do usuário autenticado. O service (PlanningsService) valida
 * o acesso ao tenant em cada método:
 * - getDashboardData: filtra por req.user.schoolId/unitId
 * - getPlanningsBySegment: filtra por req.user.schoolId/unitId
 * - getPlanningById: valida que planning.userId === req.user.userId OU role tem acesso
 * - getTurmas: filtra por req.user.unitId/stageId
 *
 * Isso segue o padrão de "identidade vem da sessão" conforme AGENTS.md.
 */
@Controller("plannings")
export class PlanningsController {
  constructor(private readonly planningsService: PlanningsService) {}

  @Post("draft")
  @UseGuards(AuthGuard)
  async saveDraft(
    @Req()
    req: { user: { userId: string; stageId: string | null; unitId: string | null } },
    @Body() dto: SaveDraftDto,
  ): Promise<SaveDraftResult> {
    return this.planningsService.saveDraft(
      {
        userId: req.user.userId,
        stageId: req.user.stageId,
        turma: dto.turma,
        quinzena: dto.quinzena,
        objetivos: dto.objetivos,
        metodologia: dto.metodologia,
        recursos: dto.recursos,
      },
      req.user.unitId ?? undefined, // Passar unitId para validação de dias letivos
    );
  }

  /**
   * Submete o planejamento para coordenação.
   * Story 3.5 - Envio para Coordenação
   * BLOQUEIA se a quinzena não tiver dias letivos.
   */
  @Post("submit")
  @UseGuards(AuthGuard)
  async submitPlanning(
    @Req()
    req: { user: { userId: string; stageId: string | null; unitId: string | null } },
    @Body() dto: SubmitPlanningDto,
  ): Promise<SubmitPlanningResult> {
    return this.planningsService.submitPlanning(
      {
        userId: req.user.userId,
        stageId: req.user.stageId,
        turma: dto.turma,
        quinzena: dto.quinzena,
        objetivos: dto.objetivos,
        metodologia: dto.metodologia,
        recursos: dto.recursos,
      },
      req.user.unitId ?? undefined, // Passar unitId para validação de dias letivos
    );
  }

  /**
   * Busca dados consolidados para o dashboard.
   * Story 5.1, 5.4 - Dashboard com indicadores semafóricos e visão global
   * Acesso: Gestão (diretora, gerentes, master)
   */
  @Get("dashboard")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    "master",
    "diretora_geral",
    "gerente_unidade",
    "gerente_financeiro",
    "coordenadora_geral",
  )
  async getDashboardData(
    @Req() req: { user: UserContext },
    @Query() query: DashboardQueryDto,
  ) {
    const stage = query.stage ?? query.segment;
    return this.planningsService.getDashboardData(req.user, stage);
  }

  /**
   * Lista planejamentos pendentes por segmento.
   * Story 4.1 - Lista de Planejamentos por Segmento
   * Acesso: Coordenadoras e Analista Pedagógico
   */
  @Get("segment/:segment")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    "master",
    "diretora_geral",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "analista_pedagogico",
  )
  async getPlanningsBySegment(
    @Req() req: { user: UserContext },
    @Param("segment") segment: string,
  ) {
    return this.planningsService.getPlanningsBySegment(req.user, segment);
  }

  /**
   * Lista turmas disponíveis para o usuário.
   * Task 7 - Turmas dinâmicas para o wizard
   * Acesso: Professoras e auxiliares
   */
  @Get("turmas")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("professora", "auxiliar_sala")
  async getTurmas(@Req() req: { user: UserContext }) {
    return this.planningsService.getTurmas(req.user);
  }

  /**
   * Lista quinzenas disponíveis.
   * Task 7 - Quinzenas dinâmicas para o wizard
   * Inclui informação de dias letivos quando unitId está disponível.
   * Acesso: Professoras e auxiliares
   */
  @Get("quinzenas")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("professora", "auxiliar_sala")
  async getQuinzenas(@Req() req: { user: UserContext }) {
    return this.planningsService.getQuinzenas(req.user.unitId ?? undefined);
  }

  /**
   * Lista todos os planejamentos do usuário logado.
   * Aceita filtro opcional por quinzena via query param.
   * Acesso: Professora (owner)
   */
  @Get("me")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("professora", "auxiliar_sala")
  async getMyPlannings(
    @Req() req: { user: UserContext },
    @Query("quinzena") quinzena?: string,
  ) {
    return this.planningsService.getMyPlannings(req.user.userId, quinzena);
  }

  /**
   * Busca o planejamento atual da professora logada.
   * Task 3 - Endpoint para ProfessoraDashboard
   * Acesso: Professora (owner)
   */
  @Get("me/current")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("professora", "auxiliar_sala")
  async getMyCurrentPlanning(@Req() req: { user: UserContext }) {
    return this.planningsService.getMyCurrentPlanning(req.user.userId);
  }

  /**
   * Busca feedback pendente da professora (se status EM_AJUSTE).
   * Task 3 - Endpoint para ProfessoraDashboard
   * Acesso: Professora (owner)
   */
  @Get("me/feedback")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("professora", "auxiliar_sala")
  async getMyPendingFeedback(@Req() req: { user: UserContext }) {
    return this.planningsService.getMyPendingFeedback(req.user.userId);
  }

  /**
   * Busca histórico de reviews de um planejamento.
   * Task 4 - Histórico de Reviews
   * Acesso: Coordenadoras e owner (professora)
   */
  @Get(":id/reviews")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    "master",
    "diretora_geral",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
  )
  async getPlanningReviewHistory(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    return this.planningsService.getPlanningReviewHistory(req.user, id);
  }

  /**
   * Busca detalhes de um planejamento pelo ID.
   * Story 4.2 - Visualizador de PDF Integrado
   * Acesso: Coordenadoras (para revisar) e owner (professora)
   */
  @Get(":id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    "master",
    "diretora_geral",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
  )
  async getPlanningById(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    return this.planningsService.getPlanningById(req.user, id);
  }

  /**
   * Aprova um planejamento.
   * Story 4.3 - Ação de Aprovar Planejamento
   * Acesso: Apenas Coordenadoras (podem aprovar)
   */
  @Post(":id/approve")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    "master",
    "diretora_geral",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
  )
  async approvePlanning(
    @Req() req: { user: { userId: string } },
    @Param("id") id: string,
  ) {
    // Usar userId da sessão como reviewerId para segurança
    return this.planningsService.approvePlanning(id, req.user.userId);
  }

  /**
   * Solicita ajustes em um planejamento.
   * Story 4.4 - Ação de Solicitar Ajustes com Comentário
   * Acesso: Apenas Coordenadoras (podem solicitar ajustes)
   */
  @Post(":id/request-changes")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    "master",
    "diretora_geral",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
  )
  async requestChanges(
    @Req() req: { user: { userId: string } },
    @Param("id") id: string,
    @Body() dto: RequestChangesDto,
  ) {
    // Usar userId da sessão como reviewerId para segurança
    return this.planningsService.requestChanges(
      id,
      req.user.userId,
      dto.comment,
    );
  }
}
