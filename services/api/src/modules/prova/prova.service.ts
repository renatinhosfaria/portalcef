import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import {
  getDb,
  and,
  eq,
  or,
  desc,
  gte,
  lte,
  inArray,
  isNotNull,
  prova,
  provaDocumento,
  provaCiclo,
  turmas,
  users,
  type Prova,
  type ProvaDocumento,
  type PlanoAulaStatus,
} from "@essencia/db";

import { ProvaHistoricoService } from "./prova-historico.service";

import {
  type CreateProvaDto,
  type DevolverProvaDto,
  type ListarProvasGestaoDto,
  PROVA_STATUS_URL_MAP,
  isAnalista,
  isCoordenadora,
  isGestao,
  getSegmentosPermitidos,
} from "./dto/prova.dto";

// ============================================
// Types
// ============================================

/**
 * Contexto do usuário autenticado (vem da sessão)
 */
export interface UserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

/**
 * Prova com documentos (resposta completa)
 */
export interface ProvaComDocumentos extends Prova {
  documentos: ProvaDocumento[];
  user: { id: string; name: string };
  turma: { id: string; name: string; code: string };
}

/**
 * Item do dashboard de status
 */
export interface DashboardItem {
  status: PlanoAulaStatus;
  count: number;
  segmento?: string;
}

// ============================================
// Service
// ============================================

/**
 * ProvaService
 *
 * Implementa o workflow de aprovação de provas:
 * - Professora: cria/submete prova
 * - Analista: revisa/aprova/devolve para professora
 * - Coordenadora: aprova final/devolve para professora ou analista
 * - Gestão: visualiza dashboard
 */
@Injectable()
export class ProvaService {
  constructor(private readonly historicoService: ProvaHistoricoService) {}

  // ============================================
  // Métodos da Professora
  // ============================================

  /**
   * Cria ou busca prova existente para turma/ciclo
   * Se já existe, retorna a prova existente
   */
  async criarProva(user: UserContext, dto: CreateProvaDto): Promise<Prova> {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    // Verificar se turma existe e pertence à unidade do usuário
    const turma = await db.query.turmas.findFirst({
      where: and(eq(turmas.id, dto.turmaId), eq(turmas.unitId, user.unitId)),
    });

    if (!turma) {
      throw new NotFoundException(
        "Turma não encontrada ou não pertence à sua unidade",
      );
    }

    // Verificar se ciclo existe e pertence à unidade
    const ciclo = await db.query.provaCiclo.findFirst({
      where: and(
        eq(provaCiclo.id, dto.cicloId),
        eq(provaCiclo.unidadeId, user.unitId),
      ),
    });

    if (!ciclo) {
      throw new NotFoundException(
        "Ciclo de provas não encontrado ou não pertence à sua unidade",
      );
    }

    // Verificar se já existe prova para esta turma/ciclo
    const existente = await db.query.prova.findFirst({
      where: and(
        eq(prova.userId, user.userId),
        eq(prova.turmaId, dto.turmaId),
        eq(prova.provaCicloId, dto.cicloId),
      ),
    });

    if (existente) {
      return existente;
    }

    // Criar nova prova
    const [novaProva] = await db
      .insert(prova)
      .values({
        userId: user.userId,
        turmaId: dto.turmaId,
        unitId: user.unitId,
        provaCicloId: dto.cicloId,
        status: "RASCUNHO",
      })
      .returning();

    return novaProva;
  }

  /**
   * Busca prova por ID com documentos
   * Valida acesso baseado no role e ownership
   */
  async getProvaById(
    user: UserContext,
    provaId: string,
  ): Promise<ProvaComDocumentos> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
      with: {
        user: true,
        turma: true,
        documentos: true,
      },
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    // Verificar acesso
    const isOwner = provaEncontrada.userId === user.userId;
    const isGestaoUser = isGestao(user.role);
    const isAnalistaUser = isAnalista(user.role);
    const isCoordenadoraUser = isCoordenadora(user.role);
    const isSameUnit = provaEncontrada.unitId === user.unitId;

