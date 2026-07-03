import { Injectable } from "@nestjs/common";

import type {
  AtualizarModeloDto,
  CriarModeloDto,
  ListarModelosDto,
} from "./dto/workflows.dto";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsModelosService {
  async listar(_session: WorkflowUserContext, _dto: ListarModelosDto) {
    return [];
  }

  async criar(_session: WorkflowUserContext, _dto: CriarModeloDto) {
    return null;
  }

  async buscarPorId(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }

  async atualizar(
    _session: WorkflowUserContext,
    _modeloId: string,
    _dto: AtualizarModeloDto,
  ) {
    return null;
  }

  async publicar(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }

  async inativar(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }

  async duplicar(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }
}
