import { api } from "@essencia/shared/fetchers/client";
import type {
  WorkflowCategoria,
  WorkflowExecucaoDetalhe,
  WorkflowExecucaoResumo,
  WorkflowModeloDetalhe,
  WorkflowModeloResumo,
  WorkflowSugestoesCategoria,
} from "@essencia/shared/types/workflows";

export const listarCategorias = () =>
  api.get<WorkflowCategoria[]>("/workflows/categorias");

export const listarModelos = (params = "status=PUBLICADO") =>
  api.get<WorkflowModeloResumo[]>(`/workflows/modelos?${params}`);

export const buscarModelo = (modeloId: string) =>
  api.get<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}`);

export const criarModelo = (body: unknown) =>
  api.post<WorkflowModeloDetalhe>("/workflows/modelos", body);

export const atualizarModelo = (modeloId: string, body: unknown) =>
  api.patch<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}`, body);

export const publicarModelo = (modeloId: string) =>
  api.post<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}/publicar`);

export const inativarModelo = (modeloId: string) =>
  api.post<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}/inativar`);

export const duplicarModelo = (modeloId: string) =>
  api.post<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}/duplicar`);

export const obterSugestoes = (categoriaId: string) =>
  api.get<WorkflowSugestoesCategoria>(
    `/workflows/categorias/${categoriaId}/sugestoes`,
  );

export const iniciarExecucao = (
  modeloId: string,
  body: { titulo: string; teste?: boolean },
) =>
  api.post<WorkflowExecucaoDetalhe>(
    `/workflows/modelos/${modeloId}/execucoes`,
    body,
  );

export const listarExecucoes = (params = "status=EM_ANDAMENTO") =>
  api.get<WorkflowExecucaoResumo[]>(`/workflows/execucoes?${params}`);

export const buscarExecucao = (execucaoId: string) =>
  api.get<WorkflowExecucaoDetalhe>(`/workflows/execucoes/${execucaoId}`);

export const atualizarEtapa = (
  execucaoId: string,
  etapaId: string,
  body: { concluida?: boolean; observacao?: string | null },
) =>
  api.patch<WorkflowExecucaoDetalhe>(
    `/workflows/execucoes/${execucaoId}/etapas/${etapaId}`,
    body,
  );

export const concluirExecucao = (execucaoId: string) =>
  api.post<WorkflowExecucaoDetalhe>(
    `/workflows/execucoes/${execucaoId}/concluir`,
  );

export const cancelarExecucao = (execucaoId: string, motivo: string) =>
  api.post<WorkflowExecucaoDetalhe>(
    `/workflows/execucoes/${execucaoId}/cancelar`,
    { motivo },
  );

export const reabrirExecucao = (execucaoId: string, motivo: string) =>
  api.post<WorkflowExecucaoDetalhe>(
    `/workflows/execucoes/${execucaoId}/reabrir`,
    { motivo },
  );