    // Owner sempre pode ver
    if (isOwner) {
      return this.formatProvaResponse(provaEncontrada);
    }

    // Gestão pode ver todos da unidade
    if (isGestaoUser && isSameUnit) {
      return this.formatProvaResponse(provaEncontrada);
    }

    // Analista pode ver provas da sua unidade
    if (isAnalistaUser && isSameUnit) {
      return this.formatProvaResponse(provaEncontrada);
    }

    // Coordenadora pode ver provas da sua unidade e segmento
    if (isCoordenadoraUser && isSameUnit) {
      const turmaDoProva = await db.query.turmas.findFirst({
        where: eq(turmas.id, provaEncontrada.turmaId),
        with: { stage: true },
      });

      const segmentosPermitidos = getSegmentosPermitidos(user.role);
      if (
        segmentosPermitidos === null ||
        segmentosPermitidos.includes(turmaDoProva?.stage?.code || "")
      ) {
        return this.formatProvaResponse(provaEncontrada);
      }
    }

    throw new ForbiddenException(
      "Você não tem permissão para acessar esta prova",
    );
  }

  /**
   * Submete prova para análise (RASCUNHO -> AGUARDANDO_ANALISTA)
   */
  async submeterProva(user: UserContext, provaId: string): Promise<Prova> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
      with: { documentos: true },
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    if (provaEncontrada.userId !== user.userId) {
      throw new ForbiddenException("Apenas o autor pode submeter a prova");
    }

    // Verificar se tem documentos anexados
    if (!provaEncontrada.documentos || provaEncontrada.documentos.length === 0) {
      throw new BadRequestException(
        "Prova precisa ter pelo menos um documento anexado",
      );
    }

    // Verificar status permite submissão
    const statusPermitidos: PlanoAulaStatus[] = [
      "RASCUNHO",
      "DEVOLVIDO_ANALISTA",
      "DEVOLVIDO_COORDENADORA",
      "RECUPERADO",
    ];
    if (!statusPermitidos.includes(provaEncontrada.status)) {
      throw new BadRequestException(
        `Não é possível submeter prova com status ${provaEncontrada.status}`,
      );
    }

    const novoStatus: PlanoAulaStatus = "AGUARDANDO_ANALISTA";
    const statusAnterior = provaEncontrada.status;

    const [atualizada] = await db
      .update(prova)
      .set({
        status: novoStatus,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(prova.id, provaId))
      .returning();

    // Registrar no histórico
    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      provaId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "SUBMETIDO",
      statusAnterior,
      statusNovo: novoStatus,
    });

    return atualizada;
  }

  /**
   * Recupera prova submetida (AGUARDANDO_ANALISTA -> RECUPERADO)
   * Permite que a professora recupere a prova antes da analista iniciar a análise
   */
  async recuperarProva(user: UserContext, provaId: string): Promise<Prova> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    if (provaEncontrada.userId !== user.userId) {
      throw new ForbiddenException("Apenas o autor pode recuperar a prova");
    }

    if (provaEncontrada.status !== "AGUARDANDO_ANALISTA") {
      throw new ConflictException(
        `Não é possível recuperar prova com status ${provaEncontrada.status}`,
      );
    }

    // Verificar se a analista já iniciou a análise
    // 1. Algum documento com aprovação?
    const documentoAprovado = await db.query.provaDocumento.findFirst({
      where: and(
        eq(provaDocumento.provaId, provaId),
        isNotNull(provaDocumento.approvedBy),
      ),
    });

    if (documentoAprovado) {
      throw new ConflictException(
        "A analista pedagógica já iniciou a análise desta prova. Não é mais possível recuperá-la.",
      );
    }

    const statusAnterior = provaEncontrada.status;

    const [atualizada] = await db
      .update(prova)
      .set({
        status: "RECUPERADO",
        submittedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(prova.id, provaId))
      .returning();

    // Registrar no histórico
    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      provaId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "RECUPERADO",
      statusAnterior,
      statusNovo: "RECUPERADO",
    });

    return atualizada;
  }

  // ============================================
  // Métodos do Analista
  // ============================================

  /**
   * Interface para resumo de provas pendentes
   */
  private mapToProvaSummary(
    provaItem: Prova & {
      user?: { name: string } | null;
      turma?: {
        name: string;
        code: string;
        stage?: { name: string; code: string } | null;
      } | null;
    },
  ) {
    return {
      id: provaItem.id,
      provaCicloId: provaItem.provaCicloId,
      status: provaItem.status,
      submittedAt: provaItem.submittedAt?.toISOString(),
      professorName: provaItem.user?.name ?? "",
      turmaName: provaItem.turma?.name ?? "",
      turmaCode: provaItem.turma?.code ?? "",
      stageCode: provaItem.turma?.stage?.code ?? "",
      stageName: provaItem.turma?.stage?.name ?? "",
    };
  }

  /**
   * Lista provas pendentes para analista
   * Status: AGUARDANDO_ANALISTA ou REVISAO_ANALISTA
   */
  async listarPendentesAnalista(user: UserContext) {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    const provas = await db.query.prova.findMany({
      where: and(
        eq(prova.unitId, user.unitId),
        or(
          eq(prova.status, "AGUARDANDO_ANALISTA"),
          eq(prova.status, "REVISAO_ANALISTA"),
        ),
      ),
      with: {
        user: true,
        turma: {
          with: {
            stage: true,
          },
        },
      },
      orderBy: [desc(prova.submittedAt)],
    });

    return provas.map((p: (typeof provas)[number]) =>
      this.mapToProvaSummary(p),
    );
  }

  /**
   * Aprova prova como analista (-> AGUARDANDO_COORDENADORA)
   */
  async aprovarComoAnalista(
    user: UserContext,
    provaId: string,
  ): Promise<Prova> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    if (provaEncontrada.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode aprovar provas da sua unidade",
      );
    }

    const statusPermitidos: PlanoAulaStatus[] = [
      "AGUARDANDO_ANALISTA",
      "REVISAO_ANALISTA",
    ];
    if (!statusPermitidos.includes(provaEncontrada.status)) {
      throw new BadRequestException(
        `Não é possível aprovar prova com status ${provaEncontrada.status}`,
      );
    }

    const statusAnterior = provaEncontrada.status;

    const [atualizada] = await db
      .update(prova)
      .set({
        status: "AGUARDANDO_COORDENADORA",
        updatedAt: new Date(),
      })
      .where(eq(prova.id, provaId))
      .returning();

    // Registrar no histórico
    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      provaId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "APROVADO_ANALISTA",
      statusAnterior,
      statusNovo: "AGUARDANDO_COORDENADORA",
    });

    return atualizada;
  }

  /**
   * Devolve prova como analista (-> DEVOLVIDO_ANALISTA)
   */
  async devolverComoAnalista(
    user: UserContext,
    provaId: string,
    motivo?: string,
  ): Promise<Prova> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    if (provaEncontrada.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode devolver provas da sua unidade",
      );
    }

    const statusPermitidos: PlanoAulaStatus[] = [
      "AGUARDANDO_ANALISTA",
      "REVISAO_ANALISTA",
    ];
    if (!statusPermitidos.includes(provaEncontrada.status)) {
      throw new BadRequestException(
        `Não é possível devolver prova com status ${provaEncontrada.status}`,
      );
    }

    const statusAnterior = provaEncontrada.status;

    const [atualizada] = await db
      .update(prova)
      .set({
        status: "DEVOLVIDO_ANALISTA",
        updatedAt: new Date(),
      })
      .where(eq(prova.id, provaId))
      .returning();

    // Registrar no histórico
    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      provaId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "DEVOLVIDO_ANALISTA",
      statusAnterior,
      statusNovo: "DEVOLVIDO_ANALISTA",
      detalhes: motivo ? { motivo } : null,
    });

    return atualizada;
  }

  // ============================================
  // Métodos da Coordenadora
  // ============================================

  /**
   * Lista provas pendentes para coordenadora
   * Filtrado por segmento da coordenadora
   */
  async listarPendentesCoordenadora(user: UserContext) {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    // Buscar provas AGUARDANDO_COORDENADORA da unidade
    const provasBase = await db.query.prova.findMany({
      where: and(
        eq(prova.unitId, user.unitId),
        eq(prova.status, "AGUARDANDO_COORDENADORA"),
      ),
      with: {
        user: true,
        turma: {
          with: {
            stage: true,
          },
        },
      },
      orderBy: [desc(prova.submittedAt)],
    });

    // Filtrar por segmento da coordenadora
    const segmentosPermitidos = getSegmentosPermitidos(user.role);

    let provasFiltradas = provasBase;

    if (segmentosPermitidos !== null) {
      type ProvaComTurmaStage = (typeof provasBase)[number];
      provasFiltradas = provasBase.filter((p: ProvaComTurmaStage) => {
        const turmaComStage = p.turma as { stage?: { code: string } };
        return segmentosPermitidos.includes(turmaComStage?.stage?.code || "");
      });
    }

    return provasFiltradas.map((p: (typeof provasFiltradas)[number]) =>
      this.mapToProvaSummary(p),
    );
  }

  /**
   * Aprova prova como coordenadora (-> APROVADO)
   */
  async aprovarComoCoordenadora(
    user: UserContext,
    provaId: string,
  ): Promise<Prova> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
      with: {
        turma: {
          with: { stage: true },
        },
      },
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    if (provaEncontrada.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode aprovar provas da sua unidade",
      );
    }

    // Verificar segmento
    const turmaComStage = provaEncontrada.turma as {
      stage?: { code: string };
    };
    const segmentosPermitidos = getSegmentosPermitidos(user.role);
    if (
      segmentosPermitidos !== null &&
      !segmentosPermitidos.includes(turmaComStage?.stage?.code || "")
    ) {
      throw new ForbiddenException(
        "Você só pode aprovar provas do seu segmento",
      );
    }

    if (provaEncontrada.status !== "AGUARDANDO_COORDENADORA") {
      throw new BadRequestException(
        `Não é possível aprovar prova com status ${provaEncontrada.status}`,
      );
    }

    const statusAnterior = provaEncontrada.status;

    const [atualizada] = await db
      .update(prova)
      .set({
        status: "APROVADO",
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(prova.id, provaId))
      .returning();

    // Registrar no histórico
    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      provaId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "APROVADO_COORDENADORA",
      statusAnterior,
      statusNovo: "APROVADO",
    });

    return atualizada;
  }

  /**
   * Devolve prova como coordenadora
   * Pode devolver para PROFESSORA ou ANALISTA
   */
  async devolverComoCoordenadora(
    user: UserContext,
    provaId: string,
    dto: DevolverProvaDto,
  ): Promise<Prova> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
      with: {
        turma: {
          with: { stage: true },
        },
      },
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    if (provaEncontrada.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode devolver provas da sua unidade",
      );
    }

    // Verificar segmento
    const turmaComStage = provaEncontrada.turma as {
      stage?: { code: string };
    };
    const segmentosPermitidos = getSegmentosPermitidos(user.role);
    if (
      segmentosPermitidos !== null &&
      !segmentosPermitidos.includes(turmaComStage?.stage?.code || "")
    ) {
      throw new ForbiddenException(
        "Você só pode devolver provas do seu segmento",
      );
    }

    if (provaEncontrada.status !== "AGUARDANDO_COORDENADORA") {
      throw new BadRequestException(
        `Não é possível devolver prova com status ${provaEncontrada.status}`,
      );
    }

    const statusAnterior = provaEncontrada.status;

    // Determinar status baseado no destino
    const novoStatus: PlanoAulaStatus =
      dto.destino === "ANALISTA"
        ? "AGUARDANDO_ANALISTA" // Volta para reanálise
        : "DEVOLVIDO_COORDENADORA"; // Volta para professora

    const [atualizada] = await db
      .update(prova)
      .set({
        status: novoStatus,
        updatedAt: new Date(),
      })
      .where(eq(prova.id, provaId))
      .returning();

    // Registrar no histórico
    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      provaId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "DEVOLVIDO_COORDENADORA",
      statusAnterior,
      statusNovo: novoStatus,
      detalhes: {
        destino: dto.destino,
        ...(dto.motivo && { motivo: dto.motivo }),
      },
    });

    return atualizada;
  }

  // ============================================
  // Métodos de Gestão
  // ============================================

  /**
   * Dashboard com estatísticas por status e segmento
   */
  async getDashboard(
    user: UserContext,
    unitId?: string,
    cicloId?: string,
  ): Promise<{
    totais: DashboardItem[];
    porSegmento: Record<string, DashboardItem[]>;
  }> {
    const db = getDb();

    // Determinar unitId a usar (do param ou da sessão)
    const targetUnitId = unitId || user.unitId;
    if (!targetUnitId) {
      throw new BadRequestException("Unidade não especificada");
    }

    // Verificar permissão de acesso à unidade
    if (!isGestao(user.role) && user.unitId !== targetUnitId) {
      throw new ForbiddenException(
        "Você não tem permissão para acessar dados desta unidade",
      );
    }

    // Construir filtro
    const filters = [eq(prova.unitId, targetUnitId)];
    if (cicloId) {
      filters.push(eq(prova.provaCicloId, cicloId));
    }

    // Buscar todas as provas da unidade com turma e stage
    const provas = await db.query.prova.findMany({
      where: and(...filters),
      with: {
        turma: {
          with: { stage: true },
        },
      },
    });

    // Agrupar por status
    const totais: DashboardItem[] = [];
    const statusCount: Record<string, number> = {};

    for (const p of provas) {
      statusCount[p.status] = (statusCount[p.status] || 0) + 1;
    }

    for (const [status, count] of Object.entries(statusCount)) {
      totais.push({ status: status as PlanoAulaStatus, count });
    }

    // Agrupar por segmento
    const porSegmento: Record<string, DashboardItem[]> = {};

    for (const p of provas) {
      const turmaComStage = p.turma as { stage?: { code: string } };
      const segmento = turmaComStage?.stage?.code || "SEM_SEGMENTO";

      if (!porSegmento[segmento]) {
        porSegmento[segmento] = [];
      }

      const existente = porSegmento[segmento].find(
        (item) => item.status === p.status,
      );
      if (existente) {
        existente.count++;
      } else {
        porSegmento[segmento].push({
          status: p.status,
          count: 1,
          segmento,
        });
      }
    }

    return { totais, porSegmento };
  }

  /**
   * Lista provas com filtros e paginação para gestão
   * GET /prova/gestao/listar
   */
  async listarProvasGestao(
    user: UserContext,
    dto: ListarProvasGestaoDto,
  ): Promise<{
    data: Array<{
      id: string;
      professorName: string;
      turmaCode: string;
      turmaName: string;
      segmento: string;
      provaCicloId: string;
      status: PlanoAulaStatus;
      submittedAt: string | null;
      createdAt: string;
      updatedAt: string;
      documentosCount: number;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const db = getDb();

    // Determinar unitId a usar (da sessão)
    const targetUnitId = user.unitId;
    if (!targetUnitId) {
      throw new BadRequestException("Unidade não especificada");
    }

    // Verificar permissão de acesso
    if (!isGestao(user.role)) {
      throw new ForbiddenException(
        "Você não tem permissão para acessar esta listagem",
      );
    }

    // Construir condições de filtro
    const conditions: ReturnType<typeof eq>[] = [
      eq(prova.unitId, targetUnitId),
    ];

    // Filtro por status
    if (dto.status && dto.status !== "todos") {
      const statusDb = PROVA_STATUS_URL_MAP[dto.status];
      if (statusDb && statusDb.length > 0) {
        conditions.push(
          inArray(prova.status, statusDb as PlanoAulaStatus[]),
        );
      }
    }

    // Filtro por ciclo
    if (dto.cicloId) {
      conditions.push(eq(prova.provaCicloId, dto.cicloId));
    }

    // Filtro por data de submissão
    if (dto.dataInicio) {
      conditions.push(gte(prova.submittedAt, new Date(dto.dataInicio)));
    }
    if (dto.dataFim) {
      conditions.push(lte(prova.submittedAt, new Date(dto.dataFim)));
    }

    // Buscar provas com relacionamentos
    const provasBase = await db.query.prova.findMany({
      where: and(...conditions),
      with: {
        user: true,
        turma: {
          with: {
            stage: true,
          },
        },
        documentos: true,
      },
      orderBy: [desc(prova.submittedAt), desc(prova.createdAt)],
    });

    // Tipo para provas com relacionamentos
    type ProvaComRelacoes = (typeof provasBase)[number];

    // Aplicar filtros pós-query
    let provasFiltradas: ProvaComRelacoes[] = provasBase;

    // Filtro por professora (busca parcial no nome)
    if (dto.professora) {
      const termoBusca = dto.professora.toLowerCase();
      provasFiltradas = provasFiltradas.filter((p: ProvaComRelacoes) => {
        const nome = (p.user as { name?: string })?.name || "";
        return nome.toLowerCase().includes(termoBusca);
      });
    }

    // Filtro por segmento
    if (dto.segmentoId) {
      provasFiltradas = provasFiltradas.filter((p: ProvaComRelacoes) => {
        const turmaComStage = p.turma as { stage?: { code: string } };
        return turmaComStage?.stage?.code === dto.segmentoId;
      });
    }

    // Calcular paginação
    const total = provasFiltradas.length;
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Aplicar paginação
    const provasPaginadas = provasFiltradas.slice(offset, offset + limit);

    // Formatar resposta
    const data = provasPaginadas.map((provaItem: ProvaComRelacoes) => {
      const turmaComStage = provaItem.turma as {
        name: string;
        code: string;
        stage?: { name: string; code: string };
      };

      return {
        id: provaItem.id,
        professorName: (provaItem.user as { name: string })?.name || "",
        turmaCode: turmaComStage?.code || "",
        turmaName: turmaComStage?.name || "",
        segmento: turmaComStage?.stage?.name || "",
        provaCicloId: provaItem.provaCicloId,
        status: provaItem.status,
        submittedAt: provaItem.submittedAt?.toISOString() || null,
        createdAt: provaItem.createdAt.toISOString(),
        updatedAt: provaItem.updatedAt.toISOString(),
        documentosCount: (provaItem.documentos as unknown[])?.length || 0,
      };
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Exclui permanentemente uma prova
   * Apenas gestão pode excluir. Cascade remove documentos e histórico.
   */
  async deletarProva(user: UserContext, provaId: string): Promise<void> {
    const db = getDb();

    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    if (provaEncontrada.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode excluir provas da sua unidade",
      );
    }

    await db.delete(prova).where(eq(prova.id, provaId));
  }

  // ============================================
  // Métodos Auxiliares
  // ============================================

  /**
   * Busca nome do usuário por ID
   */
  private async getUserName(userId: string): Promise<string> {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user?.name || "Usuário Desconhecido";
  }

  /**
   * Busca nome do usuário por ID (público para uso no controller)
   */
  async getUserNameById(userId: string): Promise<string> {
    return this.getUserName(userId);
  }

  /**
   * Busca status da prova por ID (para uso no callback)
   */
  async getProvaStatusById(
    provaId: string,
  ): Promise<{ status: string } | null> {
    const db = getDb();
    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
      columns: { status: true },
    });
    return provaEncontrada || null;
  }

  /**
   * Marca documento como tendo comentários (OnlyOffice)
   */
  async marcarTemComentarios(documentoId: string): Promise<void> {
    const db = getDb();
    await db
      .update(provaDocumento)
      .set({ temComentarios: true })
      .where(eq(provaDocumento.id, documentoId));
  }

  /**
   * Formata resposta da prova com documentos
   */
  private formatProvaResponse(
    provaItem: Prova & {
      user: { id: string; name: string };
      turma: { id: string; name: string; code: string };
      documentos?: ProvaDocumento[];
    },
  ): ProvaComDocumentos {
    return {
      ...provaItem,
      user: {
        id: provaItem.user.id,
        name: provaItem.user.name,
      },
      turma: {
        id: provaItem.turma.id,
        name: provaItem.turma.name,
        code: provaItem.turma.code,
      },
      documentos: provaItem.documentos || [],
    };
  }

  /**
   * Lista provas do usuário (para professora ver suas próprias provas)
   */
  async listarMinhasProvas(
    user: UserContext,
    cicloId?: string,
  ): Promise<Prova[]> {
    const db = getDb();

    const conditions = [eq(prova.userId, user.userId)];

    if (cicloId) {
      conditions.push(eq(prova.provaCicloId, cicloId));
    }

    const provas = await db.query.prova.findMany({
      where: and(...conditions),
      with: {
        turma: true,
        documentos: true,
      },
      orderBy: [desc(prova.updatedAt)],
    });

    return provas;
  }

  // ============================================
  // Métodos de Documentos
  // ============================================

  /**
   * Adiciona documento do tipo upload à prova
   */
  async adicionarDocumentoUpload(
    provaId: string,
    dados: {
      tipo: "UPLOAD";
      fileName: string;
      fileKey: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      previewStatus?: "PENDENTE" | "PRONTO" | "ERRO";
    },
  ): Promise<ProvaDocumento> {
    const db = getDb();

    // Verificar se prova existe
    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    const [documento] = await db
      .insert(provaDocumento)
      .values({
        provaId,
        tipo: dados.tipo,
        fileName: dados.fileName,
        storageKey: dados.fileKey,
        url: dados.fileUrl,
        fileSize: dados.fileSize,
        mimeType: dados.mimeType,
        ...(dados.previewStatus && { previewStatus: dados.previewStatus }),
      })
      .returning();

    return documento;
  }

  /**
   * Adiciona documento do tipo link (YouTube) à prova
   */
  async adicionarDocumentoLink(
    provaId: string,
    dados: {
      tipo: "YOUTUBE";
      url: string;
      titulo?: string;
    },
  ): Promise<ProvaDocumento> {
    const db = getDb();

    // Verificar se prova existe
    const provaEncontrada = await db.query.prova.findFirst({
      where: eq(prova.id, provaId),
    });

    if (!provaEncontrada) {
      throw new NotFoundException("Prova não encontrada");
    }

    const [documento] = await db
      .insert(provaDocumento)
      .values({
        provaId,
        tipo: dados.tipo,
        url: dados.url,
        fileName: dados.titulo,
      })
      .returning();

    return documento;
  }

  /**
   * Remove documento de uma prova
   */
  async removerDocumento(provaId: string, documentoId: string): Promise<void> {
    const db = getDb();

    // Verificar se documento existe e pertence à prova
    const documento = await db.query.provaDocumento.findFirst({
      where: and(
        eq(provaDocumento.id, documentoId),
        eq(provaDocumento.provaId, provaId),
      ),
    });

    if (!documento) {
      throw new NotFoundException(
        "Documento não encontrado ou não pertence à prova",
      );
    }

    // Deletar documento
    await db
      .delete(provaDocumento)
      .where(eq(provaDocumento.id, documentoId));
  }

  /**
   * Busca documento por ID, validando que pertence à prova
   */
  async getDocumentoById(provaId: string, documentoId: string) {
    const db = getDb();
    const documento = await db.query.provaDocumento.findFirst({
      where: and(
        eq(provaDocumento.id, documentoId),
        eq(provaDocumento.provaId, provaId),
      ),
    });
    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }
    return documento;
  }

  /**
   * Atualiza campos de um documento (usado pelo callback do OnlyOffice)
   */
  async atualizarDocumento(
    documentoId: string,
    dados: { fileSize?: number; updatedAt?: Date },
  ) {
    const db = getDb();
    await db
      .update(provaDocumento)
      .set(dados)
      .where(eq(provaDocumento.id, documentoId));
  }

  /**
   * Aprova um documento individualmente
   * Apenas analista_pedagogico pode aprovar
   */
  async aprovarDocumento(
    user: UserContext,
    documentoId: string,
  ): Promise<ProvaDocumento> {
    const db = getDb();

    // Verificar se documento existe e usuário tem acesso
    const documento = await db.query.provaDocumento.findFirst({
      where: eq(provaDocumento.id, documentoId),
      with: { prova: true },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    // Verificar acesso à prova
    if (documento.prova.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você não tem permissão para aprovar este documento",
      );
    }

    // Atualizar documento com aprovação
    const [documentoAtualizado] = await db
      .update(provaDocumento)
      .set({
        approvedBy: user.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(provaDocumento.id, documentoId))
      .returning();

    return documentoAtualizado;
  }

  /**
   * Desfaz a aprovação de um documento
   * Qualquer analista_pedagogico da mesma unidade pode desfazer
   */
  async desaprovarDocumento(
    user: UserContext,
    documentoId: string,
  ): Promise<ProvaDocumento> {
    const db = getDb();

    const documento = await db.query.provaDocumento.findFirst({
      where: eq(provaDocumento.id, documentoId),
      with: { prova: true },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    if (documento.prova.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você não tem permissão para desaprovar este documento",
      );
    }

    if (!documento.approvedBy) {
      throw new BadRequestException("Este documento não está aprovado");
    }

    const [documentoAtualizado] = await db
      .update(provaDocumento)
      .set({
        approvedBy: null,
        approvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(provaDocumento.id, documentoId))
      .returning();

    return documentoAtualizado;
  }

  /**
   * Registra impressão de um documento aprovado
   */
  async registrarImpressaoDocumento(
    user: UserContext,
    documentoId: string,
  ): Promise<ProvaDocumento> {
    const db = getDb();

    const documento = await db.query.provaDocumento.findFirst({
      where: eq(provaDocumento.id, documentoId),
      with: {
        prova: {
          columns: {
            status: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    // Reaproveita a validação completa de acesso à prova
    await this.getProvaById(user, documento.provaId);

    if (!documento.approvedBy || !documento.approvedAt) {
      throw new BadRequestException(
        "Somente documentos aprovados podem ser impressos",
      );
    }

    // Documento imprimível precisa ter PDF nativo ou preview convertido disponível
    const possuiPdfNativo =
      documento.mimeType === "application/pdf" && !!documento.url;
    const possuiPdfConvertido =
      documento.previewStatus === "PRONTO" && !!documento.previewUrl;

    if (!possuiPdfNativo && !possuiPdfConvertido) {
      throw new BadRequestException(
        "Documento não possui versão em PDF disponível para impressão",
      );
    }

    const impressoEm = new Date();

    const [documentoAtualizado] = await db
      .update(provaDocumento)
      .set({
        printedBy: user.userId,
        printedAt: impressoEm,
        updatedAt: impressoEm,
      })
      .where(eq(provaDocumento.id, documentoId))
      .returning();

    if (!documentoAtualizado) {
      throw new NotFoundException("Não foi possível atualizar o documento");
    }

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      provaId: documento.provaId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "DOCUMENTO_IMPRESSO",
      statusAnterior: null,
      statusNovo: documento.prova.status,
      detalhes: {
        documentoId: documento.id,
        documentoNome: documento.fileName || "Documento sem nome",
        impressoEm: impressoEm.toISOString(),
      },
    });

    return documentoAtualizado;
  }

  /**
   * Busca histórico de ações de uma prova
   */
  async getHistorico(provaId: string) {
    return this.historicoService.buscarPorProva(provaId);
  }
}
