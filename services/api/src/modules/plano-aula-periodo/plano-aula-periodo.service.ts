import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, asc, getDb } from '@essencia/db';
import { planoAulaPeriodo, type PlanoAulaPeriodo, turmas, educationStages } from '@essencia/db/schema';
import { CriarPeriodoDto } from './dto/plano-aula-periodo.dto';

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
      .orderBy(
        asc(planoAulaPeriodo.etapa),
        asc(planoAulaPeriodo.numero)
      );
  }

  async buscarPorId(id: string, unitId: string) {
    const [periodo] = await this.db
      .select()
      .from(planoAulaPeriodo)
      .where(and(
        eq(planoAulaPeriodo.id, id),
        eq(planoAulaPeriodo.unidadeId, unitId)
      ));

    if (!periodo) {
      throw new BadRequestException('Período não encontrado');
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
      .where(and(
        eq(turmas.id, turmaId),
        eq(turmas.unitId, unitId)
      ));

    if (!turma) {
      throw new BadRequestException('Turma não encontrada');
    }

    // 2. Buscar períodos da etapa da turma
    return this.db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unitId),
          eq(planoAulaPeriodo.etapa, turma.etapaCode)
        )
      )
      .orderBy(asc(planoAulaPeriodo.numero));
  }

  async criarPeriodo(
    unidadeId: string,
    userId: string,
    dto: CriarPeriodoDto
  ) {
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    const dataMaximaEntrega = new Date(dto.dataMaximaEntrega);

    // Validar se as datas são válidas (não são NaN)
    if (isNaN(dataInicio.getTime())) {
      throw new BadRequestException('Data de início inválida');
    }
    if (isNaN(dataFim.getTime())) {
      throw new BadRequestException('Data de fim inválida');
    }
    if (isNaN(dataMaximaEntrega.getTime())) {
      throw new BadRequestException('Data máxima de entrega inválida');
    }

    if (dataInicio >= dataFim) {
      throw new BadRequestException(
        'Data de início deve ser anterior à data de fim'
      );
    }

    if (dataMaximaEntrega >= dataInicio) {
      throw new BadRequestException(
        'Data máxima de entrega deve ser anterior ao início do período'
      );
    }

    // Verificar sobreposição
    const sobrepostos = await this.verificarSobreposicao(unidadeId, dto.etapa, dataInicio, dataFim);
    if (sobrepostos.length > 0) {
      throw new BadRequestException('As datas se sobrepõem a um período existente');
    }

    // Calcular número
    const numero = await this.calcularProximoNumero(unidadeId, dto.etapa, dataInicio);

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

  private async verificarSobreposicao(
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
    dataFim: Date
  ) {
    const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

    return periodos.filter((periodo: PlanoAulaPeriodo) => {
      const inicio = new Date(periodo.dataInicio);
      const fim = new Date(periodo.dataFim);

      // Verifica se há sobreposição
      return dataInicio <= fim && dataFim >= inicio;
    });
  }

  private async buscarPeriodosPorEtapa(
    unidadeId: string,
    etapa: string
  ) {
    return this.db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unidadeId),
          eq(planoAulaPeriodo.etapa, etapa)
        )
      );
  }

  private async calcularProximoNumero(
    unidadeId: string,
    etapa: string,
    dataInicio: Date
  ): Promise<number> {
    const periodos = await this.buscarPeriodosPorEtapa(unidadeId, etapa);

    if (periodos.length === 0) {
      return 1;
    }

    const periodosOrdenados = periodos.sort(
      (a: PlanoAulaPeriodo, b: PlanoAulaPeriodo) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime()
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

  private async renumerarPeriodosSeNecessario(unidadeId: string, etapa: string) {
    const periodos = await this.db
      .select()
      .from(planoAulaPeriodo)
      .where(
        and(
          eq(planoAulaPeriodo.unidadeId, unidadeId),
          eq(planoAulaPeriodo.etapa, etapa)
        )
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
