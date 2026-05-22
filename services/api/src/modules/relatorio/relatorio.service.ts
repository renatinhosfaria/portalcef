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
  inArray,
  isNotNull,
  relatorio,
  relatorioDocumento,
  turmas,
  users,
  educationStages,
  type Relatorio,
  type RelatorioDocumento,
  type RelatorioStatus,
  type PdfStatus,
  type EducationStageCode,
} from "@essencia/db";

import type {
  PdfGerado,
  PdfGeneratorService,
} from "../../common/sharepoint/pdf-generator.service";
import { StorageService } from "../../common/storage/storage.service";
import { RelatorioHistoricoService } from "./relatorio-historico.service";
import { RelatorioPdfQueueService } from "./relatorio-pdf-queue.service";

import {
  type CreateRelatorioDto,
  type DevolverRelatorioDto,
  type ListarRelatoriosGestaoDto,
  isAnalista,
  isCoordenadora,
  isGestao,
} from "./dto/relatorio.dto";

// ============================================
// Constantes
// ============================================

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const PDF_MIME = "application/pdf";

const ETAPAS_PERMITIDAS: EducationStageCode[] = ["BERCARIO", "INFANTIL"];

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
 * Relatório com documentos (resposta completa)
 */
export interface RelatorioComDocumentos extends Relatorio {
  documentos: RelatorioDocumento[];
  user: { id: string; name: string };
  turma: { id: string; name: string; code: string; stageId: string };
}

/**
 * Item do dashboard de status
 */
export interface DashboardItem {
  status: RelatorioStatus;
  count: number;
  segmento?: string;
}

// ============================================
// Service
// ============================================

/**
 * RelatorioService
 *
 * Implementa o workflow de aprovação de relatórios semanais
 * para etapas BERCARIO e INFANTIL:
 * - Professora: cria/submete relatório
 * - Analista: revisa/aprova/devolve para professora
 * - Coordenadora: aprova final/devolve para professora ou analista
 * - Gestão: visualiza dashboard e listagens
 */
@Injectable()
export class RelatorioService {
  constructor(
    private readonly historicoService: RelatorioHistoricoService,
    private readonly storageService: StorageService,
    private readonly pdfQueueService: RelatorioPdfQueueService,
  ) {}

  // ============================================
  // Métodos da Professora
  // ============================================

