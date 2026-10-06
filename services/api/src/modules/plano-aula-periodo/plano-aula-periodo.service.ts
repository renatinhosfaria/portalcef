import { Injectable, BadRequestException } from "@nestjs/common";
import { eq, and, asc, getDb, inArray } from "@essencia/db";
import {
  planoAula,
  planoAulaPeriodo,
  type PlanoAulaPeriodo,
  turmas,
  educationStages,
} from "@essencia/db/schema";
import {
  CriarPeriodoDto,
  EditarPeriodoDto,
} from "./dto/plano-aula-periodo.dto";

type DbInstance = ReturnType<typeof getDb>;
type DbTransaction = Parameters<DbInstance["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

@Injectable()
export class PlanoAulaPeriodoService {
  private get db() {
    return getDb();
  }

  async listarPorUnidade(unidadeId: string) {
    const periodos: PlanoAulaPeriodo[] = await this.db
      .select()
      .from(planoAulaPeriodo)
      .where(eq(planoAulaPeriodo.unidadeId, unidadeId))
      .orderBy(asc(planoAulaPeriodo.etapa), asc(planoAulaPeriodo.numero));

    if (periodos.length === 0) {
      return [];
    }

    const planos = await this.db
      .select({ periodoId: planoAula.planoAulaPeriodoId })
      .from(planoAula)
      .where(
        inArray(
          planoAula.planoAulaPeriodoId,
          periodos.map((periodo) => periodo.id),
        ),
      );
    const quantidades = new Map<string, number>();
    for (const plano of planos) {
      if (plano.periodoId) {
        quantidades.set(
          plano.periodoId,
          (quantidades.get(plano.periodoId) ?? 0) + 1,
        );
      }
    }

    return periodos.map((periodo) => ({
      ...periodo,
      planosVinculados: quantidades.get(periodo.id) ?? 0,
    }));
  }

  async buscarPorId(id: string, unitId: string) {
    const [periodo] = await this.db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.id, id),
          eq(planoAulaPeriodo.unidadeId, unitId),
        ),
      );

    if (!periodo) {
      throw new BadRequestException("Período não encontrado");
    }

    return periodo;
  }

  async buscarPorTurma(turmaId: string, unitId: string) {
    // 1. Buscar etapa da turma E validar tenant
    const [turma] = await this.db
      .select({
        turmaId: turmas.id,
        stageId: turmas.stageId,
        etapaCode: educationStages.code,
      })
      .from(turmas)
      .innerJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(and(eq(turmas.id, turmaId), eq(turmas.unitId, unitId)));

    if (!turma) {
      throw new BadRequestException("Turma não encontrada");
    }

    // 2. Buscar períodos da etapa da turma
    return this.db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unitId),
          eq(planoAulaPeriodo.etapa, turma.etapaCode),
        ),
      )
      .orderBy(asc(planoAulaPeriodo.numero));
  }

  async criarPeriodo(unidadeId: string, userId: string, dto: CriarPeriodoDto) {
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);

    // Validar se as datas são válidas (não são NaN)
    if (isNaN(dataInicio.getTime())) {
      throw new BadRequestException("Data de início inválida");
    }
    if (isNaN(dataFim.getTime())) {
      throw new BadRequestException("Data de fim inválida");
    }
    if (isNaN(dataMaximaEntrega.getTime())) {
      throw new BadRequestException("Data máxima de entrega inválida");
    }

    if (dataInicio >= dataFim) {
      throw new BadRequestException(
        "Data de início deve ser anterior à data de fim",
      );
    }

    if (dataMaximaEntrega >= dataInicio) {
      throw new BadRequestException(
        "Data máxima de entrega deve ser anterior ao início do período",
      );
    }

    // Verificar sobreposição
    const sobrepostos = await this.verificarSobreposicao(
      unidadeId,
      dto.etapa,
      dataInicio,
      dataFim,
    );
    if (sobrepostos.length > 0) {
      throw new BadRequestException(
        "As datas se sobrepõem a um período existente",
      );
    }

    return this.db.transaction(async (tx: DbTransaction) => {
      const periodos = await this.buscarPeriodosPorEtapa(
        unidadeId,
        dto.etapa,
        tx,
      );
      const numero = this.calcularNumeroNaLista(periodos, dataInicio);
      const numeroTemporario = this.calcularNumeroTemporario(periodos);

      // Inserir fora da faixa final evita colisão com o número que será deslocado.
      const [periodo] = await tx
        .insert(planoAulaPeriodo)
        .values({
          unidadeId,
          etapa: dto.etapa,
          numero: numeroTemporario,
          descricao: dto.descricao,
          dataInicio: dto.dataInicio,
          dataFim: dto.dataFim,
          dataMaximaEntrega: dto.dataMaximaEntrega,
          criadoPor: userId,
        })
        .returning();

      await this.renumerarPeriodosSeNecessario(unidadeId, dto.etapa, tx);

      return { ...periodo, numero };
    });
  }

  async editarPeriodo(id: string, unitId: string, dto: EditarPeriodoDto) {
    const periodoExistente = await this.buscarPorId(id, unitId);

    // Validar datas se foram fornecidas
    if (dto.dataInicio || dto.dataFim) {
      const dataInicio = dto.dataInicio
        ? new Date(dto.dataInicio)
        : new Date(periodoExistente.dataInicio);

      const dataFim = dto.dataFim
        ? new Date(dto.dataFim)
        : new Date(periodoExistente.dataFim);

      if (isNaN(dataInicio.getTime())) {
        throw new BadRequestException("Data de início inválida");
      }
      if (isNaN(dataFim.getTime())) {
        throw new BadRequestException("Data de fim inválida");
      }

      if (dataInicio >= dataFim) {
        throw new BadRequestException(
          "Data de início deve ser anterior à data de fim",
        );
      }

      // Verificar sobreposição (exceto com o próprio período)
      const sobrepostos = await this.verificarSobreposicao(
        periodoExistente.unidadeId,
        periodoExistente.etapa,
        dataInicio,
        dataFim,
        id, // Excluir o próprio período da verificação
      );

      if (sobrepostos.length > 0) {
        throw new BadRequestException(
          "As datas se sobrepõem a um período existente",
        );
      }
    }

    // Validar os valores efetivos, inclusive quando apenas outra data foi alterada.
    const dataMaximaEntrega = new Date(
      dto.dataMaximaEntrega ?? periodoExistente.dataMaximaEntrega,
    );
    const dataInicioEfetiva = new Date(
      dto.dataInicio ?? periodoExistente.dataInicio,
    );

    if (isNaN(dataMaximaEntrega.getTime())) {
      throw new BadRequestException("Data máxima de entrega inválida");
    }

    if (dataMaximaEntrega >= dataInicioEfetiva) {
      throw new BadRequestException(
        "Data máxima de entrega deve ser anterior ao início do período",
      );
    }

    // Atualizar período
    return this.db.transaction(async (tx: DbTransaction) => {
      const [periodoAtualizado] = await tx
        .update(planoAulaPeriodo)
        .set({
          ...dto,
          atualizadoEm: new Date(),
        })
        .where(
          and(
            eq(planoAulaPeriodo.id, id),
            eq(planoAulaPeriodo.unidadeId, unitId),
          ),
        )
        .returning();

      if (dto.dataInicio) {
        await this.renumerarPeriodosSeNecessario(
          periodoExistente.unidadeId,
          periodoExistente.etapa,
          tx,
        );
      }

      return periodoAtualizado;
    });
  }

  async excluirPeriodo(id: string, unitId: string) {
    const periodo = await this.buscarPorId(id, unitId);

    const planosVinculados = await this.contarPlanosVinculados(id);
    if (planosVinculados > 0) {
      throw new BadRequestException(
        `Não é possível excluir. ${planosVinculados} professoras já iniciaram este período.`,
      );
    }

    await this.db.transaction(async (tx: DbTransaction) => {
      await tx
        .delete(planoAulaPeriodo)
        .where(
          and(
            eq(planoAulaPeriodo.id, id),
            eq(planoAulaPeriodo.unidadeId, unitId),
          ),
        );

      await this.renumerarPeriodosSeNecessario(
        periodo.unidadeId,
        periodo.etapa,
        tx,
      );
    });

    return { success: true, message: "Período excluído com sucesso" };
  }

  private async contarPlanosVinculados(periodoId: string): Promise<number> {
    const planos = await this.db
      .select({ periodoId: planoAula.planoAulaPeriodoId })
      .from(planoAula)
      .where(eq(planoAula.planoAulaPeriodoId, periodoId));

    return planos.length;
  }

  private async verificarSobreposicao(
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
    dataFim: Date,
    idExcluir?: string,
  ) {
    const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

    return periodos.filter((periodo: PlanoAulaPeriodo) => {
      // Excluir o próprio período da verificação
      if (idExcluir && periodo.id === idExcluir) {
        return false;
      }

      const inicio = new Date(periodo.dataInicio);
      const fim = new Date(periodo.dataFim);

      // Verifica se há sobreposição
      return dataInicio <= fim && dataFim >= inicio;
    });
  }

  private async buscarPeriodosPorEtapa(
    unidadeId: string,
    etapa: string,
    db: DbInstance | DbTransaction = this.db,
  ) {
    return this.buscarPeriodosPorEtapaNoBanco(unidadeId, etapa, db);
  }

  private async buscarPeriodosPorEtapaNoBanco(
    unidadeId: string,
    etapa: string,
    db: DbInstance | DbTransaction,
  ) {
    return db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unidadeId),
          eq(planoAulaPeriodo.etapa, etapa),
        ),
      );
  }

  private calcularNumeroNaLista(
    periodos: PlanoAulaPeriodo[],
    dataInicio: Date,
  ): number {
    const periodosOrdenados = [...periodos].sort(
      (a: PlanoAulaPeriodo, b: PlanoAulaPeriodo) =>
        new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
    );

    let posicao = 1;
    for (const periodo of periodosOrdenados) {
      if (dataInicio < new Date(periodo.dataInicio)) {
        break;
      }
      posicao++;
    }

    return posicao;
  }

  private calcularNumeroTemporario(periodos: PlanoAulaPeriodo[]): number {
    const numeros = new Set(periodos.map((periodo) => periodo.numero));
    let numero = -1;
    while (numeros.has(numero)) {
      numero -= 1;
    }
    return numero;
  }

  private async calcularProximoNumero(
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
  ): Promise<number> {
    const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

    if (periodos.length === 0) {
      return 1;
    }

    const periodosOrdenados = periodos.sort(
      (a: PlanoAulaPeriodo, b: PlanoAulaPeriodo) =>
        new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
    );

    let posicao = 1;
    for (const periodo of periodosOrdenados) {
      if (dataInicio < new Date(periodo.dataInicio)) {
        break;
      }
      posicao++;
    }

    return posicao;
  }

  private async renumerarPeriodosSeNecessario(
    unidadeId: string,
    etapa: string,
    db: DbInstance | DbTransaction = this.db,
  ) {
    const periodos: Array<Pick<PlanoAulaPeriodo, "id" | "numero">> = await db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unidadeId),
          eq(planoAulaPeriodo.etapa, etapa),
        ),
      )
      .orderBy(asc(planoAulaPeriodo.dataInicio));

    const alteracoes = periodos.filter(
      (periodo, indice) => periodo.numero !== indice + 1,
    );

    // Primeiro tira todos os registros da faixa final. Isso evita colisões com
    // o índice único quando um período entra no meio ou muda de posição.
    const numerosAtuais = new Set(periodos.map((periodo) => periodo.numero));
    let numeroTemporario = -1;
    for (let i = 0; i < alteracoes.length; i++) {
      while (numerosAtuais.has(numeroTemporario)) {
        numeroTemporario -= 1;
      }
      await db
        .update(planoAulaPeriodo)
        .set({ numero: numeroTemporario, atualizadoEm: new Date() })
        .where(eq(planoAulaPeriodo.id, alteracoes[i].id));
      numerosAtuais.add(numeroTemporario);
      numeroTemporario -= 1;
    }

    for (let i = 0; i < periodos.length; i++) {
      const numeroCorreto = i + 1;
      if (periodos[i].numero !== numeroCorreto) {
        await db
          .update(planoAulaPeriodo)
          .set({ numero: numeroCorreto, atualizadoEm: new Date() })
          .where(eq(planoAulaPeriodo.id, periodos[i].id));
      }
    }
  }
}
