import { api } from "@essencia/shared/fetchers/client";
import type {
  WorkflowAnexo,
  WorkflowCategoria,
  WorkflowExecucaoDetalhe,
  WorkflowExecucaoResumo,
  WorkflowModeloStatus,
  WorkflowModeloDetalhe,
  WorkflowModeloResumo,
  WorkflowSugestoesCategoria,
} from "@essencia/shared/types/workflows";

type WorkflowModeloMutacaoResultado = {
  id: string;
  status: WorkflowModeloStatus;
};

export type ResultadoPaginado<T> = {
  itens: T[];
  pagina: number;
  limite: number;
  temMais: boolean;
};

export type ListagemParametros = {
  status?: string;
  pagina?: number;
  limite?: number;
  busca?: string;
  categoriaId?: string;
};

function montarParametros(
  parametros: ListagemParametros | string | undefined,
  padrao: ListagemParametros,
) {
  const valores =
    typeof parametros === "string"
      ? {
          ...padrao,
          ...Object.fromEntries(new URLSearchParams(parametros).entries()),
        }
      : { ...padrao, ...parametros };
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== undefined && valor !== "") query.set(chave, String(valor));
  }
  return query.toString();
}

type WorkflowModeloDuplicadoResultado = {
  id: string;
};

export const listarCategorias = () =>
  api.get<WorkflowCategoria[]>("/workflows/categorias");

export const criarCategoria = (body: { nome: string }) =>
  api.post<WorkflowCategoria>("/workflows/categorias", body);

export const atualizarCategoria = (
  categoriaId: string,
  body: { nome?: string; ativo?: boolean; ordem?: number },
) => api.patch<WorkflowCategoria>(`/workflows/categorias/${categoriaId}`, body);

export const listarModelos = (
  params: ListagemParametros | string = {
    status: "PUBLICADO",
    pagina: 1,
    limite: 20,
  },
) =>
  api.get<ResultadoPaginado<WorkflowModeloResumo>>(
    `/workflows/modelos?${montarParametros(params, { status: "PUBLICADO", pagina: 1, limite: 20 })}`,
  );

export const buscarModelo = (modeloId: string) =>
  api.get<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}`);

export const criarModelo = (body: unknown) =>
  api.post<WorkflowModeloMutacaoResultado>("/workflows/modelos", body);

export const atualizarModelo = (modeloId: string, body: unknown) =>
  api.patch<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}`, body);

export const publicarModelo = (modeloId: string) =>
  api.post<WorkflowModeloMutacaoResultado>(
    `/workflows/modelos/${modeloId}/publicar`,
  );

export const inativarModelo = (modeloId: string) =>
  api.post<WorkflowModeloMutacaoResultado>(
    `/workflows/modelos/${modeloId}/inativar`,
  );

export const duplicarModelo = (modeloId: string) =>
  api.post<WorkflowModeloDuplicadoResultado>(
    `/workflows/modelos/${modeloId}/duplicar`,
  );

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

export const listarExecucoes = (
  params: ListagemParametros | string = {
    status: "EM_ANDAMENTO",
    pagina: 1,
    limite: 20,
  },
) =>
  api.get<ResultadoPaginado<WorkflowExecucaoResumo>>(
    `/workflows/execucoes?${montarParametros(params, { status: "EM_ANDAMENTO", pagina: 1, limite: 20 })}`,
  );

export const buscarExecucao = (execucaoId: string) =>
  api.get<WorkflowExecucaoDetalhe>(`/workflows/execucoes/${execucaoId}`);

export const editarTituloExecucao = (
  execucaoId: string,
  body: { titulo: string },
) =>
  api.patch<WorkflowExecucaoDetalhe>(
    `/workflows/execucoes/${execucaoId}/titulo`,
    body,
  );

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

export const enviarAnexoExecucao = (execucaoId: string, formData: FormData) =>
  api.post<WorkflowAnexo>(
    `/workflows/execucoes/${execucaoId}/anexos`,
    formData,
  );

export const removerAnexoExecucao = (execucaoId: string, anexoId: string) =>
  api.delete<null>(`/workflows/execucoes/${execucaoId}/anexos/${anexoId}`);

export const descartarExecucaoTeste = (execucaoId: string) =>
  api.delete<null>(`/workflows/execucoes/${execucaoId}`);
