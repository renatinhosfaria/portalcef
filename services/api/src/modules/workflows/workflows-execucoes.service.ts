import { Injectable } from "@nestjs/common";

import type {
  AtualizarEtapaDto,
  EditarTituloExecucaoDto,
  IniciarExecucaoDto,
  ListarExecucoesDto,
  MotivoObrigatorioDto,
} from "./dto/workflows.dto";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsExecucoesService {
  async iniciar(
    _session: WorkflowUserContext,
    _modeloId: string,
    _dto: IniciarExecucaoDto,
  ) {
    return null;
  }

  async listar(_session: WorkflowUserContext, _dto: ListarExecucoesDto) {
    return [];
  }

  async buscarPorId(_session: WorkflowUserContext, _execucaoId: string) {
    return null;
  }

  async editarTitulo(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _dto: EditarTituloExecucaoDto,
  ) {
    return null;
  }

  async atualizarEtapa(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _etapaId: string,
    _dto: AtualizarEtapaDto,
  ) {
    return null;
  }

  async concluir(_session: WorkflowUserContext, _execucaoId: string) {
    return null;
  }

  async cancelar(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _dto: MotivoObrigatorioDto,
  ) {
    return null;
  }

  async reabrir(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _dto: MotivoObrigatorioDto,
  ) {
    return null;
  }

  async descartarTeste(_session: WorkflowUserContext, _execucaoId: string) {
    return undefined;
  }
}
