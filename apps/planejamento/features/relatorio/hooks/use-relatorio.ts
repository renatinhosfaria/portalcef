"use client";

import { api } from "@essencia/shared/fetchers/client";
import type { HistoricoEntry } from "@essencia/shared/types";
import { useCallback, useState } from "react";

import { obterMensagemErro } from "../../../lib/mensagens-erro";
import type { Relatorio, RelatorioDocumento } from "../types";

interface UseRelatorioReturn {
  loading: boolean;
  error: string | null;
  listarRelatorios: () => Promise<Relatorio[]>;
  criarRelatorio: (
    turmaId: string,
    semestreId: string,
    semestreRelatorioId?: string,
  ) => Promise<Relatorio>;
  getRelatorio: (id: string) => Promise<Relatorio>;
  getHistorico: (id: string) => Promise<HistoricoEntry[]>;
  uploadDocumento: (
    relatorioId: string,
    file: File,
  ) => Promise<RelatorioDocumento>;
  addLink: (
    relatorioId: string,
    url: string,
    titulo?: string,
  ) => Promise<RelatorioDocumento>;
  atualizarDocumento: (
    relatorioId: string,
    docId: string,
    dados: { fileSize?: number },
  ) => Promise<void>;
  deleteDocumento: (
    relatorioId: string,
    docId: string,
    motivo: string,
  ) => Promise<void>;
  downloadDocumento: (relatorioId: string, docId: string) => Promise<string>;
  editarWord: (
    relatorioId: string,
    docId: string,
  ) => Promise<{ url: string }>;
  getSharePointUrl: (
    relatorioId: string,
    docId: string,
  ) => Promise<{ disponivel: boolean; embedUrl?: string }>;
  sincronizarWord: (
    relatorioId: string,
    docId: string,
  ) => Promise<{ sincronizado: boolean }>;
  submeterRelatorio: (relatorioId: string) => Promise<Relatorio>;
  recuperarRelatorio: (relatorioId: string) => Promise<Relatorio>;
}

function useEstadoAssincrono() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executar = useCallback(
    async <T>(acao: () => Promise<T>, mensagemErro: string): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        return await acao();
      } catch (err) {
        const message = obterMensagemErro(err, mensagemErro);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, executar };
}

export function useRelatorio(): UseRelatorioReturn {
  const { loading, error, executar } = useEstadoAssincrono();

  const listarRelatorios = useCallback(
    () =>
      executar(
        async () => (await api.get<Relatorio[]>("/relatorio")) ?? [],
        "Não foi possível carregar os relatórios. Tente novamente.",
      ),
    [executar],
  );

  const criarRelatorio = useCallback(
    (turmaId: string, semestreId: string, semestreRelatorioId?: string) =>
      executar(
        () =>
          api.post<Relatorio>("/relatorio", {
            turmaId,
            semestreId,
            ...(semestreRelatorioId ? { semestreRelatorioId } : {}),
          }),
        "Não foi possível criar o relatório. Tente novamente.",
      ),
    [executar],
  );

  const getRelatorio = useCallback(
    (id: string) =>
      executar(
        () => api.get<Relatorio>(`/relatorio/${id}`),
        "Não foi possível carregar o relatório. Tente novamente.",
      ),
    [executar],
  );

  const getHistorico = useCallback(
    (id: string) =>
      executar(
        async () =>
          (await api.get<HistoricoEntry[]>(`/relatorio/${id}/historico`)) ??
          [],
        "Não foi possível carregar o histórico. Tente novamente.",
      ),
    [executar],
  );

  const uploadDocumento = useCallback(
    (relatorioId: string, file: File) =>
      executar(
        () => {
          const formData = new FormData();
          formData.append("file", file);
          return api.post<RelatorioDocumento>(
            `/relatorio/${relatorioId}/documento/upload`,
            formData,
          );
        },
        "Não foi possível enviar o arquivo. Verifique sua conexão e tente novamente.",
      ),
    [executar],
  );

  const addLink = useCallback(
    (relatorioId: string, url: string, titulo?: string) =>
      executar(
        () =>
          api.post<RelatorioDocumento>(
            `/relatorio/${relatorioId}/documento/youtube`,
            { url, titulo },
          ),
        "Não foi possível adicionar o link. Verifique o endereço e tente novamente.",
      ),
    [executar],
  );

  const atualizarDocumento = useCallback(
    (relatorioId: string, docId: string, dados: { fileSize?: number }) =>
      executar(
        async () => {
          await api.patch(`/relatorio/${relatorioId}/documento/${docId}`, dados);
        },
        "Não foi possível atualizar o documento. Tente novamente.",
      ),
    [executar],
  );

  const deleteDocumento = useCallback(
    (relatorioId: string, docId: string, motivo: string) =>
      executar(
        async () => {
          await api.delete(`/relatorio/${relatorioId}/documento/${docId}`, {
            body: { motivo },
          });
        },
        "Não foi possível excluir o documento. Tente novamente.",
      ),
    [executar],
  );

  const downloadDocumento = useCallback(
    (relatorioId: string, docId: string) =>
      executar(
        () =>
          api.get<string>(
            `/relatorio/${relatorioId}/documento/${docId}/download`,
          ),
        "Não foi possível baixar o documento. Tente novamente.",
      ),
    [executar],
  );

  const editarWord = useCallback(
    (relatorioId: string, docId: string) =>
      executar(
        () =>
          api.post<{ url: string }>(
            `/relatorio/${relatorioId}/documento/${docId}/editar-word`,
            {},
          ),
        "Não foi possível iniciar a edição no Word. Tente novamente.",
      ),
    [executar],
  );

  const getSharePointUrl = useCallback(
    (relatorioId: string, docId: string) =>
      executar(
        () =>
          api.get<{ disponivel: boolean; embedUrl?: string }>(
            `/relatorio/${relatorioId}/documento/${docId}/sharepoint`,
          ),
        "Não foi possível abrir a visualização do documento. Tente novamente.",
      ),
    [executar],
  );

  const sincronizarWord = useCallback(
    (relatorioId: string, docId: string) =>
      executar(
        () =>
          api.post<{ sincronizado: boolean }>(
            `/relatorio/${relatorioId}/documento/${docId}/sincronizar-word`,
            {},
          ),
        "Não foi possível sincronizar o documento. Tente novamente.",
      ),
    [executar],
  );

  const submeterRelatorio = useCallback(
    (relatorioId: string) =>
      executar(
        () => api.post<Relatorio>(`/relatorio/${relatorioId}/submeter`, {}),
        "Não foi possível enviar o relatório para análise. Tente novamente.",
      ),
    [executar],
  );

  const recuperarRelatorio = useCallback(
    (relatorioId: string) =>
      executar(
        () => api.post<Relatorio>(`/relatorio/${relatorioId}/recuperar`, {}),
        "Não foi possível recuperar o relatório. Tente novamente.",
      ),
    [executar],
  );

  return {
    loading,
    error,
    listarRelatorios,
    criarRelatorio,
    getRelatorio,
    getHistorico,
    uploadDocumento,
    addLink,
    atualizarDocumento,
    deleteDocumento,
    downloadDocumento,
    editarWord,
    getSharePointUrl,
    sincronizarWord,
    submeterRelatorio,
    recuperarRelatorio,
  };
}
