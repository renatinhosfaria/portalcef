import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  getDb,
  and,
  eq,
  or,
  desc,
  planoAula,
  planoDocumento,
  documentoComentario,
  quinzenaConfig,
  turmas,
  type PlanoAula,
  type PlanoDocumento,
  type DocumentoComentario,
  type PlanoAulaStatus,
} from "@essencia/db";

import {
  type CreatePlanoDto,
  type AddComentarioDto,
  type DevolverPlanoDto,
  type SetDeadlineDto,
  isAnalista,
  isCoordenadora,
  isGestao,
  getSegmentosPermitidos,
} from "./dto/plano-aula.dto";

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
 * Plano com documentos e comentários (resposta completa)
 */
export interface PlanoComDocumentos extends PlanoAula {
  documentos: Array<
    PlanoDocumento & {
      comentarios: Array<
        DocumentoComentario & {
          autor: { id: string; name: string };
        }
      >;
    }
  >;
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

/**
 * Deadline de quinzena
 */
export interface QuinzenaDeadline {
  quinzenaId: string;
  deadline: Date;
  unitId: string;
}

// ============================================
// Service
// ============================================

/**
 * PlanoAulaService
 *
 * Implementa o workflow de aprovação de planos de aula:
 * - Professora: cria/submete plano
 * - Analista: revisa/aprova/devolve para professora
 * - Coordenadora: aprova final/devolve para professora ou analista
 * - Gestão: visualiza dashboard, define deadlines
 */
@Injectable()
export class PlanoAulaService {
  // ============================================
  // Métodos da Professora
  // ============================================

  /**
   * Cria ou busca plano existente para turma/quinzena
   * Se já existe, retorna o plano existente
   */
  async criarPlano(user: UserContext, dto: CreatePlanoDto): Promise<PlanoAula> {
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

    // Verificar se já existe plano para esta turma/quinzena
    const existente = await db.query.planoAula.findFirst({
      where: and(
        eq(planoAula.userId, user.userId),
        eq(planoAula.turmaId, dto.turmaId),
        eq(planoAula.quinzenaId, dto.quinzenaId),
      ),
    });

    if (existente) {
      return existente;
    }

    // Criar novo plano
    const [novoPlano] = await db
      .insert(planoAula)
      .values({
        userId: user.userId,
        turmaId: dto.turmaId,
        unitId: user.unitId,
        quinzenaId: dto.quinzenaId,
        status: "RASCUNHO",
      })
      .returning();

    return novoPlano;
  }

  /**
   * Busca plano por ID com documentos e comentários
   * Valida acesso baseado no role e ownership
   */
  async getPlanoById(
    user: UserContext,
    planoId: string,
  ): Promise<PlanoComDocumentos> {
    const db = getDb();

    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
      with: {
        user: true,
        turma: true,
        documentos: {
          with: {
            comentarios: {
              with: {
                autor: true,
              },
            },
          },
        },
      },
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    // Verificar acesso
    const isOwner = plano.userId === user.userId;
    const isGestaoUser = isGestao(user.role);
    const isAnalistaUser = isAnalista(user.role);
    const isCoordenadoraUser = isCoordenadora(user.role);
    const isSameUnit = plano.unitId === user.unitId;

    // Owner sempre pode ver
    if (isOwner) {
      return this.formatPlanoResponse(plano);
    }

    // Gestão pode ver todos da escola/unidade
    if (isGestaoUser && isSameUnit) {
      return this.formatPlanoResponse(plano);
    }

    // Analista pode ver planos da sua unidade
    if (isAnalistaUser && isSameUnit) {
      return this.formatPlanoResponse(plano);
    }

    // Coordenadora pode ver planos da sua unidade e segmento
    if (isCoordenadoraUser && isSameUnit) {
      const turmaDoPlano = await db.query.turmas.findFirst({
        where: eq(turmas.id, plano.turmaId),
        with: { stage: true },
      });

      const segmentosPermitidos = getSegmentosPermitidos(user.role);
      if (
        segmentosPermitidos === null ||
        segmentosPermitidos.includes(turmaDoPlano?.stage?.code || "")
      ) {
        return this.formatPlanoResponse(plano);
      }
    }

    throw new ForbiddenException(
      "Você não tem permissão para acessar este plano",
    );
  }

