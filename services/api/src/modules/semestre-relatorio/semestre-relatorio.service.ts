import { Injectable, BadRequestException } from "@nestjs/common";
import { eq, and, asc, getDb, sql } from "@essencia/db";
import {
  semestreRelatorio,
  relatorio,
  turmas,
  educationStages,
  type SemestreRelatorio,
} from "@essencia/db/schema";
import {
  CriarSemestreRelatorioDto,
  EditarSemestreRelatorioDto,
} from "./dto/semestre-relatorio.dto";

@Injectable()
export class SemestreRelatorioService {
  private get db() {
    return getDb();
  }

  async listarPorUnidade(unidadeId: string) {
    const semestres: SemestreRelatorio[] = await this.db
      .select()
      .from(semestreRelatorio)
      .where(eq(semestreRelatorio.unidadeId, unidadeId))
      .orderBy(
        asc(semestreRelatorio.etapa),
        asc(semestreRelatorio.anoLetivo),
        asc(semestreRelatorio.semestre),
      );

    return Promise.all(
      semestres.map(async (semestre) => ({
        ...semestre,
        relatoriosVinculados: await this.contarRelatoriosVinculados(semestre.id),
      })),
    );
  }

  async buscarPorId(id: string, unitId: string) {
    const [semestre] = await this.db
      .select()
      .from(semestreRelatorio)
      .where(
        and(
          eq(semestreRelatorio.id, id),
          eq(semestreRelatorio.unidadeId, unitId),
        ),
      );

    if (!semestre) {
      throw new BadRequestException("Semestre não encontrado");
    }

    return semestre;
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
      .from(semestreRelatorio)
      .where(
        and(
          eq(semestreRelatorio.unidadeId, unitId),
          eq(semestreRelatorio.etapa, etapa),
        ),
      )
      .orderBy(
        asc(semestreRelatorio.anoLetivo),
        asc(semestreRelatorio.semestre),
      );
  }

  async criar(dto: CriarSemestreRelatorioDto, unitId: string, userId: string) {
    const [criada] = await this.db
      .insert(semestreRelatorio)
      .values({
        unidadeId: unitId,
        etapa: dto.etapa as SemestreRelatorio["etapa"],
        anoLetivo: dto.anoLetivo,
        semestre: dto.semestre,
        descricao: dto.descricao,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        dataMaximaEntrega: dto.dataMaximaEntrega,
        criadoPor: userId,
      })
      .returning();

    if (!criada) {
      throw new BadRequestException("Falha ao criar semestre de relatório");
    }

    return criada;
  }

  async editar(id: string, dto: EditarSemestreRelatorioDto, unitId: string) {
    await this.buscarPorId(id, unitId);

    const campos: Partial<SemestreRelatorio> = {};
    if (dto.descricao !== undefined) campos.descricao = dto.descricao;
    if (dto.dataInicio !== undefined) campos.dataInicio = dto.dataInicio;
    if (dto.dataFim !== undefined) campos.dataFim = dto.dataFim;
    if (dto.dataMaximaEntrega !== undefined)
      campos.dataMaximaEntrega = dto.dataMaximaEntrega;

    const [atualizada] = await this.db
      .update(semestreRelatorio)
      .set({ ...campos, atualizadoEm: new Date() })
      .where(eq(semestreRelatorio.id, id))
      .returning();

    return atualizada;
  }

  async excluir(id: string, unitId: string): Promise<void> {
    await this.buscarPorId(id, unitId);

    const vinculados = await this.contarRelatoriosVinculados(id);
    if (vinculados > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${vinculados} relatório(s) vinculado(s)`,
      );
    }

    await this.db
      .delete(semestreRelatorio)
      .where(
        and(
          eq(semestreRelatorio.id, id),
          eq(semestreRelatorio.unidadeId, unitId),
        ),
      );
  }

  private async contarRelatoriosVinculados(semestreId: string): Promise<number> {
    const [result] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(relatorio)
      .where(eq(relatorio.semestreRelatorioId, semestreId));
    return result?.total ?? 0;
  }
}
