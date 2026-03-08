import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  eq,
  and,
  desc,
  sql,
  ordemServico,
  ordemServicoMensagem,
  users,
} from "@essencia/db";
import type {
  OrdemServicoCategoria,
  OrdemServicoStatus,
  MensagemTipo,
} from "@essencia/db";
import type {
  CriarOrdemServicoDto,
  EnviarMensagemDto,
  AlterarStatusDto,
} from "./dto/suporte.dto";
import { DatabaseService } from "../../common/database/database.service";

// ============================================
// Constantes
// ============================================

const ADMIN_ROLES = ["master", "diretora_geral", "gerente_unidade"] as const;

// ============================================
// Types
// ============================================

/**
 * Contexto do usuario autenticado (vem da sessao)
 */
export interface UserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

/**
 * Representacao de um arquivo ja enviado ao storage
 */
export interface ArquivoUpload {
  url: string;
  nome: string;
  mimetype: string;
}

/**
 * Tipos auxiliares para transacoes do Drizzle
 */
type Db = ReturnType<DatabaseService["db"]["db"]>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

/**
 * Tipo de uma linha retornada na listagem de OS (com join)
 */
interface OrdemServicoRow {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  categoria: string;
  status: string;
  criadoPor: string;
  criadoPorNome: string | null;
  schoolId: string;
  unitId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tipo de uma linha retornada na listagem de mensagens (com join)
 */
interface MensagemRow {
  id: string;
  ordemServicoId: string;
  conteudo: string | null;
  tipo: string;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  criadoPor: string;
  criadoPorNome: string | null;
  criadoPorRole: string | null;
  createdAt: Date;
}

// ============================================
// Service
// ============================================

/**
 * SuporteService
 *
 * Service responsavel pelo gerenciamento de ordens de servico (OS):
 * - Abertura de OS por qualquer usuario autenticado
 * - Listagem com filtros e paginacao
 * - Mensagens de acompanhamento (chat)
 * - Alteracao de status (admin)
 * - Contagem por status
 */
@Injectable()
export class SuporteService {
  constructor(private readonly database: DatabaseService) {}

  // ============================================
  // Helpers Privados
  // ============================================

  /**
   * Verifica se o role informado e de administrador
   */
  private isAdmin(role: string): boolean {
    return (ADMIN_ROLES as readonly string[]).includes(role);
  }

  /**
   * Determina o tipo de mensagem a partir do mimetype do arquivo
   */
  private getTipoFromMimetype(mimetype: string): MensagemTipo {
    if (mimetype.startsWith("image/")) return "IMAGEM";
    if (mimetype.startsWith("video/")) return "VIDEO";
    if (mimetype.startsWith("audio/")) return "AUDIO";
    return "TEXTO";
  }

  // ============================================
  // Metodos Publicos
  // ============================================