  /**
   * Submete plano para análise (RASCUNHO -> AGUARDANDO_ANALISTA)
   */
  async submeterPlano(user: UserContext, planoId: string): Promise<PlanoAula> {
    const db = getDb();

    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
      with: { documentos: true },
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.userId !== user.userId) {
      throw new ForbiddenException(
        "Apenas o autor pode submeter o plano",
      );
    }

    // Verificar se tem documentos anexados
    if (!plano.documentos || plano.documentos.length === 0) {
      throw new BadRequestException(
        "Plano precisa ter pelo menos um documento anexado",
      );
    }

    // Verificar status permite submissão
    const statusPermitidos: PlanoAulaStatus[] = [
      "RASCUNHO",
      "DEVOLVIDO_ANALISTA",
      "DEVOLVIDO_COORDENADORA",
    ];
    if (!statusPermitidos.includes(plano.status)) {
      throw new BadRequestException(
        `Não é possível submeter plano com status ${plano.status}`,
      );
    }

    // Determinar próximo status
    // Se foi devolvido pelo analista, volta para REVISAO_ANALISTA
    // Se foi devolvido pela coordenadora, volta para AGUARDANDO_ANALISTA ou AGUARDANDO_COORDENADORA
    let novoStatus: PlanoAulaStatus = "AGUARDANDO_ANALISTA";
    if (plano.status === "DEVOLVIDO_ANALISTA") {
      novoStatus = "REVISAO_ANALISTA";
    }

    const [atualizado] = await db
      .update(planoAula)
      .set({
        status: novoStatus,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId))
      .returning();

    return atualizado;
  }

  // ============================================
  // Métodos do Analista
  // ============================================

  /**
   * Lista planos pendentes para analista
   * Status: AGUARDANDO_ANALISTA ou REVISAO_ANALISTA
   */
  async listarPendentesAnalista(user: UserContext): Promise<PlanoAula[]> {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    const planos = await db.query.planoAula.findMany({
      where: and(
        eq(planoAula.unitId, user.unitId),
        or(
          eq(planoAula.status, "AGUARDANDO_ANALISTA"),
          eq(planoAula.status, "REVISAO_ANALISTA"),
        ),
      ),
      with: {
        user: true,
        turma: true,
      },
      orderBy: [desc(planoAula.submittedAt)],
    });

    return planos;
  }

