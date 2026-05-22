import { Injectable, BadRequestException } from "@nestjs/common";
import { eq, and, asc, getDb, sql } from "@essencia/db";
import {
  semanaRelatorio,
  relatorio,
  turmas,
  educationStages,
  type SemanaRelatorio,
} from "@essencia/db/schema";
import {
  CriarSemanaRelatorioDto,
  EditarSemanaRelatorioDto,
} from "./dto/semana-relatorio.dto";

@Injectable()
export class SemanaRelatorioService {
  private get db() {
    return getDb();
  }

  async listarPorUnidade(unidadeId: string) {
    const semanas: SemanaRelatorio[] = await this.db
      .select()
      .from(semanaRelatorio)
      .where(eq(semanaRelatorio.unidadeId, unidadeId))
      .orderBy(asc(semanaRelatorio.etapa), asc(semanaRelatorio.numero));

    return Promise.all(
      semanas.map(async (semana) => ({
        ...semana,
        relatoriosVinculados: await this.contarRelatoriosVinculados(semana.id),
      })),
    );
  }

  async buscarPorId(id: string, unitId: string) {
    const [semana] = await this.db
      .select()
      .from(semanaRelatorio)
      .where(
        and(
          eq(semanaRelatorio.id, id),
          eq(semanaRelatorio.unidadeId, unitId),
        ),
      );

    if (!semana) {
      throw new BadRequestException("Semana não encontrada");
    }

    return semana;
  }

  async buscarPorTurma(turmaId: string, unitId: string) {
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

    const etapa = turma.etapaCode;
    if (etapa !== "BERCARIO" && etapa !== "INFANTIL") {
      throw new BadRequestException(
        "Esta turma não pertence a BERCARIO ou INFANTIL",
      );
    }

    return this.db
      .select()
      .from(semanaRelatorio)
      .where(
        and(
          eq(semanaRelatorio.unidadeId, unitId),
          eq(semanaRelatorio.etapa, etapa),
        ),
      )
      .orderBy(asc(semanaRelatorio.numero));
  }

  async criar(dto: CriarSemanaRelatorioDto, unitId: string, userId: string) {
    const [criada] = await this.db
      .insert(semanaRelatorio)
      .values({
        unidadeId: unitId,
        etapa: dto.etapa as SemanaRelatorio["etapa"],
        numero: dto.numero,
        descricao: dto.descricao,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        dataMaximaEntrega: dto.dataMaximaEntrega,
        criadoPor: userId,
      })
      .returning();

    if (!criada) {
      throw new BadRequestException("Falha ao criar semana de relatório");
    }

    return criada;
  }

  async editar(id: string, dto: EditarSemanaRelatorioDto, unitId: string) {
    await this.buscarPorId(id, unitId);

    const campos: Partial<SemanaRelatorio> = {};
    if (dto.descricao !== undefined) campos.descricao = dto.descricao;
    if (dto.dataInicio !== undefined) campos.dataInicio = dto.dataInicio;
    if (dto.dataFim !== undefined) campos.dataFim = dto.dataFim;
    if (dto.dataMaximaEntrega !== undefined)
      campos.dataMaximaEntrega = dto.dataMaximaEntrega;

    const [atualizada] = await this.db
      .update(semanaRelatorio)
      .set({ ...campos, atualizadoEm: new Date() })
      .where(eq(semanaRelatorio.id, id))
      .returning();

    return atualizada;
  }

  async excluir(id: string, unitId: string) {
    await this.buscarPorId(id, unitId);

    const vinculados = await this.contarRelatoriosVinculados(id);
    if (vinculados > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${vinculados} relatório(s) vinculado(s)`,
      );
    }

    await this.db
      .delete(semanaRelatorio)
      .where(
        and(
          eq(semanaRelatorio.id, id),
          eq(semanaRelatorio.unidadeId, unitId),
        ),
      );

    return { success: true };
  }

  private async contarRelatoriosVinculados(semanaId: string): Promise<number> {
    const [result] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(relatorio)
      .where(eq(relatorio.semanaRelatorioId, semanaId));
    return result?.total ?? 0;
  }
}
