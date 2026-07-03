import { Injectable } from "@nestjs/common";

import type {
  AtualizarCategoriaDto,
  CriarCategoriaDto,
} from "./dto/workflows.dto";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsCategoriasService {
  async listar(_session: WorkflowUserContext) {
    return [];
  }

  async criar(_session: WorkflowUserContext, _dto: CriarCategoriaDto) {
    return null;
  }

  async atualizar(
    _session: WorkflowUserContext,
    _categoriaId: string,
    _dto: AtualizarCategoriaDto,
  ) {
    return null;
  }

  async obterSugestoes(_session: WorkflowUserContext, _categoriaId: string) {
    return { orientacoes: [], fases: [] };
  }
}
