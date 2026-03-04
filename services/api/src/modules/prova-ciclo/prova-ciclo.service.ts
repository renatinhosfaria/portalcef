import { Injectable, BadRequestException } from "@nestjs/common";
import { eq, and, asc, getDb } from "@essencia/db";
import {
  provaCiclo,
  type ProvaCiclo,
  turmas,
  educationStages,
} from "@essencia/db/schema";
import { CriarCicloDto, EditarCicloDto } from "./dto/prova-ciclo.dto";

@Injectable()
export class ProvaCicloService {
  private get db() {
    return getDb();
  }

  async listarPorUnidade(unidadeId: string) {
    return this.db
      .select()
      .from(provaCiclo)
      .where(eq(provaCiclo.unidadeId, unidadeId))
      .orderBy(asc(provaCiclo.etapa), asc(provaCiclo.numero));
  }

  async buscarPorId(id: string, unitId: string) {
    const [ciclo] = await this.db
      .select()
      .from(provaCiclo)
      .where(
        and(eq(provaCiclo.id, id), eq(provaCiclo.unidadeId, unitId)),
      );

    if (!ciclo) {
      throw new BadRequestException("Ciclo de prova nao encontrado");
    }

    return ciclo;
  }

  async buscarPorTurma(turmaId: string, unitId: string) {
    // 1. Buscar etapa da turma e validar tenant
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
      throw new BadRequestException("Turma nao encontrada");
    }

