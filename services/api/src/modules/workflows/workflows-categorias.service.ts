import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, workflowCategorias } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import type {
  AtualizarCategoriaDto,
  CriarCategoriaDto,
} from "./dto/workflows.dto";
import {
  CATEGORIAS_PADRAO,
  SUGESTOES_POR_CATEGORIA,
  WORKFLOW_GESTAO_ROLES,
} from "./workflows.constants";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsCategoriasService {
  constructor(private readonly database: DatabaseService) {}

  private validarTenant(
    session: WorkflowUserContext,
  ): asserts session is WorkflowUserContext & {
    schoolId: string;
    unitId: string;
  } {
    if (!session.schoolId || !session.unitId) {
      throw new BadRequestException(
        "Sessao invalida: escola e unidade sao obrigatorias",
      );
    }
  }

  private exigirGestao(session: WorkflowUserContext) {
    if (!(WORKFLOW_GESTAO_ROLES as readonly string[]).includes(session.role)) {
      throw new ForbiddenException(
        "Voce nao tem permissao para gerenciar categorias de workflows",
      );
    }
  }

  private normalizarCategoria(
    nome: string,
  ): keyof typeof SUGESTOES_POR_CATEGORIA {
    const normalizada = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (normalizada.includes("evento")) return "eventos";
    if (normalizada.includes("document")) return "documentos";
    if (normalizada.includes("matricula")) return "matricula";
    if (normalizada.includes("pedagog")) return "pedagogico";

    return "administrativo";
  }

  private async garantirCategoriasPadrao(
    session: WorkflowUserContext & { schoolId: string; unitId: string },
  ) {
    const categoriaExistente =
      await this.database.db.query.workflowCategorias.findFirst({
        where: and(
          eq(workflowCategorias.schoolId, session.schoolId),
          eq(workflowCategorias.unitId, session.unitId),
        ),
      });

    if (categoriaExistente) {
      return;
    }

    await this.database.db
      .insert(workflowCategorias)
      .values(
        CATEGORIAS_PADRAO.map((nome, index) => ({
          schoolId: session.schoolId,
          unitId: session.unitId,
          nome,
          ordem: index + 1,
        })),
      )
      .onConflictDoNothing();
  }

  async listar(session: WorkflowUserContext) {
    this.validarTenant(session);
    await this.garantirCategoriasPadrao(session);

    return this.database.db.query.workflowCategorias.findMany({
      where: and(
        eq(workflowCategorias.schoolId, session.schoolId),
        eq(workflowCategorias.unitId, session.unitId),
      ),
      orderBy: [asc(workflowCategorias.ordem), asc(workflowCategorias.nome)],
    });
  }

  async criar(session: WorkflowUserContext, dto: CriarCategoriaDto) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const [categoria] = await this.database.db
      .insert(workflowCategorias)
      .values({
        schoolId: session.schoolId,
        unitId: session.unitId,
        nome: dto.nome,
        ordem: dto.ordem ?? 999,
      })
      .returning();

    return categoria;
  }

  async atualizar(
    session: WorkflowUserContext,
    categoriaId: string,
    dto: AtualizarCategoriaDto,
  ) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const [categoria] = await this.database.db
      .update(workflowCategorias)
      .set({ ...dto, updatedAt: new Date() })
      .where(
        and(
          eq(workflowCategorias.id, categoriaId),
          eq(workflowCategorias.schoolId, session.schoolId),
          eq(workflowCategorias.unitId, session.unitId),
        ),
      )
      .returning();

    if (!categoria) {
      throw new NotFoundException("Categoria nao encontrada");
    }

    return categoria;
  }

  async obterSugestoes(session: WorkflowUserContext, categoriaId: string) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const categoria = await this.database.db.query.workflowCategorias.findFirst({
      where: and(
        eq(workflowCategorias.id, categoriaId),
        eq(workflowCategorias.schoolId, session.schoolId),
        eq(workflowCategorias.unitId, session.unitId),
      ),
    });

    if (!categoria) {
      throw new NotFoundException("Categoria nao encontrada");
    }

    return SUGESTOES_POR_CATEGORIA[this.normalizarCategoria(categoria.nome)];
  }
}