  /**
   * Cria uma nova ordem de servico
   *
   * Insere a OS e a mensagem inicial (descricao) em uma transacao.
   * Se houver arquivos anexados, insere mensagens de midia tambem.
   *
   * @param dto Dados da OS (titulo, descricao, categoria)
   * @param arquivos Arquivos ja enviados ao storage
   * @param session Contexto do usuario
   * @returns Ordem de servico criada
   */
  async criar(
    dto: CriarOrdemServicoDto,
    arquivos: ArquivoUpload[],
    session: UserContext,
  ) {
    if (!session.schoolId) {
      throw new BadRequestException(
        "Sessao invalida: schoolId e obrigatorio",
      );
    }

    const db = this.database.db;

    return await db.transaction(async (tx: DbTransaction) => {
      // 1. Inserir a ordem de servico
      const [osCriada] = await tx
        .insert(ordemServico)
        .values({
          titulo: dto.titulo,
          descricao: dto.descricao,
          categoria: dto.categoria,
          status: "ABERTA",
          criadoPor: session.userId,
          schoolId: session.schoolId!,
          unitId: session.unitId,
        })
        .returning();

      if (!osCriada) {
        throw new BadRequestException("Falha ao criar ordem de servico");
      }

      // 2. Inserir mensagem inicial de texto (descricao)
      await tx.insert(ordemServicoMensagem).values({
        ordemServicoId: osCriada.id,
        conteudo: dto.descricao,
        tipo: "TEXTO",
        criadoPor: session.userId,
      });

      // 3. Inserir mensagens de midia para cada arquivo
      if (arquivos.length > 0) {
        const mensagensArquivos = arquivos.map((arquivo) => ({
          ordemServicoId: osCriada.id,
          conteudo: null as string | null,
          tipo: this.getTipoFromMimetype(arquivo.mimetype) as string,
          arquivoUrl: arquivo.url,
          arquivoNome: arquivo.nome,
          criadoPor: session.userId,
        }));

        await tx.insert(ordemServicoMensagem).values(mensagensArquivos);
      }

      return {
        id: osCriada.id,
        numero: osCriada.numero,
        titulo: osCriada.titulo,
        descricao: osCriada.descricao,
        categoria: osCriada.categoria,
        status: osCriada.status,
        criadoPor: osCriada.criadoPor,
        schoolId: osCriada.schoolId,
        unitId: osCriada.unitId,
        createdAt: osCriada.createdAt.toISOString(),
        updatedAt: osCriada.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Lista ordens de servico com filtros e paginacao
   *
   * - Admins veem todas as OS da escola
   * - Usuarios comuns veem apenas suas proprias OS
   *
   * @param session Contexto do usuario
   * @param filtros Filtros opcionais (status, categoria, page, limit)
   * @returns Lista paginada de OS com dados do criador
   */
  async listar(
    session: UserContext,
    filtros: {
      status?: OrdemServicoStatus;
      categoria?: OrdemServicoCategoria;
      page?: number;
      limit?: number;
    },
  ) {
    if (!session.schoolId) {
      throw new BadRequestException(
        "Sessao invalida: schoolId e obrigatorio",
      );
    }

    const db = this.database.db;
    const page = filtros.page || 1;
    const limit = Math.min(filtros.limit || 20, 50);
    const offset = (page - 1) * limit;

    // Construir condicoes de filtro
    const conditions: ReturnType<typeof eq>[] = [
      eq(ordemServico.schoolId, session.schoolId),
    ];

    // Usuarios comuns so veem suas proprias OS
    if (!this.isAdmin(session.role)) {
      conditions.push(eq(ordemServico.criadoPor, session.userId));
    }

    // Filtro por status
    if (filtros.status) {
      conditions.push(eq(ordemServico.status, filtros.status));
    }

    // Filtro por categoria
    if (filtros.categoria) {
      conditions.push(eq(ordemServico.categoria, filtros.categoria));
    }

    const whereClause = and(...conditions);

    // Buscar OS com join no usuario criador
    const ordensDb = await db
      .select({
        id: ordemServico.id,
        numero: ordemServico.numero,
        titulo: ordemServico.titulo,
        descricao: ordemServico.descricao,
        categoria: ordemServico.categoria,
        status: ordemServico.status,
        criadoPor: ordemServico.criadoPor,
        criadoPorNome: users.name,
        schoolId: ordemServico.schoolId,
        unitId: ordemServico.unitId,
        createdAt: ordemServico.createdAt,
        updatedAt: ordemServico.updatedAt,
      })
      .from(ordemServico)
      .leftJoin(users, eq(ordemServico.criadoPor, users.id))
      .where(whereClause)
      .orderBy(desc(ordemServico.createdAt))
      .limit(limit)
      .offset(offset);

    // Contar total para paginacao
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(ordemServico)
      .where(whereClause);

    const totalPages = Math.ceil(total / limit);

    return {
      data: ordensDb.map((os: OrdemServicoRow) => ({
        id: os.id,
        numero: os.numero,
        titulo: os.titulo,
        descricao: os.descricao,
        categoria: os.categoria,
        status: os.status,
        criadoPor: os.criadoPor,
        criadoPorNome: os.criadoPorNome ?? "Usuario desconhecido",
        schoolId: os.schoolId,
        unitId: os.unitId,
        createdAt: os.createdAt.toISOString(),
        updatedAt: os.updatedAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Busca uma ordem de servico por ID com todas as mensagens
   *
   * - Admins podem ver qualquer OS da escola
   * - Usuarios comuns so podem ver suas proprias OS
   *
   * @param id ID da ordem de servico
   * @param session Contexto do usuario
   * @returns OS com array de mensagens
   */
  async buscarPorId(id: string, session: UserContext) {
    if (!session.schoolId) {
      throw new BadRequestException(
        "Sessao invalida: schoolId e obrigatorio",
      );
    }

    const db = this.database.db;

    // Buscar OS com join no usuario criador
    const [osDb] = await db
      .select({
        id: ordemServico.id,
        numero: ordemServico.numero,
        titulo: ordemServico.titulo,
        descricao: ordemServico.descricao,
        categoria: ordemServico.categoria,
        status: ordemServico.status,
        criadoPor: ordemServico.criadoPor,
        criadoPorNome: users.name,
        schoolId: ordemServico.schoolId,
        unitId: ordemServico.unitId,
        createdAt: ordemServico.createdAt,
        updatedAt: ordemServico.updatedAt,
      })
      .from(ordemServico)
      .leftJoin(users, eq(ordemServico.criadoPor, users.id))
      .where(
        and(
          eq(ordemServico.id, id),
          eq(ordemServico.schoolId, session.schoolId),
        ),
      );

    if (!osDb) {
      throw new NotFoundException("Ordem de servico nao encontrada");
    }

    // Verificar acesso: admin OU criador da OS
    if (!this.isAdmin(session.role) && osDb.criadoPor !== session.userId) {
      throw new ForbiddenException(
        "Voce nao tem permissao para acessar esta ordem de servico",
      );
    }

    // Buscar todas as mensagens da OS com dados do usuario
    const mensagensDb = await db
      .select({
        id: ordemServicoMensagem.id,
        ordemServicoId: ordemServicoMensagem.ordemServicoId,
        conteudo: ordemServicoMensagem.conteudo,
        tipo: ordemServicoMensagem.tipo,
        arquivoUrl: ordemServicoMensagem.arquivoUrl,
        arquivoNome: ordemServicoMensagem.arquivoNome,
        criadoPor: ordemServicoMensagem.criadoPor,
        criadoPorNome: users.name,
        criadoPorRole: users.role,
        createdAt: ordemServicoMensagem.createdAt,
      })
      .from(ordemServicoMensagem)
      .leftJoin(users, eq(ordemServicoMensagem.criadoPor, users.id))
      .where(eq(ordemServicoMensagem.ordemServicoId, id))
      .orderBy(ordemServicoMensagem.createdAt);

    return {
      id: osDb.id,
      numero: osDb.numero,
      titulo: osDb.titulo,
      descricao: osDb.descricao,
      categoria: osDb.categoria,
      status: osDb.status,
      criadoPor: osDb.criadoPor,
      criadoPorNome: osDb.criadoPorNome ?? "Usuario desconhecido",
      schoolId: osDb.schoolId,
      unitId: osDb.unitId,
      createdAt: osDb.createdAt.toISOString(),
      updatedAt: osDb.updatedAt.toISOString(),
      mensagens: mensagensDb.map((msg: MensagemRow) => ({
        id: msg.id,
        ordemServicoId: msg.ordemServicoId,
        conteudo: msg.conteudo,
        tipo: msg.tipo,
        arquivoUrl: msg.arquivoUrl,
        arquivoNome: msg.arquivoNome,
        criadoPor: msg.criadoPor,
        criadoPorNome: msg.criadoPorNome ?? "Usuario desconhecido",
        criadoPorRole: msg.criadoPorRole ?? "desconhecido",
        createdAt: msg.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Envia mensagem(ns) em uma ordem de servico existente
   *
   * Suporta mensagem de texto e/ou arquivos anexos.
   * Nao permite envio em OS com status FECHADA.
   *
   * @param ordemServicoId ID da OS
   * @param dto Dados da mensagem (conteudo opcional)
   * @param arquivos Arquivos ja enviados ao storage
   * @param session Contexto do usuario
   * @returns Mensagens criadas
   */
  async enviarMensagem(
    ordemServicoId: string,
    dto: EnviarMensagemDto,
    arquivos: ArquivoUpload[],
    session: UserContext,
  ) {
    if (!session.schoolId) {
      throw new BadRequestException(
        "Sessao invalida: schoolId e obrigatorio",
      );
    }

    const db = this.database.db;

    // Buscar OS
    const [osDb] = await db
      .select()
      .from(ordemServico)
      .where(
        and(
          eq(ordemServico.id, ordemServicoId),
          eq(ordemServico.schoolId, session.schoolId),
        ),
      );

    if (!osDb) {
      throw new NotFoundException("Ordem de servico nao encontrada");
    }

    // Verificar acesso: admin OU criador da OS
    if (!this.isAdmin(session.role) && osDb.criadoPor !== session.userId) {
      throw new ForbiddenException(
        "Voce nao tem permissao para enviar mensagens nesta ordem de servico",
      );
    }

    // Nao permitir envio em OS fechada
    if (osDb.status === "FECHADA") {
      throw new BadRequestException(
        "Nao e possivel enviar mensagens em uma ordem de servico fechada",
      );
    }

    // Validar que tem conteudo ou arquivo
    if (!dto.conteudo && arquivos.length === 0) {
      throw new BadRequestException(
        "E necessario enviar um texto ou pelo menos um arquivo",
      );
    }

    const mensagensCriadas: Array<{
      id: string;
      ordemServicoId: string;
      conteudo: string | null;
      tipo: string;
      arquivoUrl: string | null;
      arquivoNome: string | null;
      criadoPor: string;
      createdAt: string;
    }> = [];

    // Inserir mensagem de texto se houver conteudo
    if (dto.conteudo) {
      const [msgTexto] = await db
        .insert(ordemServicoMensagem)
        .values({
          ordemServicoId,
          conteudo: dto.conteudo,
          tipo: "TEXTO",
          criadoPor: session.userId,
        })
        .returning();

      if (msgTexto) {
        mensagensCriadas.push({
          id: msgTexto.id,
          ordemServicoId: msgTexto.ordemServicoId,
          conteudo: msgTexto.conteudo,
          tipo: msgTexto.tipo,
          arquivoUrl: msgTexto.arquivoUrl,
          arquivoNome: msgTexto.arquivoNome,
          criadoPor: msgTexto.criadoPor,
          createdAt: msgTexto.createdAt.toISOString(),
        });
      }
    }

    // Inserir mensagens de midia para cada arquivo
    for (const arquivo of arquivos) {
      const [msgArquivo] = await db
        .insert(ordemServicoMensagem)
        .values({
          ordemServicoId,
          conteudo: null,
          tipo: this.getTipoFromMimetype(arquivo.mimetype),
          arquivoUrl: arquivo.url,
          arquivoNome: arquivo.nome,
          criadoPor: session.userId,
        })
        .returning();

      if (msgArquivo) {
        mensagensCriadas.push({
          id: msgArquivo.id,
          ordemServicoId: msgArquivo.ordemServicoId,
          conteudo: msgArquivo.conteudo,
          tipo: msgArquivo.tipo,
          arquivoUrl: msgArquivo.arquivoUrl,
          arquivoNome: msgArquivo.arquivoNome,
          criadoPor: msgArquivo.criadoPor,
          createdAt: msgArquivo.createdAt.toISOString(),
        });
      }
    }

    // Atualizar updatedAt da OS
    await db
      .update(ordemServico)
      .set({ updatedAt: new Date() })
      .where(eq(ordemServico.id, ordemServicoId));

    return mensagensCriadas;
  }

  /**
   * Altera o status de uma ordem de servico
   *
   * Apenas administradores podem alterar o status.
   *
   * @param id ID da OS
   * @param dto Novo status
   * @param session Contexto do usuario
   * @returns OS atualizada
   */
  async alterarStatus(id: string, dto: AlterarStatusDto, session: UserContext) {
    if (!session.schoolId) {
      throw new BadRequestException(
        "Sessao invalida: schoolId e obrigatorio",
      );
    }

    // Apenas admins podem alterar status
    if (!this.isAdmin(session.role)) {
      throw new ForbiddenException(
        "Apenas administradores podem alterar o status de uma ordem de servico",
      );
    }

    const db = this.database.db;

    // Buscar OS
    const [osDb] = await db
      .select()
      .from(ordemServico)
      .where(
        and(
          eq(ordemServico.id, id),
          eq(ordemServico.schoolId, session.schoolId),
        ),
      );

    if (!osDb) {
      throw new NotFoundException("Ordem de servico nao encontrada");
    }

    // Atualizar status e updatedAt
    const [osAtualizada] = await db
      .update(ordemServico)
      .set({
        status: dto.status,
        updatedAt: new Date(),
      })
      .where(eq(ordemServico.id, id))
      .returning();

    if (!osAtualizada) {
      throw new BadRequestException(
        "Falha ao atualizar status da ordem de servico",
      );
    }

    return {
      id: osAtualizada.id,
      numero: osAtualizada.numero,
      titulo: osAtualizada.titulo,
      descricao: osAtualizada.descricao,
      categoria: osAtualizada.categoria,
      status: osAtualizada.status,
      criadoPor: osAtualizada.criadoPor,
      schoolId: osAtualizada.schoolId,
      unitId: osAtualizada.unitId,
      createdAt: osAtualizada.createdAt.toISOString(),
      updatedAt: osAtualizada.updatedAt.toISOString(),
    };
  }

  /**
   * Retorna contagem de OS por status
   *
   * - Admins veem contagem de toda a escola
   * - Usuarios comuns veem apenas suas proprias OS
   *
   * @param session Contexto do usuario
   * @returns Contagem: total, abertas, emAndamento, resolvidas
   */
  async contagem(session: UserContext) {
    if (!session.schoolId) {
      throw new BadRequestException(
        "Sessao invalida: schoolId e obrigatorio",
      );
    }

    const db = this.database.db;

    // Construir condicoes base
    const conditions: ReturnType<typeof eq>[] = [
      eq(ordemServico.schoolId, session.schoolId),
    ];

    // Usuarios comuns so veem suas proprias OS
    if (!this.isAdmin(session.role)) {
      conditions.push(eq(ordemServico.criadoPor, session.userId));
    }

    const whereClause = and(...conditions);

    const [resultado] = await db
      .select({
        total: sql<number>`count(*)::int`,
        abertas: sql<number>`count(*) filter (where ${ordemServico.status} = 'ABERTA')::int`,
        emAndamento: sql<number>`count(*) filter (where ${ordemServico.status} = 'EM_ANDAMENTO')::int`,
        resolvidas: sql<number>`count(*) filter (where ${ordemServico.status} = 'RESOLVIDA')::int`,
      })
      .from(ordemServico)
      .where(whereClause);

    return {
      total: resultado?.total ?? 0,
      abertas: resultado?.abertas ?? 0,
      emAndamento: resultado?.emAndamento ?? 0,
      resolvidas: resultado?.resolvidas ?? 0,
    };
  }
}