  /**
   * Cria ou busca relatório existente para turma/semana.
   * Valida que a turma pertence a uma etapa permitida (BERCARIO ou INFANTIL).
   */
  async criar(
    dto: CreateRelatorioDto,
    user: UserContext,
  ): Promise<Relatorio> {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    // Buscar turma com sua etapa via join
    const linhas = await db
      .select({
        turmaId: turmas.id,
        stageId: turmas.stageId,
        etapaCode: educationStages.code,
      })
      .from(turmas)
      .innerJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(and(eq(turmas.id, dto.turmaId), eq(turmas.unitId, user.unitId)));

    const turmaInfo = linhas[0];

    if (!turmaInfo) {
      throw new NotFoundException(
        "Turma não encontrada ou não pertence à sua unidade",
      );
    }

    if (
      !ETAPAS_PERMITIDAS.includes(turmaInfo.etapaCode as EducationStageCode)
    ) {
      throw new BadRequestException(
        "Relatórios estão disponíveis apenas para turmas de Berçário e Infantil",
      );
    }

    // Verificar se já existe relatório para (userId, turmaId, semanaId)
    const existente = await db.query.relatorio.findFirst({
      where: and(
        eq(relatorio.userId, user.userId),
        eq(relatorio.turmaId, dto.turmaId),
        eq(relatorio.semanaId, dto.semanaId),
      ),
    });

    if (existente) {
      return existente;
    }

    const [novoRelatorio] = await db
      .insert(relatorio)
      .values({
        userId: user.userId,
        turmaId: dto.turmaId,
        unitId: user.unitId,
        semanaId: dto.semanaId,
        semanaRelatorioId: dto.semanaRelatorioId ?? null,
        status: "RASCUNHO",
      })
      .returning();

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId: novoRelatorio.id,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "CRIADO",
      statusAnterior: null,
      statusNovo: "RASCUNHO",
    });

    return novoRelatorio;
  }

  /**
   * Busca relatório por ID com documentos.
   * Valida acesso baseado no role e ownership.
   */
  async buscarPorId(
    relatorioId: string,
    user: UserContext,
  ): Promise<RelatorioComDocumentos> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
      with: {
        user: true,
        turma: true,
        documentos: {
          orderBy: [
            desc(relatorioDocumento.updatedAt),
            desc(relatorioDocumento.createdAt),
          ],
        },
      },
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    const isOwner = encontrado.userId === user.userId;
    const isGestaoUser = isGestao(user.role);
    const isAnalistaUser = isAnalista(user.role);
    const isCoordenadoraUser = isCoordenadora(user.role);
    const isSameUnit = encontrado.unitId === user.unitId;

    if (isOwner) {
      return this.formatResponse(encontrado);
    }

    if (isGestaoUser && isSameUnit) {
      return this.formatResponse(encontrado);
    }

    if (isAnalistaUser && isSameUnit) {
      return this.formatResponse(encontrado);
    }

    if (isCoordenadoraUser && isSameUnit) {
      // Verificar se a coordenadora tem permissão para a etapa do relatório
      const turmaInfo = await this.buscarEtapaDaTurma(encontrado.turmaId);
      if (turmaInfo && this.coordenadoraPodeVerEtapa(user.role, turmaInfo)) {
        return this.formatResponse(encontrado);
      }
    }

    throw new ForbiddenException(
      "Você não tem permissão para acessar este relatório",
    );
  }

  /**
   * Lista relatórios da professora autenticada.
   */
  async listarMeusRelatorios(user: UserContext): Promise<Relatorio[]> {
    const db = getDb();

    const lista = await db.query.relatorio.findMany({
      where: eq(relatorio.userId, user.userId),
      with: {
        turma: true,
        documentos: true,
      },
      orderBy: [desc(relatorio.updatedAt)],
    });

    return lista;
  }

  /**
   * Submete relatório para análise.
   * RASCUNHO, DEVOLVIDO_ANALISTA, DEVOLVIDO_COORDENADORA ou RECUPERADO
   * passam a AGUARDANDO_ANALISTA.
   */
  async submeter(
    relatorioId: string,
    user: UserContext,
  ): Promise<Relatorio> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
      with: { documentos: true },
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (encontrado.userId !== user.userId) {
      throw new ForbiddenException(
        "Apenas o autor pode submeter o relatório",
      );
    }

    if (!encontrado.documentos || encontrado.documentos.length === 0) {
      throw new BadRequestException(
        "Relatório precisa ter pelo menos um documento anexado",
      );
    }

    const statusPermitidos: RelatorioStatus[] = [
      "RASCUNHO",
      "DEVOLVIDO_ANALISTA",
      "DEVOLVIDO_COORDENADORA",
      "RECUPERADO",
    ];

    if (!statusPermitidos.includes(encontrado.status)) {
      throw new BadRequestException(
        `Não é possível submeter relatório com status ${encontrado.status}`,
      );
    }

    const statusAnterior = encontrado.status;
    const novoStatus: RelatorioStatus = "AGUARDANDO_ANALISTA";

    const [atualizado] = await db
      .update(relatorio)
      .set({
        status: novoStatus,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(relatorio.id, relatorioId))
      .returning();

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "SUBMETIDO",
      statusAnterior,
      statusNovo: novoStatus,
    });

    return atualizado;
  }

  /**
   * Recupera relatório submetido (AGUARDANDO_ANALISTA -> RECUPERADO).
   * Só é possível antes da analista iniciar a análise.
   */
  async recuperar(
    relatorioId: string,
    user: UserContext,
  ): Promise<Relatorio> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (encontrado.userId !== user.userId) {
      throw new ForbiddenException(
        "Apenas o autor pode recuperar o relatório",
      );
    }

    if (encontrado.status !== "AGUARDANDO_ANALISTA") {
      throw new ConflictException(
        `Não é possível recuperar relatório com status ${encontrado.status}`,
      );
    }

    const documentoAprovado = await db.query.relatorioDocumento.findFirst({
      where: and(
        eq(relatorioDocumento.relatorioId, relatorioId),
        isNotNull(relatorioDocumento.approvedBy),
      ),
    });

    if (documentoAprovado) {
      throw new ConflictException(
        "A analista pedagógica já iniciou a análise deste relatório. Não é mais possível recuperá-lo.",
      );
    }

    const statusAnterior = encontrado.status;

    const [atualizado] = await db
      .update(relatorio)
      .set({
        status: "RECUPERADO",
        submittedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(relatorio.id, relatorioId))
      .returning();

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "RECUPERADO",
      statusAnterior,
      statusNovo: "RECUPERADO",
    });

    return atualizado;
  }

  // ============================================
  // Métodos do Analista
  // ============================================

  /**
   * Lista relatórios pendentes para analista.
   * Status: AGUARDANDO_ANALISTA ou REVISAO_ANALISTA.
   */
  async listarPendentesAnalista(user: UserContext) {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    const lista = await db.query.relatorio.findMany({
      where: and(
        eq(relatorio.unitId, user.unitId),
        or(
          eq(relatorio.status, "AGUARDANDO_ANALISTA"),
          eq(relatorio.status, "REVISAO_ANALISTA"),
        ),
      ),
      with: {
        user: true,
        turma: { with: { stage: true } },
      },
      orderBy: [desc(relatorio.submittedAt)],
    });

    return lista.map((r: (typeof lista)[number]) => this.mapToSummary(r));
  }

  /**
   * Aprova relatório como analista (-> AGUARDANDO_COORDENADORA).
   */
  async aprovarAnalista(
    relatorioId: string,
    user: UserContext,
  ): Promise<Relatorio> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (encontrado.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode aprovar relatórios da sua unidade",
      );
    }

    const statusPermitidos: RelatorioStatus[] = [
      "AGUARDANDO_ANALISTA",
      "REVISAO_ANALISTA",
    ];

    if (!statusPermitidos.includes(encontrado.status)) {
      throw new BadRequestException(
        `Não é possível aprovar relatório com status ${encontrado.status}`,
      );
    }

    const statusAnterior = encontrado.status;
    const novoStatus: RelatorioStatus = "AGUARDANDO_COORDENADORA";

    const [atualizado] = await db
      .update(relatorio)
      .set({
        status: novoStatus,
        updatedAt: new Date(),
      })
      .where(eq(relatorio.id, relatorioId))
      .returning();

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "APROVADO_ANALISTA",
      statusAnterior,
      statusNovo: novoStatus,
    });

    return atualizado;
  }

  /**
   * Devolve relatório como analista (-> DEVOLVIDO_ANALISTA).
   */
  async devolverAnalista(
    relatorioId: string,
    dto: DevolverRelatorioDto,
    user: UserContext,
  ): Promise<Relatorio> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (encontrado.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode devolver relatórios da sua unidade",
      );
    }

    const statusPermitidos: RelatorioStatus[] = [
      "AGUARDANDO_ANALISTA",
      "REVISAO_ANALISTA",
    ];

    if (!statusPermitidos.includes(encontrado.status)) {
      throw new BadRequestException(
        `Não é possível devolver relatório com status ${encontrado.status}`,
      );
    }

    const statusAnterior = encontrado.status;

    const [atualizado] = await db
      .update(relatorio)
      .set({
        status: "DEVOLVIDO_ANALISTA",
        updatedAt: new Date(),
      })
      .where(eq(relatorio.id, relatorioId))
      .returning();

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "DEVOLVIDO_ANALISTA",
      statusAnterior,
      statusNovo: "DEVOLVIDO_ANALISTA",
      detalhes: { motivo: dto.motivo },
    });

    return atualizado;
  }

  // ============================================
  // Métodos da Coordenadora
  // ============================================

  /**
   * Lista relatórios pendentes para coordenadora.
   * Filtrado por segmento (BERCARIO/INFANTIL) da coordenadora.
   */
  async listarPendentesCoordenadora(user: UserContext) {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    const base = await db.query.relatorio.findMany({
      where: and(
        eq(relatorio.unitId, user.unitId),
        eq(relatorio.status, "AGUARDANDO_COORDENADORA"),
      ),
      with: {
        user: true,
        turma: { with: { stage: true } },
      },
      orderBy: [desc(relatorio.submittedAt)],
    });

    // Filtrar por segmento da coordenadora (quando aplicável)
    const filtrados = base.filter((r: (typeof base)[number]) => {
      const turmaComStage = r.turma as { stage?: { code: string } };
      const codigoEtapa = turmaComStage?.stage?.code ?? "";
      return this.coordenadoraPodeVerEtapa(user.role, codigoEtapa);
    });

    return filtrados.map((r: (typeof filtrados)[number]) =>
      this.mapToSummary(r),
    );
  }

  /**
   * Aprova relatório como coordenadora (-> APROVADO).
   */
  async aprovarCoordenadora(
    relatorioId: string,
    user: UserContext,
  ): Promise<Relatorio> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
      with: {
        turma: { with: { stage: true } },
      },
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (encontrado.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode aprovar relatórios da sua unidade",
      );
    }

    const turmaComStage = encontrado.turma as { stage?: { code: string } };
    const codigoEtapa = turmaComStage?.stage?.code ?? "";

    if (!this.coordenadoraPodeVerEtapa(user.role, codigoEtapa)) {
      throw new ForbiddenException(
        "Você só pode aprovar relatórios do seu segmento",
      );
    }

    if (encontrado.status !== "AGUARDANDO_COORDENADORA") {
      throw new BadRequestException(
        `Não é possível aprovar relatório com status ${encontrado.status}`,
      );
    }

    const statusAnterior = encontrado.status;

    const [atualizado] = await db
      .update(relatorio)
      .set({
        status: "APROVADO",
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(relatorio.id, relatorioId))
      .returning();

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "APROVADO_COORDENADORA",
      statusAnterior,
      statusNovo: "APROVADO",
    });

    return atualizado;
  }

  /**
   * Devolve relatório como coordenadora (-> DEVOLVIDO_COORDENADORA).
   */
  async devolverCoordenadora(
    relatorioId: string,
    dto: DevolverRelatorioDto,
    user: UserContext,
  ): Promise<Relatorio> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
      with: {
        turma: { with: { stage: true } },
      },
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (encontrado.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode devolver relatórios da sua unidade",
      );
    }

    const turmaComStage = encontrado.turma as { stage?: { code: string } };
    const codigoEtapa = turmaComStage?.stage?.code ?? "";

    if (!this.coordenadoraPodeVerEtapa(user.role, codigoEtapa)) {
      throw new ForbiddenException(
        "Você só pode devolver relatórios do seu segmento",
      );
    }

    if (encontrado.status !== "AGUARDANDO_COORDENADORA") {
      throw new BadRequestException(
        `Não é possível devolver relatório com status ${encontrado.status}`,
      );
    }

    const statusAnterior = encontrado.status;

    const [atualizado] = await db
      .update(relatorio)
      .set({
        status: "DEVOLVIDO_COORDENADORA",
        updatedAt: new Date(),
      })
      .where(eq(relatorio.id, relatorioId))
      .returning();

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "DEVOLVIDO_COORDENADORA",
      statusAnterior,
      statusNovo: "DEVOLVIDO_COORDENADORA",
      detalhes: { motivo: dto.motivo },
    });

    return atualizado;
  }

  // ============================================
  // Métodos de Gestão
  // ============================================

  /**
   * Dashboard de relatórios com contagens por status para a gestão.
   */
  async getDashboardGestao(user: UserContext): Promise<{
    totais: DashboardItem[];
  }> {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    const lista = await db.query.relatorio.findMany({
      where: eq(relatorio.unitId, user.unitId),
    });

    const contagem: Record<string, number> = {};
    for (const r of lista) {
      contagem[r.status] = (contagem[r.status] ?? 0) + 1;
    }

    const totais: DashboardItem[] = Object.entries(contagem).map(
      ([status, count]) => ({
        status: status as RelatorioStatus,
        count,
      }),
    );

    return { totais };
  }

  /**
   * Listagem completa de relatórios para a gestão, com filtros opcionais.
   */
  async listarGestao(user: UserContext, filtros: ListarRelatoriosGestaoDto) {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    if (!isGestao(user.role)) {
      throw new ForbiddenException(
        "Você não tem permissão para acessar esta listagem",
      );
    }

    const conditions = [eq(relatorio.unitId, user.unitId)];

    if (filtros.status) {
      conditions.push(eq(relatorio.status, filtros.status));
    }

    if (filtros.semanaId) {
      conditions.push(eq(relatorio.semanaId, filtros.semanaId));
    }

    const base = await db.query.relatorio.findMany({
      where: and(...conditions),
      with: {
        user: true,
        turma: { with: { stage: true } },
        documentos: true,
      },
      orderBy: [desc(relatorio.submittedAt), desc(relatorio.createdAt)],
    });

    type ItemBase = (typeof base)[number];
    let filtrados: ItemBase[] = base;

    if (filtros.etapa) {
      filtrados = filtrados.filter((r: ItemBase) => {
        const turmaComStage = r.turma as { stage?: { code: string } };
        return turmaComStage?.stage?.code === filtros.etapa;
      });
    }

    return filtrados.map((r: ItemBase) => {
      const turmaComStage = r.turma as {
        name: string;
        code: string;
        stage?: { name: string; code: string };
      };

      return {
        id: r.id,
        professorName: (r.user as { name: string })?.name ?? "",
        turmaCode: turmaComStage?.code ?? "",
        turmaName: turmaComStage?.name ?? "",
        etapaCode: turmaComStage?.stage?.code ?? "",
        etapaName: turmaComStage?.stage?.name ?? "",
        semanaId: r.semanaId,
        semanaRelatorioId: r.semanaRelatorioId,
        status: r.status,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        documentosCount: Array.isArray(r.documentos) ? r.documentos.length : 0,
      };
    });
  }

  /**
   * Exclui permanentemente um relatório.
   * Apenas master e diretora_geral podem excluir.
   */
  async deletarRelatorio(
    relatorioId: string,
    user: UserContext,
  ): Promise<void> {
    if (user.role !== "master" && user.role !== "diretora_geral") {
      throw new ForbiddenException(
        "Apenas master ou diretora geral podem excluir relatórios",
      );
    }

    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (user.role !== "master" && encontrado.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode excluir relatórios da sua unidade",
      );
    }

    await db.delete(relatorio).where(eq(relatorio.id, relatorioId));
  }

  // ============================================
  // Documentos
  // ============================================

  /**
   * Adiciona documento do tipo upload ao relatório.
   */
  async adicionarDocumentoUpload(
    relatorioId: string,
    dados: {
      fileName: string;
      storageKey: string;
      url: string;
      fileSize: number;
      mimeType: string;
    },
  ): Promise<RelatorioDocumento> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (!this.statusPermiteEdicao(encontrado.status)) {
      throw new BadRequestException(
        `Não é possível adicionar documentos com status ${encontrado.status}`,
      );
    }

    const [documento] = await db
      .insert(relatorioDocumento)
      .values({
        relatorioId,
        tipo: "ARQUIVO",
        fileName: dados.fileName,
        storageKey: dados.storageKey,
        url: dados.url,
        fileSize: dados.fileSize,
        mimeType: dados.mimeType,
      })
      .returning();

    return documento;
  }

  /**
   * Adiciona link YouTube ao relatório.
   */
  async adicionarYoutube(
    relatorioId: string,
    dados: { url: string; titulo?: string },
  ): Promise<RelatorioDocumento> {
    const db = getDb();

    const encontrado = await db.query.relatorio.findFirst({
      where: eq(relatorio.id, relatorioId),
    });

    if (!encontrado) {
      throw new NotFoundException("Relatório não encontrado");
    }

    if (!this.statusPermiteEdicao(encontrado.status)) {
      throw new BadRequestException(
        `Não é possível adicionar documentos com status ${encontrado.status}`,
      );
    }

    const [documento] = await db
      .insert(relatorioDocumento)
      .values({
        relatorioId,
        tipo: "LINK_YOUTUBE",
        url: dados.url,
        fileName: dados.titulo,
      })
      .returning();

    return documento;
  }

  /**
   * Remove documento de um relatório.
   */
  async removerDocumento(
    relatorioId: string,
    documentoId: string,
  ): Promise<void> {
    const db = getDb();

    const documento = await db.query.relatorioDocumento.findFirst({
      where: and(
        eq(relatorioDocumento.id, documentoId),
        eq(relatorioDocumento.relatorioId, relatorioId),
      ),
    });

    if (!documento) {
      throw new NotFoundException(
        "Documento não encontrado ou não pertence ao relatório",
      );
    }

    if (
      documento.storageKey &&
      documento.pdfStorageKey &&
      documento.pdfStorageKey !== documento.storageKey
    ) {
      await this.storageService.deleteFile(documento.pdfStorageKey);
    }

    await db
      .delete(relatorioDocumento)
      .where(eq(relatorioDocumento.id, documentoId));
  }

  /**
   * Busca documento por ID validando que pertence ao relatório.
   */
  async getDocumentoById(
    relatorioId: string,
    documentoId: string,
  ): Promise<RelatorioDocumento> {
    const db = getDb();

    const documento = await db.query.relatorioDocumento.findFirst({
      where: and(
        eq(relatorioDocumento.id, documentoId),
        eq(relatorioDocumento.relatorioId, relatorioId),
      ),
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    return documento;
  }

  /**
   * Atualiza campos de um documento.
   */
  async atualizarDocumento(
    documentoId: string,
    dados: {
      fileSize?: number;
      updatedAt?: Date;
      sharepointItemId?: string | null;
      sharepointEditUrl?: string | null;
      editandoDesde?: Date | null;
    },
  ): Promise<void> {
    const db = getDb();
    await db
      .update(relatorioDocumento)
      .set(dados)
      .where(eq(relatorioDocumento.id, documentoId));
  }

  /**
   * Gera URL pré-assinada para download de documento.
   */
  async downloadDocumento(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<{ url: string }> {
    await this.buscarPorId(relatorioId, user);
    const documento = await this.getDocumentoById(relatorioId, documentoId);

    if (!documento.storageKey) {
      throw new BadRequestException(
        "Documento não possui arquivo armazenado",
      );
    }

    const url = await this.storageService.getPresignedUrl(
      documento.storageKey,
    );
    return { url };
  }

  // ============================================
  // Edição via SharePoint (Word)
  // ============================================

  /**
   * Verifica permissão para editar documento Word.
   * Disponível para professora, auxiliar_sala E analista_pedagogico.
   */
  private podeEditarWord(role: string): boolean {
    return (
      role === "professora" ||
      role === "auxiliar_sala" ||
      role === "analista_pedagogico"
    );
  }

  /**
   * Inicia edição de documento Word (somente quem tem permissão).
   * Detalhes da integração SharePoint ficam no controller.
   */
  async editarWord(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<RelatorioDocumento> {
    if (!this.podeEditarWord(user.role)) {
      throw new ForbiddenException(
        "Você não tem permissão para editar documentos Word",
      );
    }

    await this.buscarPorId(relatorioId, user);
    const documento = await this.getDocumentoById(relatorioId, documentoId);

    if (!this.isWord(documento.mimeType)) {
      throw new BadRequestException(
        "Apenas documentos Word podem ser editados online",
      );
    }

    return documento;
  }

  /**
   * Retorna URL de visualização/edição via SharePoint.
   */
  async getSharePointUrl(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<{ url: string | null }> {
    await this.buscarPorId(relatorioId, user);
    const documento = await this.getDocumentoById(relatorioId, documentoId);
    return { url: documento.sharepointEditUrl ?? null };
  }

  /**
   * Sincroniza documento após edição via SharePoint.
   * Limpa campos temporários.
   */
  async sincronizarWord(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<RelatorioDocumento> {
    if (!this.podeEditarWord(user.role)) {
      throw new ForbiddenException(
        "Você não tem permissão para sincronizar este documento",
      );
    }

    await this.buscarPorId(relatorioId, user);
    const documento = await this.getDocumentoById(relatorioId, documentoId);

    const db = getDb();
    const [atualizado] = await db
      .update(relatorioDocumento)
      .set({
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documento.id))
      .returning();

    return atualizado;
  }

  // ============================================
  // Aprovação de documentos individuais
  // ============================================

  /**
   * Aprova documento individualmente e agenda geração de PDF (quando aplicável).
   */
  async aprovarDocumento(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<RelatorioDocumento> {
    if (!isAnalista(user.role)) {
      throw new ForbiddenException(
        "Apenas a analista pedagógica pode aprovar documentos",
      );
    }

    const db = getDb();

    const documento = await db.query.relatorioDocumento.findFirst({
      where: and(
        eq(relatorioDocumento.id, documentoId),
        eq(relatorioDocumento.relatorioId, relatorioId),
      ),
      with: { relatorio: true },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    const relatorioDoDocumento = (
      documento as RelatorioDocumento & { relatorio: Relatorio }
    ).relatorio;

    if (relatorioDoDocumento.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você não tem permissão para aprovar este documento",
      );
    }

    const agora = new Date();
    let pdfStorageKey: string | null = null;
    let pdfUrl: string | null = null;
    let pdfStatus: PdfStatus = "NAO_APLICAVEL";
    let pdfRequestedAt: Date | null = null;
    let pdfGeneratedAt: Date | null = null;

    if (this.isPdfNativo(documento.mimeType)) {
      pdfStatus = "PRONTO";
      pdfStorageKey = documento.storageKey;
      pdfUrl = documento.url;
      pdfRequestedAt = agora;
      pdfGeneratedAt = agora;
    } else if (this.isWord(documento.mimeType)) {
      pdfStatus = "PENDENTE";
      pdfRequestedAt = agora;
    }

    const [atualizado] = await db
      .update(relatorioDocumento)
      .set({
        approvedBy: user.userId,
        approvedAt: agora,
        pdfStorageKey,
        pdfUrl,
        pdfStatus,
        pdfError: null,
        pdfRequestedAt,
        pdfGeneratedAt,
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documentoId))
      .returning();

    if (pdfStatus === "PENDENTE") {
      await this.pdfQueueService.adicionar(documentoId);
    }

    return atualizado;
  }

  /**
   * Desaprova documento.
   */
  async desaprovarDocumento(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<RelatorioDocumento> {
    if (!isAnalista(user.role)) {
      throw new ForbiddenException(
        "Apenas a analista pedagógica pode desaprovar documentos",
      );
    }

    const db = getDb();

    const documento = await db.query.relatorioDocumento.findFirst({
      where: and(
        eq(relatorioDocumento.id, documentoId),
        eq(relatorioDocumento.relatorioId, relatorioId),
      ),
      with: { relatorio: true },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    const relatorioDoDocumento = (
      documento as RelatorioDocumento & { relatorio: Relatorio }
    ).relatorio;

    if (relatorioDoDocumento.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você não tem permissão para desaprovar este documento",
      );
    }

    if (!documento.approvedBy) {
      throw new BadRequestException("Este documento não está aprovado");
    }

    if (
      documento.pdfStorageKey &&
      documento.pdfStorageKey !== documento.storageKey
    ) {
      await this.storageService.deleteFile(documento.pdfStorageKey);
    }

    const [atualizado] = await db
      .update(relatorioDocumento)
      .set({
        approvedBy: null,
        approvedAt: null,
        pdfStorageKey: null,
        pdfUrl: null,
        pdfStatus: "NAO_APLICAVEL",
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documentoId))
      .returning();

    return atualizado;
  }

  /**
   * Recoloca o documento na fila de geração de PDF.
   */
  async regerarPdf(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<RelatorioDocumento> {
    if (!isAnalista(user.role)) {
      throw new ForbiddenException(
        "Apenas a analista pedagógica pode regerar PDFs",
      );
    }

    const db = getDb();

    const documento = await db.query.relatorioDocumento.findFirst({
      where: and(
        eq(relatorioDocumento.id, documentoId),
        eq(relatorioDocumento.relatorioId, relatorioId),
      ),
      with: { relatorio: true },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    const relatorioDoDocumento = (
      documento as RelatorioDocumento & { relatorio: Relatorio }
    ).relatorio;

    if (relatorioDoDocumento.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você não tem permissão para reprocessar este PDF",
      );
    }

    if (!documento.approvedBy || !documento.approvedAt) {
      throw new BadRequestException("Documento precisa estar aprovado");
    }

    if (!this.isWord(documento.mimeType)) {
      throw new BadRequestException(
        "Apenas documentos Word podem ter PDF reprocessado",
      );
    }

    const [atualizado] = await db
      .update(relatorioDocumento)
      .set({
        pdfStatus: "PENDENTE",
        pdfError: null,
        pdfRequestedAt: new Date(),
        pdfGeneratedAt: null,
        pdfStorageKey: null,
        pdfUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documentoId))
      .returning();

    await this.pdfQueueService.adicionar(documentoId);

    return atualizado;
  }

  /**
   * Registra que o documento aprovado foi impresso.
   */
  async registrarImpressao(
    relatorioId: string,
    documentoId: string,
    user: UserContext,
  ): Promise<RelatorioDocumento> {
    const db = getDb();

    const documento = await db.query.relatorioDocumento.findFirst({
      where: and(
        eq(relatorioDocumento.id, documentoId),
        eq(relatorioDocumento.relatorioId, relatorioId),
      ),
      with: {
        relatorio: { columns: { status: true } },
      },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    // Reaproveita validação completa de acesso
    await this.buscarPorId(relatorioId, user);

    if (!documento.approvedBy || !documento.approvedAt) {
      throw new BadRequestException(
        "Somente documentos aprovados podem ser impressos",
      );
    }

    if (!documento.url) {
      throw new BadRequestException(
        "Documento não possui arquivo disponível para impressão",
      );
    }

    const impressoEm = new Date();

    const [atualizado] = await db
      .update(relatorioDocumento)
      .set({
        printedBy: user.userId,
        printedAt: impressoEm,
        updatedAt: impressoEm,
      })
      .where(eq(relatorioDocumento.id, documentoId))
      .returning();

    const statusRelatorio =
      (documento as RelatorioDocumento & { relatorio: { status: string } })
        .relatorio?.status ?? "";

    const userName = await this.getUserName(user.userId);
    await this.historicoService.registrar({
      relatorioId,
      userId: user.userId,
      userName,
      userRole: user.role,
      acao: "DOCUMENTO_IMPRESSO",
      statusAnterior: null,
      statusNovo: statusRelatorio,
      detalhes: {
        documentoId: documento.id,
        documentoNome: documento.fileName ?? "Documento sem nome",
        impressoEm: impressoEm.toISOString(),
      },
    });

    return atualizado;
  }

  // ============================================
  // Verificação para acesso ao módulo
  // ============================================

  /**
   * Verifica se a professora tem alguma turma BERCARIO ou INFANTIL na unidade.
   */
  async verificarTurmaInfantil(
    userId: string,
    unitId: string,
  ): Promise<boolean> {
    const db = getDb();
    const linhas = await db
      .select({ turmaId: turmas.id, etapaCode: educationStages.code })
      .from(turmas)
      .innerJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(
        and(
          eq(turmas.professoraId, userId),
          eq(turmas.unitId, unitId),
          inArray(educationStages.code, ETAPAS_PERMITIDAS),
        ),
      );

    return linhas.length > 0;
  }

  // ============================================
  // Worker de PDF
  // ============================================

  /**
   * Processa a geração de PDF de um documento.
   * Chamado pelo RelatorioPdfWorkerService.
   */
  async processarPdfDocumento(
    documentoId: string,
    pdfGeneratorService: PdfGeneratorService,
  ): Promise<void> {
    const documento = await this.buscarDocumentoParaPdf(documentoId);

    if (!documento || !documento.approvedAt || !documento.approvedBy) {
      return;
    }

    if (
      documento.pdfStatus !== "PENDENTE" &&
      documento.pdfStatus !== "ERRO"
    ) {
      return;
    }

    await this.marcarPdfGerando(documentoId);

    try {
      const pdf = await pdfGeneratorService.gerarParaImpressao({
        id: documento.id,
        storageKey: documento.storageKey,
        url: documento.url,
        fileName: documento.fileName,
        mimeType: documento.mimeType,
        sharepointItemId: documento.sharepointItemId,
        sharepointEditUrl: documento.sharepointEditUrl,
        editandoDesde: documento.editandoDesde,
      });

      if (!pdf) {
        throw new Error(
          `PDF de impressão não gerado para documento ${documentoId}`,
        );
      }

      await this.marcarPdfPronto(documentoId, pdf);
    } catch (error) {
      await this.marcarPdfErro(documentoId, error);
    } finally {
      if (documento.sharepointItemId) {
        await this.limparEdicaoSharePoint(documentoId);
      }
    }
  }

  async buscarDocumentoParaPdf(
    documentoId: string,
  ): Promise<RelatorioDocumento | null> {
    const db = getDb();
    const documento = await db.query.relatorioDocumento.findFirst({
      where: eq(relatorioDocumento.id, documentoId),
    });

    return documento ?? null;
  }

  async marcarPdfGerando(documentoId: string): Promise<void> {
    const db = getDb();
    await db
      .update(relatorioDocumento)
      .set({
        pdfStatus: "GERANDO",
        pdfError: null,
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documentoId));
  }

  async marcarPdfPronto(
    documentoId: string,
    pdf: PdfGerado,
  ): Promise<void> {
    const db = getDb();
    await db
      .update(relatorioDocumento)
      .set({
        pdfStorageKey: pdf.pdfStorageKey,
        pdfUrl: pdf.pdfUrl,
        pdfStatus: "PRONTO",
        pdfError: null,
        pdfGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documentoId));
  }

  async marcarPdfErro(documentoId: string, error: unknown): Promise<void> {
    const db = getDb();
    const mensagem = error instanceof Error ? error.message : String(error);

    await db
      .update(relatorioDocumento)
      .set({
        pdfStatus: "ERRO",
        pdfError: mensagem.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documentoId));
  }

  async limparEdicaoSharePoint(documentoId: string): Promise<void> {
    const db = getDb();
    await db
      .update(relatorioDocumento)
      .set({
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
        updatedAt: new Date(),
      })
      .where(eq(relatorioDocumento.id, documentoId));
  }

  // ============================================
  // Helpers privados
  // ============================================

  private isPdfNativo(mimeType: string | null): boolean {
    return mimeType === PDF_MIME;
  }

  private isWord(mimeType: string | null): boolean {
    return mimeType === DOCX_MIME || mimeType === DOC_MIME;
  }

  /**
   * Status que permitem edição (adicionar/remover documentos).
   */
  private statusPermiteEdicao(status: RelatorioStatus): boolean {
    return (
      status === "RASCUNHO" ||
      status === "DEVOLVIDO_ANALISTA" ||
      status === "DEVOLVIDO_COORDENADORA" ||
      status === "RECUPERADO"
    );
  }

  /**
   * Verifica se uma coordenadora pode acessar relatórios de uma determinada etapa.
   */
  private coordenadoraPodeVerEtapa(role: string, codigoEtapa: string): boolean {
    if (
      role === "master" ||
      role === "diretora_geral" ||
      role === "gerente_unidade" ||
      role === "coordenadora_geral"
    ) {
      return true;
    }

    if (role === "coordenadora_bercario") {
      return codigoEtapa === "BERCARIO";
    }

    if (role === "coordenadora_infantil") {
      return codigoEtapa === "INFANTIL";
    }

    return false;
  }

  /**
   * Busca apenas o código da etapa da turma.
   */
  private async buscarEtapaDaTurma(
    turmaId: string,
  ): Promise<string | null> {
    const db = getDb();
    const linhas = await db
      .select({ etapaCode: educationStages.code })
      .from(turmas)
      .innerJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(eq(turmas.id, turmaId));

    return linhas[0]?.etapaCode ?? null;
  }

  private mapToSummary(
    rel: Relatorio & {
      user?: { name: string } | null;
      turma?: {
        name: string;
        code: string;
        stage?: { name: string; code: string } | null;
      } | null;
    },
  ) {
    return {
      id: rel.id,
      semanaId: rel.semanaId,
      semanaRelatorioId: rel.semanaRelatorioId,
      status: rel.status,
      submittedAt: rel.submittedAt?.toISOString(),
      professorName: rel.user?.name ?? "",
      turmaName: rel.turma?.name ?? "",
      turmaCode: rel.turma?.code ?? "",
      etapaCode: rel.turma?.stage?.code ?? "",
      etapaName: rel.turma?.stage?.name ?? "",
    };
  }

  private formatResponse(
    rel: Relatorio & {
      user: { id: string; name: string };
      turma: { id: string; name: string; code: string; stageId: string };
      documentos?: RelatorioDocumento[];
    },
  ): RelatorioComDocumentos {
    return {
      ...rel,
      user: { id: rel.user.id, name: rel.user.name },
      turma: {
        id: rel.turma.id,
        name: rel.turma.name,
        code: rel.turma.code,
        stageId: rel.turma.stageId,
      },
      documentos: rel.documentos ?? [],
    };
  }

  private async getUserName(userId: string): Promise<string> {
    const db = getDb();
    const usuario = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return usuario?.name ?? "Usuário Desconhecido";
  }
}