    // 2. Buscar ciclos da etapa da turma
    return this.db
      .select()
      .from(provaCiclo)
      .where(
        and(
          eq(provaCiclo.unidadeId, unitId),
          eq(provaCiclo.etapa, turma.etapaCode),
        ),
      )
      .orderBy(asc(provaCiclo.numero));
  }

  async criarCiclo(unidadeId: string, userId: string, dto: CriarCicloDto) {
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);

    // Validar se as datas sao validas
    if (isNaN(dataInicio.getTime())) {
      throw new BadRequestException("Data de inicio invalida");
    }
    if (isNaN(dataFim.getTime())) {
      throw new BadRequestException("Data de fim invalida");
    }
    if (isNaN(dataMaximaEntrega.getTime())) {
      throw new BadRequestException("Data maxima de entrega invalida");
    }

    if (dataInicio >= dataFim) {
      throw new BadRequestException(
        "Data de inicio deve ser anterior a data de fim",
      );
    }

    if (dataMaximaEntrega >= dataInicio) {
      throw new BadRequestException(
        "Data maxima de entrega deve ser anterior ao inicio do ciclo",
      );
    }

    // Verificar sobreposicao
    const sobrepostos = await this.verificarSobreposicao(
      unidadeId,
      dto.etapa,
      dataInicio,
      dataFim,
    );
    if (sobrepostos.length > 0) {
      throw new BadRequestException(
        "As datas se sobrepoem a um ciclo existente",
      );
    }

    // Calcular numero
    const numero = await this.calcularProximoNumero(
      unidadeId,
      dto.etapa,
      dataInicio,
    );

    // Criar ciclo
    const [ciclo] = await this.db
      .insert(provaCiclo)
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

    // Renumerar se necessario
    await this.renumerarCiclosSeNecessario(unidadeId, dto.etapa);

    return ciclo;
  }

  async editarCiclo(id: string, dto: EditarCicloDto) {
    // Buscar ciclo existente
    const [cicloExistente] = await this.db
      .select()
      .from(provaCiclo)
      .where(eq(provaCiclo.id, id));

    if (!cicloExistente) {
      throw new BadRequestException("Ciclo de prova nao encontrado");
    }

    // Validar datas se foram fornecidas
    if (dto.dataInicio || dto.dataFim) {
      const dataInicio = dto.dataInicio
        ? new Date(dto.dataInicio)
        : new Date(cicloExistente.dataInicio);

      const dataFim = dto.dataFim
        ? new Date(dto.dataFim)
        : new Date(cicloExistente.dataFim);

      if (isNaN(dataInicio.getTime())) {
        throw new BadRequestException("Data de inicio invalida");
      }
      if (isNaN(dataFim.getTime())) {
        throw new BadRequestException("Data de fim invalida");
      }

      if (dataInicio >= dataFim) {
        throw new BadRequestException(
          "Data de inicio deve ser anterior a data de fim",
        );
      }

      // Verificar sobreposicao (exceto com o proprio ciclo)
      const sobrepostos = await this.verificarSobreposicao(
        cicloExistente.unidadeId,
        cicloExistente.etapa,
        dataInicio,
        dataFim,
        id,
      );

      if (sobrepostos.length > 0) {
        throw new BadRequestException(
          "As datas se sobrepoem a um ciclo existente",
        );
      }
    }

    // Validar dataMaximaEntrega se fornecida
    if (dto.dataMaximaEntrega) {
      const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);
      const dataInicio = dto.dataInicio
        ? new Date(dto.dataInicio)
        : new Date(cicloExistente.dataInicio);

      if (isNaN(dataMaximaEntrega.getTime())) {
        throw new BadRequestException("Data maxima de entrega invalida");
      }

      if (dataMaximaEntrega >= dataInicio) {
        throw new BadRequestException(
          "Data maxima de entrega deve ser anterior ao inicio do ciclo",
        );
      }
    }

    // Atualizar ciclo
    const [cicloAtualizado] = await this.db
      .update(provaCiclo)
      .set({
        ...dto,
        atualizadoEm: new Date(),
      })
      .where(eq(provaCiclo.id, id))
      .returning();

    // Se as datas mudaram, renumerar
    if (dto.dataInicio) {
      await this.renumerarCiclosSeNecessario(
        cicloExistente.unidadeId,
        cicloExistente.etapa,
      );
    }

    return cicloAtualizado;
  }

  async excluirCiclo(id: string) {
    // Buscar ciclo
    const [ciclo] = await this.db
      .select()
      .from(provaCiclo)
      .where(eq(provaCiclo.id, id));

    if (!ciclo) {
      throw new BadRequestException("Ciclo de prova nao encontrado");
    }

    // Excluir ciclo
    await this.db.delete(provaCiclo).where(eq(provaCiclo.id, id));

    // Renumerar ciclos restantes
    await this.renumerarCiclosSeNecessario(ciclo.unidadeId, ciclo.etapa);

    return { success: true, message: "Ciclo de prova excluido com sucesso" };
  }

  private async verificarSobreposicao(
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
    dataFim: Date,
    idExcluir?: string,
  ) {
    const ciclos = await this.buscarCiclosPorEtapa(unidadeId, etapa);

    return ciclos.filter((ciclo: ProvaCiclo) => {
      // Excluir o proprio ciclo da verificacao
      if (idExcluir && ciclo.id === idExcluir) {
        return false;
      }

      const inicio = new Date(ciclo.dataInicio);
      const fim = new Date(ciclo.dataFim);

      // Verifica se ha sobreposicao
      return dataInicio <= fim && dataFim >= inicio;
    });
  }

  private async buscarCiclosPorEtapa(unidadeId: string, etapa: string) {
    return this.db
      .select()
      .from(provaCiclo)
      .where(
        and(
          eq(provaCiclo.unidadeId, unidadeId),
          eq(provaCiclo.etapa, etapa),
        ),
      );
  }

  private async calcularProximoNumero(
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
  ): Promise<number> {
    const ciclos = await this.buscarCiclosPorEtapa(unidadeId, etapa);

    if (ciclos.length === 0) {
      return 1;
    }

    const ciclosOrdenados = ciclos.sort(
      (a: ProvaCiclo, b: ProvaCiclo) =>
        new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
    );

    let posicao = 1;
    for (const ciclo of ciclosOrdenados) {
      if (dataInicio < new Date(ciclo.dataInicio)) {
        break;
      }
      posicao++;
    }

    return posicao;
  }

  private async renumerarCiclosSeNecessario(
    unidadeId: string,
    etapa: string,
  ) {
    const ciclos = await this.db
      .select()
      .from(provaCiclo)
      .where(
        and(
          eq(provaCiclo.unidadeId, unidadeId),
          eq(provaCiclo.etapa, etapa),
        ),
      )
      .orderBy(asc(provaCiclo.dataInicio));

    for (let i = 0; i < ciclos.length; i++) {
      const numeroCorreto = i + 1;
      if (ciclos[i].numero !== numeroCorreto) {
        await this.db
          .update(provaCiclo)
          .set({ numero: numeroCorreto, atualizadoEm: new Date() })
          .where(eq(provaCiclo.id, ciclos[i].id));
      }
    }
  }
}