  /**
   * Aprova plano como analista (-> AGUARDANDO_COORDENADORA)
   */
  async aprovarComoAnalista(
    user: UserContext,
    planoId: string,
  ): Promise<PlanoAula> {
    const db = getDb();

    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode aprovar planos da sua unidade",
      );
    }

    const statusPermitidos: PlanoAulaStatus[] = [
      "AGUARDANDO_ANALISTA",
      "REVISAO_ANALISTA",
    ];
    if (!statusPermitidos.includes(plano.status)) {
      throw new BadRequestException(
        `Não é possível aprovar plano com status ${plano.status}`,
      );
    }

    const [atualizado] = await db
      .update(planoAula)
      .set({
        status: "AGUARDANDO_COORDENADORA",
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId))
      .returning();

    return atualizado;
  }

  /**
   * Devolve plano como analista (-> DEVOLVIDO_ANALISTA)
   */
  async devolverComoAnalista(
    user: UserContext,
    planoId: string,
    comentarios?: Array<{ documentoId: string; comentario: string }>,
  ): Promise<PlanoAula> {
    const db = getDb();

    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode devolver planos da sua unidade",
      );
    }

    const statusPermitidos: PlanoAulaStatus[] = [
      "AGUARDANDO_ANALISTA",
      "REVISAO_ANALISTA",
    ];
    if (!statusPermitidos.includes(plano.status)) {
      throw new BadRequestException(
        `Não é possível devolver plano com status ${plano.status}`,
      );
    }

    // Inserir comentários se fornecidos
    if (comentarios && comentarios.length > 0) {
      await this.inserirComentarios(user.userId, comentarios);
    }

    const [atualizado] = await db
      .update(planoAula)
      .set({
        status: "DEVOLVIDO_ANALISTA",
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId))
      .returning();

    return atualizado;
  }

  // ============================================
  // Métodos da Coordenadora
  // ============================================

  /**
   * Lista planos pendentes para coordenadora
   * Filtrado por segmento da coordenadora
   */
  async listarPendentesCoordenadora(user: UserContext): Promise<PlanoAula[]> {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    // Buscar planos AGUARDANDO_COORDENADORA da unidade
    const planosBase = await db.query.planoAula.findMany({
      where: and(
        eq(planoAula.unitId, user.unitId),
        eq(planoAula.status, "AGUARDANDO_COORDENADORA"),
      ),
      with: {
        user: true,
        turma: {
          with: {
            stage: true,
          },
        },
      },
      orderBy: [desc(planoAula.submittedAt)],
    });

    // Filtrar por segmento da coordenadora
    const segmentosPermitidos = getSegmentosPermitidos(user.role);

    if (segmentosPermitidos === null) {
      // Gestão/Coordenadora Geral vê todos
      return planosBase;
    }

    // Filtrar por segmento
    type PlanoComTurmaStage = (typeof planosBase)[number];
    return planosBase.filter((p: PlanoComTurmaStage) => {
      const turmaComStage = p.turma as { stage?: { code: string } };
      return segmentosPermitidos.includes(turmaComStage?.stage?.code || "");
    });
  }

  /**
   * Aprova plano como coordenadora (-> APROVADO)
   */
  async aprovarComoCoordenadora(
    user: UserContext,
    planoId: string,
  ): Promise<PlanoAula> {
    const db = getDb();

    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
      with: {
        turma: {
          with: { stage: true },
        },
      },
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode aprovar planos da sua unidade",
      );
    }

    // Verificar segmento
    const turmaComStage = plano.turma as { stage?: { code: string } };
    const segmentosPermitidos = getSegmentosPermitidos(user.role);
    if (
      segmentosPermitidos !== null &&
      !segmentosPermitidos.includes(turmaComStage?.stage?.code || "")
    ) {
      throw new ForbiddenException(
        "Você só pode aprovar planos do seu segmento",
      );
    }

    if (plano.status !== "AGUARDANDO_COORDENADORA") {
      throw new BadRequestException(
        `Não é possível aprovar plano com status ${plano.status}`,
      );
    }

    const [atualizado] = await db
      .update(planoAula)
      .set({
        status: "APROVADO",
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId))
      .returning();

    return atualizado;
  }

  /**
   * Devolve plano como coordenadora
   * Pode devolver para PROFESSORA ou ANALISTA
   */
  async devolverComoCoordenadora(
    user: UserContext,
    planoId: string,
    dto: DevolverPlanoDto,
  ): Promise<PlanoAula> {
    const db = getDb();

    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
      with: {
        turma: {
          with: { stage: true },
        },
      },
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    if (plano.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você só pode devolver planos da sua unidade",
      );
    }

    // Verificar segmento
    const turmaComStage = plano.turma as { stage?: { code: string } };
    const segmentosPermitidos = getSegmentosPermitidos(user.role);
    if (
      segmentosPermitidos !== null &&
      !segmentosPermitidos.includes(turmaComStage?.stage?.code || "")
    ) {
      throw new ForbiddenException(
        "Você só pode devolver planos do seu segmento",
      );
    }

    if (plano.status !== "AGUARDANDO_COORDENADORA") {
      throw new BadRequestException(
        `Não é possível devolver plano com status ${plano.status}`,
      );
    }

    // Inserir comentários se fornecidos
    if (dto.comentarios && dto.comentarios.length > 0) {
      await this.inserirComentarios(user.userId, dto.comentarios);
    }

    // Determinar status baseado no destino
    const novoStatus: PlanoAulaStatus =
      dto.destino === "ANALISTA"
        ? "AGUARDANDO_ANALISTA" // Volta para reanálise
        : "DEVOLVIDO_COORDENADORA"; // Volta para professora

    const [atualizado] = await db
      .update(planoAula)
      .set({
        status: novoStatus,
        updatedAt: new Date(),
      })
      .where(eq(planoAula.id, planoId))
      .returning();

    return atualizado;
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

    // Buscar todos os planos da unidade com turma e stage
    const planos = await db.query.planoAula.findMany({
      where: eq(planoAula.unitId, targetUnitId),
      with: {
        turma: {
          with: { stage: true },
        },
      },
    });

    // Agrupar por status
    const totais: DashboardItem[] = [];
    const statusCount: Record<string, number> = {};

    for (const plano of planos) {
      statusCount[plano.status] = (statusCount[plano.status] || 0) + 1;
    }

    for (const [status, count] of Object.entries(statusCount)) {
      totais.push({ status: status as PlanoAulaStatus, count });
    }

    // Agrupar por segmento
    const porSegmento: Record<string, DashboardItem[]> = {};

    for (const plano of planos) {
      const turmaComStage = plano.turma as { stage?: { code: string } };
      const segmento = turmaComStage?.stage?.code || "SEM_SEGMENTO";

      if (!porSegmento[segmento]) {
        porSegmento[segmento] = [];
      }

      const existente = porSegmento[segmento].find(
        (item) => item.status === plano.status,
      );
      if (existente) {
        existente.count++;
      } else {
        porSegmento[segmento].push({
          status: plano.status,
          count: 1,
          segmento,
        });
      }
    }

    return { totais, porSegmento };
  }

  /**
   * Define deadline para quinzena em uma unidade
   */
  async setDeadline(user: UserContext, dto: SetDeadlineDto): Promise<void> {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    // UPSERT: atualiza se existe, cria se não
    await db
      .insert(quinzenaConfig)
      .values({
        unitId: user.unitId,
        quinzenaId: dto.quinzenaId,
        deadline: new Date(dto.deadline),
        createdBy: user.userId,
      })
      .onConflictDoUpdate({
        target: [quinzenaConfig.unitId, quinzenaConfig.quinzenaId],
        set: {
          deadline: new Date(dto.deadline),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Lista deadlines configurados para a unidade
   */
  async getDeadlines(user: UserContext): Promise<QuinzenaDeadline[]> {
    const db = getDb();

    if (!user.unitId) {
      throw new BadRequestException("Usuário não possui unidade associada");
    }

    const configs = await db.query.quinzenaConfig.findMany({
      where: eq(quinzenaConfig.unitId, user.unitId),
      orderBy: [desc(quinzenaConfig.quinzenaId)],
    });

    type QuinzenaConfigRow = (typeof configs)[number];
    return configs.map((c: QuinzenaConfigRow) => ({
      quinzenaId: c.quinzenaId,
      deadline: c.deadline,
      unitId: c.unitId,
    }));
  }

  // ============================================
  // Métodos Auxiliares
  // ============================================

  /**
   * Adiciona comentário a um documento
   */
  async addComentario(
    user: UserContext,
    dto: AddComentarioDto,
  ): Promise<DocumentoComentario> {
    const db = getDb();

    // Verificar se documento existe e usuário tem acesso
    const documento = await db.query.planoDocumento.findFirst({
      where: eq(planoDocumento.id, dto.documentoId),
      with: { plano: true },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    // Verificar acesso ao plano
    if (documento.plano.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você não tem permissão para comentar neste documento",
      );
    }

    const [comentario] = await db
      .insert(documentoComentario)
      .values({
        documentoId: dto.documentoId,
        autorId: user.userId,
        comentario: dto.comentario,
      })
      .returning();

    return comentario;
  }

  /**
   * Insere múltiplos comentários (usado ao devolver plano)
   */
  private async inserirComentarios(
    autorId: string,
    comentarios: Array<{ documentoId: string; comentario: string }>,
  ): Promise<void> {
    const db = getDb();

    for (const c of comentarios) {
      await db.insert(documentoComentario).values({
        documentoId: c.documentoId,
        autorId,
        comentario: c.comentario,
      });
    }
  }

  /**
   * Formata resposta do plano com documentos
   */
  private formatPlanoResponse(plano: PlanoAula & {
    user: { id: string; name: string };
    turma: { id: string; name: string; code: string };
    documentos?: Array<PlanoDocumento & {
      comentarios?: Array<DocumentoComentario & {
        autor: { id: string; name: string };
      }>;
    }>;
  }): PlanoComDocumentos {
    type DocType = PlanoDocumento & {
      comentarios?: Array<DocumentoComentario & {
        autor: { id: string; name: string };
      }>;
    };
    type ComentarioType = DocumentoComentario & {
      autor: { id: string; name: string };
    };

    return {
      ...plano,
      user: {
        id: plano.user.id,
        name: plano.user.name,
      },
      turma: {
        id: plano.turma.id,
        name: plano.turma.name,
        code: plano.turma.code,
      },
      documentos: (plano.documentos || []).map((doc: DocType) => ({
        ...doc,
        comentarios: (doc.comentarios || []).map((c: ComentarioType) => ({
          ...c,
          autor: {
            id: c.autor.id,
            name: c.autor.name,
          },
        })),
      })),
    };
  }

  /**
   * Lista planos do usuário (para professora ver seus próprios planos)
   */
  async listarMeusPlanos(
    user: UserContext,
    quinzenaId?: string,
  ): Promise<PlanoAula[]> {
    const db = getDb();

    const conditions = [eq(planoAula.userId, user.userId)];

    if (quinzenaId) {
      conditions.push(eq(planoAula.quinzenaId, quinzenaId));
    }

    const planos = await db.query.planoAula.findMany({
      where: and(...conditions),
      with: {
        turma: true,
        documentos: true,
      },
      orderBy: [desc(planoAula.updatedAt)],
    });

    return planos;
  }

  // ============================================
  // Métodos de Documentos
  // ============================================

  /**
   * Adiciona documento do tipo upload ao plano
   */
  async adicionarDocumentoUpload(
    planoId: string,
    dados: {
      tipo: "UPLOAD";
      fileName: string;
      fileKey: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    },
  ): Promise<PlanoDocumento> {
    const db = getDb();

    // Verificar se plano existe
    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    const [documento] = await db
      .insert(planoDocumento)
      .values({
        planoId,
        tipo: dados.tipo,
        fileName: dados.fileName,
        fileKey: dados.fileKey,
        fileUrl: dados.fileUrl,
        fileSize: dados.fileSize,
        mimeType: dados.mimeType,
      })
      .returning();

    return documento;
  }

  /**
   * Adiciona documento do tipo link (YouTube) ao plano
   */
  async adicionarDocumentoLink(
    planoId: string,
    dados: {
      tipo: "YOUTUBE";
      url: string;
      titulo?: string;
    },
  ): Promise<PlanoDocumento> {
    const db = getDb();

    // Verificar se plano existe
    const plano = await db.query.planoAula.findFirst({
      where: eq(planoAula.id, planoId),
    });

    if (!plano) {
      throw new NotFoundException("Plano não encontrado");
    }

    const [documento] = await db
      .insert(planoDocumento)
      .values({
        planoId,
        tipo: dados.tipo,
        linkUrl: dados.url,
        titulo: dados.titulo,
      })
      .returning();

    return documento;
  }

  /**
   * Remove documento de um plano
   */
  async removerDocumento(planoId: string, documentoId: string): Promise<void> {
    const db = getDb();

    // Verificar se documento existe e pertence ao plano
    const documento = await db.query.planoDocumento.findFirst({
      where: and(
        eq(planoDocumento.id, documentoId),
        eq(planoDocumento.planoId, planoId),
      ),
    });

    if (!documento) {
      throw new NotFoundException(
        "Documento não encontrado ou não pertence ao plano",
      );
    }

    // Deletar comentários do documento primeiro
    await db
      .delete(documentoComentario)
      .where(eq(documentoComentario.documentoId, documentoId));

    // Deletar documento
    await db.delete(planoDocumento).where(eq(planoDocumento.id, documentoId));
  }
}
