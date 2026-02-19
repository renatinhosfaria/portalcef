import { Injectable, BadRequestException } from "@nestjs/common";
import { eq, and, asc, getDb } from "@essencia/db";
import {
  planoAulaPeriodo,
  type PlanoAulaPeriodo,
  turmas,
  educationStages,
} from "@essencia/db/schema";
import {
  CriarPeriodoDto,
  EditarPeriodoDto,
} from "./dto/plano-aula-periodo.dto";

@Injectable()
export class PlanoAulaPeriodoService {
  private get db() {
    return getDb();
  }

  async listarPorUnidade(unidadeId: string) {
    return this.db
      .select()
      .from(planoAulaPeriodo)
      .where(eq(planoAulaPeriodo.unidadeId, unidadeId))
      .orderBy(asc(planoAulaPeriodo.etapa), asc(planoAulaPeriodo.numero));
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

    // Debug logging
    if (!turma) {
      console.error(
        `buscarPorTurma failed: Turma not found. turmaId=${turmaId}, unitId=${unitId}`,
      );
      // Also check if turma exists without unit constraint/stage join to narrow down issue
      const simpleCheck = await this.db
        .select({ id: turmas.id, unitId: turmas.unitId })
        .from(turmas)
        .where(eq(turmas.id, turmaId))
        .limit(1);

      if (simpleCheck.length > 0) {
        console.error(
          `Turma exists but mismatch or join failure. Found:`,
          simpleCheck[0],
        );
      } else {
        console.error(`Turma ID does not exist in DB.`);
      }

      throw new BadRequestException("Turma não encontrada");
    }

    console.log(
      `buscarPorTurma: Found turma ${turmaId}, stage ${turma.etapaCode}`,
    );

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

    // Calcular número
    const numero = await this.calcularProximoNumero(
      unidadeId,
      dto.etapa,
      dataInicio,
    );

    // Criar período
    const [periodo] = await this.db
      .insert(planoAulaPeriodo)
      .values({
        unidadeId,
        etapa: dto.etapa,
        numero,
        descricao: dto.descricao,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        dataMaximaEntrega: dto.dataMaximaEntrega,
        criadoPor: userId,
      })
      .returning();

    // Renumerar se necessário
    await this.renumerarPeriodosSeNecessario(unidadeId, dto.etapa);

    return periodo;
  }

  async editarPeriodo(id: string, dto: EditarPeriodoDto) {
    // Buscar período existente
    const [periodoExistente] = await this.db
      .select()
      .from(planoAulaPeriodo)
      .where(eq(planoAulaPeriodo.id, id));

    if (!periodoExistente) {
      throw new BadRequestException("Período não encontrado");
    }

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

    // Validar dataMaximaEntrega se fornecida
    if (dto.dataMaximaEntrega) {
      const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);
      const dataInicio = dto.dataInicio
        ? new Date(dto.dataInicio)
        : new Date(periodoExistente.dataInicio);

      if (isNaN(dataMaximaEntrega.getTime())) {
        throw new BadRequestException("Data máxima de entrega inválida");
      }

      if (dataMaximaEntrega >= dataInicio) {
        throw new BadRequestException(
          "Data máxima de entrega deve ser anterior ao início do período",
        );
      }
    }

    // Atualizar período
    const [periodoAtualizado] = await this.db
      .update(planoAulaPeriodo)
      .set({
        ...dto,
        atualizadoEm: new Date(),
      })
      .where(eq(planoAulaPeriodo.id, id))
      .returning();

    // Se as datas mudaram, renumerar
    if (dto.dataInicio) {
      await this.renumerarPeriodosSeNecessario(
        periodoExistente.unidadeId,
        periodoExistente.etapa,
      );
    }

    return periodoAtualizado;
  }

  async excluirPeriodo(id: string) {
    // Buscar período
    const [periodo] = await this.db
      .select()
      .from(planoAulaPeriodo)
      .where(eq(planoAulaPeriodo.id, id));

    if (!periodo) {
      throw new BadRequestException("Período não encontrado");
    }

    // TODO: Verificar se há planos de aula vinculados
    // Quando o schema plano_aula for atualizado com periodoId

    // Excluir período
    await this.db.delete(planoAulaPeriodo).where(eq(planoAulaPeriodo.id, id));

    // Renumerar períodos restantes
    await this.renumerarPeriodosSeNecessario(periodo.unidadeId, periodo.etapa);

    return { success: true, message: "Período excluído com sucesso" };
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

  private async buscarPeriodosPorEtapa(unidadeId: string, etapa: string) {
    return this.db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unidadeId),
          eq(planoAulaPeriodo.etapa, etapa),
        ),
      );
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
  ) {
    const periodos = await this.db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unidadeId),
          eq(planoAulaPeriodo.etapa, etapa),
        ),
      )
      .orderBy(asc(planoAulaPeriodo.dataInicio));

    for (let i = 0; i < periodos.length; i++) {
      const numeroCorreto = i + 1;
      if (periodos[i].numero !== numeroCorreto) {
        await this.db
          .update(planoAulaPeriodo)
          .set({ numero: numeroCorreto, atualizadoEm: new Date() })
          .where(eq(planoAulaPeriodo.id, periodos[i].id));
      }
    }
  }
}
