import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  eventoInscricoes,
  eventoInscricaoFilhos,
  eventoSorteios,
  type EventoInscricao,
  type EventoSorteio,
} from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import type {
  CriarInscricaoDto,
  ListarInscricoesDto,
} from "./dto/evento-inscricoes.dto";

export interface InscricaoComFilhos extends EventoInscricao {
  filhos: Array<{
    id: string;
    nome: string;
    turma: string;
  }>;
}

export interface SorteioEvento {
  id: string;
  eventoSlug: string;
  brinde: string;
  inscricaoId: string;
  numeroInscricao: string;
  nome: string;
  telefone: string;
  email: string;
  sorteadoEm: Date;
  sorteadoPor: string | null;
}

/**
 * Deadlines de inscrição por evento (em ISO 8601 com fuso horário).
 * Após esse instante, novas inscrições são recusadas com 403.
 */
const DEADLINES_INSCRICAO: Record<string, string> = {
  // 13/05/2026 23:59:59 horário de Brasília
  "mae-por-inteiro": "2026-05-13T23:59:59-03:00",
};

@Injectable()
export class EventoInscricoesService {
  private readonly logger = new Logger(EventoInscricoesService.name);
  private static readonly MAX_TENTATIVAS_NUMERO = 12;

  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.db;
  }

  private async listarFilhos(
    inscricaoId: string,
  ): Promise<InscricaoComFilhos["filhos"]> {
    const filhos = await this.db
      .select()
      .from(eventoInscricaoFilhos)
      .where(eq(eventoInscricaoFilhos.inscricaoId, inscricaoId))
      .orderBy(asc(eventoInscricaoFilhos.createdAt));

    return filhos.map(
      (f: { id: string; nomeFilho: string; turmaFilho: string }) => ({
        id: f.id,
        nome: f.nomeFilho,
        turma: f.turmaFilho,
      }),
    );
  }

  private montarSorteioEvento(
    sorteio: EventoSorteio,
    inscricao: EventoInscricao,
  ): SorteioEvento {
    return {
      id: sorteio.id,
      eventoSlug: sorteio.eventoSlug,
      brinde: sorteio.brinde,
      inscricaoId: sorteio.inscricaoId,
      numeroInscricao: sorteio.numeroInscricao,
      nome: inscricao.nome,
      telefone: inscricao.telefone,
      email: inscricao.email,
      sorteadoEm: sorteio.sorteadoEm,
      sorteadoPor: sorteio.sorteadoPor,
    };
  }

  /**
   * Retorna o timestamp (ms) do deadline do evento, ou null se não houver.
   */
  private getDeadlineMs(eventoSlug: string): number | null {
    const iso = DEADLINES_INSCRICAO[eventoSlug];
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }

  /**
   * Status público das inscrições de um evento (para a landing consultar).
   */
  obterStatus(eventoSlug: string): {
    eventoSlug: string;
    deadline: string | null;
    inscricoesAbertas: boolean;
  } {
    const deadlineIso = DEADLINES_INSCRICAO[eventoSlug] ?? null;
    const deadlineMs = this.getDeadlineMs(eventoSlug);
    const inscricoesAbertas =
      deadlineMs === null ? true : Date.now() <= deadlineMs;
    return { eventoSlug, deadline: deadlineIso, inscricoesAbertas };
  }

  /**
   * Gera um número de inscrição aleatório no formato "XXX-XXX".
   * 6 dígitos (000000–999999), 1.000.000 combinações possíveis.
   */
  private gerarNumeroInscricao(): string {
    const n = Math.floor(Math.random() * 1_000_000);
    const s = n.toString().padStart(6, "0");
    return `${s.slice(0, 3)}-${s.slice(3)}`;
  }

  /**
   * Cria uma inscrição com seus filhos em uma transação.
   * Retorna a inscrição completa.
   */
  async criar(
    eventoSlug: string,
    dto: CriarInscricaoDto,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<InscricaoComFilhos> {
    // Validar deadline de inscrição
    const deadline = this.getDeadlineMs(eventoSlug);
    if (deadline !== null && Date.now() > deadline) {
      throw new ForbiddenException(
        "As inscrições para este evento estão encerradas.",
      );
    }

    // Validar duplicidade (CPF + evento)
    const existente = await this.db
      .select({ id: eventoInscricoes.id })
      .from(eventoInscricoes)
      .where(
        and(
          eq(eventoInscricoes.eventoSlug, eventoSlug),
          eq(eventoInscricoes.cpf, dto.cpf),
        ),
      )
      .limit(1);

    if (existente.length > 0) {
      throw new ConflictException(
        "Já existe uma inscrição para este CPF neste evento.",
      );
    }

    // Inserir inscrição com retry em caso de colisão de número (race condition)
    let inscricao: EventoInscricao | undefined;
    let ultimoErro: unknown = null;
    for (
      let tentativa = 1;
      tentativa <= EventoInscricoesService.MAX_TENTATIVAS_NUMERO;
      tentativa++
    ) {
      const numeroInscricao = this.gerarNumeroInscricao();
      try {
        const inserted = await this.db
          .insert(eventoInscricoes)
          .values({
            eventoSlug,
            numeroInscricao,
            nome: dto.nome,
            cpf: dto.cpf,
            dataNascimento: dto.dataNascimento,
            email: dto.email,
            telefone: dto.telefone,
            ipAddress: metadata.ipAddress ?? null,
            userAgent: metadata.userAgent ?? null,
          })
          .returning();
        inscricao = inserted[0];
        break;
      } catch (err) {
        // Postgres unique violation = 23505. Se for o índice de numero,
        // tentamos de novo com outro número aleatório.
        const code = (err as { code?: string })?.code;
        const constraint = (err as { constraint?: string })?.constraint;
        if (
          code === "23505" &&
          constraint === "uq_evento_inscricoes_evento_numero"
        ) {
          ultimoErro = err;
          this.logger.warn(
            `Colisão de número de inscrição (tentativa ${tentativa}); gerando outro.`,
          );
          continue;
        }
        // Outras violações (ex: cpf duplicado por race condition) sobem
        if (
          code === "23505" &&
          constraint === "uq_evento_inscricoes_evento_cpf"
        ) {
          throw new ConflictException(
            "Já existe uma inscrição para este CPF neste evento.",
          );
        }
        throw err;
      }
    }

    if (!inscricao) {
      this.logger.error("Esgotadas as tentativas de gerar número único", {
        ultimoErro,
      });
      throw new Error("Falha ao gerar número de inscrição único");
    }

    // Inserir filhos (array pode ser vazio para convidadas externas)
    const filhosInseridos =
      dto.filhos.length > 0
        ? await this.db
            .insert(eventoInscricaoFilhos)
            .values(
              dto.filhos.map((f) => ({
                inscricaoId: inscricao!.id,
                nomeFilho: f.nome,
                turmaFilho: f.turma,
              })),
            )
            .returning()
        : [];

    this.logger.log(
      `Nova inscrição: evento=${eventoSlug} numero=${inscricao.numeroInscricao} cpf=${dto.cpf} filhos=${dto.filhos.length}`,
    );

    return {
      ...inscricao,
      filhos: filhosInseridos.map(
        (f: { id: string; nomeFilho: string; turmaFilho: string }) => ({
          id: f.id,
          nome: f.nomeFilho,
          turma: f.turmaFilho,
        }),
      ),
    };
  }

  /**
   * Lista as inscrições de um evento, com filtros opcionais.
   */
  async listar(
    eventoSlug: string,
    filtros: ListarInscricoesDto,
  ): Promise<{
    items: InscricaoComFilhos[];
    total: number;
  }> {
    const baseCondicao = eq(eventoInscricoes.eventoSlug, eventoSlug);
    const buscaCondicao =
      filtros.q && filtros.q.length > 0
        ? or(
            ilike(eventoInscricoes.numeroInscricao, `%${filtros.q}%`),
            ilike(eventoInscricoes.nome, `%${filtros.q}%`),
            ilike(eventoInscricoes.cpf, `%${filtros.q}%`),
            ilike(eventoInscricoes.email, `%${filtros.q}%`),
            ilike(eventoInscricoes.telefone, `%${filtros.q}%`),
          )
        : undefined;
    const presencaCondicao = filtros.somentePresentes
      ? isNotNull(eventoInscricoes.presencaConfirmadaEm)
      : undefined;
    const where = and(baseCondicao, buscaCondicao, presencaCondicao);

    // Total para paginação
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventoInscricoes)
      .where(where);
    const total = totalRow?.count ?? 0;

    const inscricoes = await this.db
      .select()
      .from(eventoInscricoes)
      .where(where)
      .orderBy(desc(eventoInscricoes.createdAt))
      .limit(filtros.limit)
      .offset(filtros.offset);

    if (inscricoes.length === 0) {
      return { items: [], total };
    }

    const ids = inscricoes.map((i: EventoInscricao) => i.id);

    // Buscar filhos de todas as inscrições em batch
    const turmaFiltro = filtros.turma;
    const filhosWhere = turmaFiltro
      ? and(
          inArray(eventoInscricaoFilhos.inscricaoId, ids),
          eq(eventoInscricaoFilhos.turmaFilho, turmaFiltro),
        )
      : inArray(eventoInscricaoFilhos.inscricaoId, ids);

    const todosFilhos = await this.db
      .select()
      .from(eventoInscricaoFilhos)
      .where(filhosWhere)
      .orderBy(asc(eventoInscricaoFilhos.createdAt));

    // Indexar filhos por inscricaoId
    const filhosPorInscricao = new Map<
      string,
      Array<{ id: string; nome: string; turma: string }>
    >();
    for (const f of todosFilhos) {
      const arr = filhosPorInscricao.get(f.inscricaoId) ?? [];
      arr.push({ id: f.id, nome: f.nomeFilho, turma: f.turmaFilho });
      filhosPorInscricao.set(f.inscricaoId, arr);
    }

    let items: InscricaoComFilhos[] = inscricoes.map((i: EventoInscricao) => ({
      ...i,
      filhos: filhosPorInscricao.get(i.id) ?? [],
    }));

    // Se filtrou por turma, removemos inscrições sem filhos da turma desejada
    if (turmaFiltro && turmaFiltro.length > 0) {
      items = items.filter((i) => i.filhos.length > 0);
    }

    return { items, total };
  }

  /**
   * Detalhes de uma inscrição.
   */
  async obter(
    eventoSlug: string,
    id: string,
  ): Promise<InscricaoComFilhos> {
    const [inscricao] = await this.db
      .select()
      .from(eventoInscricoes)
      .where(
        and(
          eq(eventoInscricoes.id, id),
          eq(eventoInscricoes.eventoSlug, eventoSlug),
        ),
      )
      .limit(1);

    if (!inscricao) {
      throw new NotFoundException("Inscrição não encontrada");
    }

    const filhos = await this.listarFilhos(id);

    return {
      ...inscricao,
      filhos,
    };
  }

  async atualizarPresenca(
    eventoSlug: string,
    id: string,
    presente: boolean,
    userId: string,
  ): Promise<InscricaoComFilhos> {
    const [inscricao] = await this.db
      .update(eventoInscricoes)
      .set({
        presencaConfirmadaEm: presente ? new Date() : null,
        presencaConfirmadaPor: presente ? userId : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(eventoInscricoes.id, id),
          eq(eventoInscricoes.eventoSlug, eventoSlug),
        ),
      )
      .returning();

    if (!inscricao) {
      throw new NotFoundException("Inscrição não encontrada");
    }

    const filhos = await this.listarFilhos(id);

    return {
      ...inscricao,
      filhos,
    };
  }

  async listarSorteios(eventoSlug: string): Promise<SorteioEvento[]> {
    const sorteios = await this.db
      .select({
        id: eventoSorteios.id,
        eventoSlug: eventoSorteios.eventoSlug,
        brinde: eventoSorteios.brinde,
        inscricaoId: eventoSorteios.inscricaoId,
        numeroInscricao: eventoSorteios.numeroInscricao,
        sorteadoEm: eventoSorteios.sorteadoEm,
        sorteadoPor: eventoSorteios.sorteadoPor,
        nome: eventoInscricoes.nome,
        telefone: eventoInscricoes.telefone,
        email: eventoInscricoes.email,
      })
      .from(eventoSorteios)
      .innerJoin(
        eventoInscricoes,
        eq(eventoSorteios.inscricaoId, eventoInscricoes.id),
      )
      .where(eq(eventoSorteios.eventoSlug, eventoSlug))
      .orderBy(desc(eventoSorteios.sorteadoEm));

    return sorteios.map(
      (s: {
        id: string;
        eventoSlug: string;
        brinde: string;
        inscricaoId: string;
        numeroInscricao: string;
        nome: string;
        telefone: string;
        email: string;
        sorteadoEm: Date;
        sorteadoPor: string | null;
      }) => ({
        id: s.id,
        eventoSlug: s.eventoSlug,
        brinde: s.brinde,
        inscricaoId: s.inscricaoId,
        numeroInscricao: s.numeroInscricao,
        nome: s.nome,
        telefone: s.telefone,
        email: s.email,
        sorteadoEm: s.sorteadoEm,
        sorteadoPor: s.sorteadoPor,
      }),
    );
  }

  async sortearBrinde(
    eventoSlug: string,
    brinde: string,
    userId: string,
  ): Promise<SorteioEvento> {
    const brindeNormalizado = brinde.trim();
    if (!brindeNormalizado) {
      throw new BadRequestException("Informe o nome do brinde");
    }

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        return await this.db.transaction(async (tx: typeof this.db) => {
          const [ganhadora] = await tx
            .select()
            .from(eventoInscricoes)
            .where(
              and(
                eq(eventoInscricoes.eventoSlug, eventoSlug),
                isNotNull(eventoInscricoes.presencaConfirmadaEm),
                sql`not exists (
                  select 1
                  from evento_sorteios s
                  where s.evento_slug = ${eventoInscricoes.eventoSlug}
                    and s.inscricao_id = ${eventoInscricoes.id}
                )`,
              ),
            )
            .orderBy(sql`random()`)
            .limit(1);

          if (!ganhadora) {
            throw new BadRequestException(
              "Não há inscritas presentes elegíveis para sorteio.",
            );
          }

          const [sorteio] = await tx
            .insert(eventoSorteios)
            .values({
              eventoSlug,
              brinde: brindeNormalizado,
              inscricaoId: ganhadora.id,
              numeroInscricao: ganhadora.numeroInscricao,
              sorteadoPor: userId,
            })
            .returning();

          return this.montarSorteioEvento(sorteio, ganhadora);
        });
      } catch (err) {
        const code = (err as { code?: string })?.code;
        const constraint = (err as { constraint?: string })?.constraint;
        if (
          code === "23505" &&
          constraint === "uq_evento_sorteios_evento_inscricao" &&
          tentativa < 3
        ) {
          continue;
        }
        throw err;
      }
    }

    throw new ServiceUnavailableException(
      "Não foi possível concluir o sorteio. Tente novamente.",
    );
  }
}
