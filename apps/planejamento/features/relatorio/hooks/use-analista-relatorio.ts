"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useState } from "react";

import { obterMensagemErro } from "../../../lib/mensagens-erro";
import type { RelatorioDocumento, RelatorioSummary } from "../types";

interface UseAnalistaRelatorioReturn {
  loading: boolean;
  listarPendentes: () => Promise<RelatorioSummary[]>;
  aprovar: (relatorioId: string) => Promise<void>;
  devolver: (relatorioId: string, motivo: string) => Promise<void>;
  aprovarDocumento: (
    relatorioId: string,
    documentoId: string,
  ) => Promise<RelatorioDocumento>;
  desaprovarDocumento: (
    relatorioId: string,
    documentoId: string,
  ) => Promise<RelatorioDocumento>;
  editarWord: (
    relatorioId: string,
    documentoId: string,
  ) => Promise<{ url: string }>;
  sincronizarWord: (
    relatorioId: string,
    documentoId: string,
  ) => Promise<{ sincronizado: boolean }>;
}

export function useAnalistaRelatorio(): UseAnalistaRelatorioReturn {
  const [loading, setLoading] = useState(false);

  const executar = useCallback(
    async <T>(acao: () => Promise<T>, mensagemErro: string): Promise<T> => {
      setLoading(true);
      try {
        return await acao();
      } catch (err) {
        throw new Error(obterMensagemErro(err, mensagemErro));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const listarPendentes = useCallback(
    () =>
      executar(
        async () =>
          (await api.get<RelatorioSummary[]>(
            "/relatorio/analise/pendentes",
          )) ?? [],
        "Não foi possível carregar os relatórios pendentes. Tente novamente.",
      ),
    [executar],
  );

  const aprovar = useCallback(
    (relatorioId: string) =>
      executar(
        async () => {
          await api.post(`/relatorio/${relatorioId}/aprovar-analista`, {});
        },
        "Não foi possível aprovar o relatório. Tente novamente.",
      ),
    [executar],
  );

  const devolver = useCallback(
    (relatorioId: string, motivo: string) =>
      executar(
        async () => {
          await api.post(`/relatorio/${relatorioId}/devolver-analista`, {
            motivo,
          });
        },
        "Não foi possível devolver o relatório. Tente novamente.",
      ),
    [executar],
  );

  const aprovarDocumento = useCallback(
    (relatorioId: string, documentoId: string) =>
      executar(
        () =>
          api.post<RelatorioDocumento>(
            `/relatorio/${relatorioId}/documento/${documentoId}/aprovar`,
            {},
          ),
        "Não foi possível aprovar o documento. Tente novamente.",
      ),
    [executar],
  );

  const desaprovarDocumento = useCallback(
    (relatorioId: string, documentoId: string) =>
      executar(
        () =>
          api.post<RelatorioDocumento>(
            `/relatorio/${relatorioId}/documento/${documentoId}/desaprovar`,
            {},
          ),
        "Não foi possível desfazer a aprovação do documento. Tente novamente.",
      ),
    [executar],
  );

  const editarWord = useCallback(
    (relatorioId: string, documentoId: string) =>
      executar(
        () =>
          api.post<{ url: string }>(
            `/relatorio/${relatorioId}/documento/${documentoId}/editar-word`,
            {},
          ),
        "Não foi possível iniciar a edição no Word. Tente novamente.",
      ),
    [executar],
  );

  const sincronizarWord = useCallback(
    (relatorioId: string, documentoId: string) =>
      executar(
        () =>
          api.post<{ sincronizado: boolean }>(
            `/relatorio/${relatorioId}/documento/${documentoId}/sincronizar-word`,
            {},
          ),
        "Não foi possível sincronizar o documento. Tente novamente.",
      ),
    [executar],
  );

  return {
    loading,
    listarPendentes,
    aprovar,
    devolver,
    aprovarDocumento,
    desaprovarDocumento,
    editarWord,
    sincronizarWord,
  };
}
