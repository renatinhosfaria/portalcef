"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useState } from "react";
import type {
  Prova,
  ProvaSummary,
  ProvaDashboardData,
  ProvaStatus,
  CriarProvaResult,
  ProvaDocumento,
  FiltrosGestaoProvas,
  ListagemProvasResponse,
  ProvaListItem,
} from "../types";

// ============================================
// Hook para Professora
// ============================================

interface UseProvaReturn {
  loading: boolean;
  error: string | null;
  criarProva: (
    turmaId: string,
    provaCicloId: string,
  ) => Promise<CriarProvaResult>;
  getProva: (id: string) => Promise<Prova>;
  uploadDocumento: (provaId: string, file: File) => Promise<ProvaDocumento>;
  addLink: (provaId: string, url: string) => Promise<ProvaDocumento>;
  deleteDocumento: (provaId: string, docId: string) => Promise<void>;
  aprovarDocumento: (documentoId: string) => Promise<ProvaDocumento>;
  desaprovarDocumento: (documentoId: string) => Promise<ProvaDocumento>;
  imprimirDocumento: (documentoId: string) => Promise<ProvaDocumento>;
  submeterProva: (provaId: string) => Promise<{ success: boolean }>;
  recuperarProva: (provaId: string) => Promise<{ success: boolean }>;
}

/**
 * Hook para acoes da Professora
 * - Criar prova
 * - Upload de documentos
 * - Adicionar links do YouTube
 * - Excluir documentos
 * - Submeter para analise
 * - Recuperar prova devolvida
 */
export function useProva(): UseProvaReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criarProva = useCallback(
    async (turmaId: string, provaCicloId: string): Promise<CriarProvaResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<CriarProvaResult>("/prova", {
          turmaId,
          provaCicloId,
        });
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao criar prova";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getProva = useCallback(async (id: string): Promise<Prova> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<Prova>(`/prova/${id}`);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar prova";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocumento = useCallback(
    async (provaId: string, file: File): Promise<ProvaDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await api.post<ProvaDocumento>(
          `/prova/${provaId}/documentos/upload`,
          formData,
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao fazer upload";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const addLink = useCallback(
    async (provaId: string, url: string): Promise<ProvaDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<ProvaDocumento>(
          `/prova/${provaId}/documentos/link`,
          { url },
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao adicionar link";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteDocumento = useCallback(
    async (provaId: string, docId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await api.delete(`/prova/${provaId}/documentos/${docId}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao excluir documento";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const aprovarDocumento = useCallback(
    async (documentoId: string): Promise<ProvaDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<ProvaDocumento>(
          `/prova/documentos/${documentoId}/aprovar`,
          {},
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao aprovar documento";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const desaprovarDocumento = useCallback(
    async (documentoId: string): Promise<ProvaDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<ProvaDocumento>(
          `/prova/documentos/${documentoId}/desaprovar`,
          {},
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao desfazer aprovacao";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const imprimirDocumento = useCallback(
    async (documentoId: string): Promise<ProvaDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<ProvaDocumento>(
          `/prova/documentos/${documentoId}/imprimir`,
          {},
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao registrar impressao";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const submeterProva = useCallback(
    async (provaId: string): Promise<{ success: boolean }> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<{ success: boolean }>(
          `/prova/${provaId}/submeter`,
          {},
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao submeter prova";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const recuperarProva = useCallback(
    async (provaId: string): Promise<{ success: boolean }> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<{ success: boolean }>(
          `/prova/${provaId}/recuperar`,
          {},
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao recuperar prova";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    criarProva,
    getProva,
    uploadDocumento,
    addLink,
    deleteDocumento,
    aprovarDocumento,
    desaprovarDocumento,
    imprimirDocumento,
    submeterProva,
    recuperarProva,
  };
}

// ============================================
// Hook para Analista Pedagogica (Provas)
// ============================================

interface UseAnalistaProvaActionsReturn {
  loading: boolean;
  listarPendentes: () => Promise<ProvaSummary[]>;
  aprovar: (provaId: string) => Promise<void>;
  devolver: (provaId: string) => Promise<void>;
}

/**
 * Hook para acoes da Analista Pedagogica em provas
 * - Listar provas pendentes de analise
 * - Aprovar prova (envia para coordenacao)
 * - Devolver prova (envia para professora)
 */
export function useAnalistaProvaActions(): UseAnalistaProvaActionsReturn {
  const [loading, setLoading] = useState(false);

  const listarPendentes = useCallback(async (): Promise<ProvaSummary[]> => {
    const result = await api.get<ProvaSummary[]>(
      "/prova/analista/pendentes",
    );
    return result || [];
  }, []);

  const aprovar = useCallback(async (provaId: string): Promise<void> => {
    setLoading(true);
    try {
      await api.post(`/prova/${provaId}/analista/aprovar`, {});
    } finally {
      setLoading(false);
    }
  }, []);

  const devolver = useCallback(
    async (provaId: string): Promise<void> => {
      setLoading(true);
      try {
        await api.post(`/prova/${provaId}/analista/devolver`, {});
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, listarPendentes, aprovar, devolver };
}

// ============================================
// Hook para Coordenadora de Segmento (Provas)
// ============================================

interface UseCoordenadoraProvaActionsReturn {
  loading: boolean;
  listarPendentes: () => Promise<ProvaSummary[]>;
  aprovar: (provaId: string) => Promise<void>;
  devolver: (
    provaId: string,
    destino: "PROFESSORA" | "ANALISTA",
  ) => Promise<void>;
}

/**
 * Hook para acoes da Coordenadora de Segmento em provas
 * - Listar provas pendentes de aprovacao
 * - Aprovar prova (aprovacao final)
 * - Devolver prova (para professora ou analista)
 */
export function useCoordenadoraProvaActions(): UseCoordenadoraProvaActionsReturn {
  const [loading, setLoading] = useState(false);

  const listarPendentes = useCallback(async (): Promise<ProvaSummary[]> => {
    const result = await api.get<ProvaSummary[]>(
      "/prova/coordenadora/pendentes",
    );
    return result || [];
  }, []);

  const aprovar = useCallback(async (provaId: string): Promise<void> => {
    setLoading(true);
    try {
      await api.post(`/prova/${provaId}/coordenadora/aprovar`, {});
    } finally {
      setLoading(false);
    }
  }, []);

  const devolver = useCallback(
    async (
      provaId: string,
      destino: "PROFESSORA" | "ANALISTA",
    ): Promise<void> => {
      setLoading(true);
      try {
        await api.post(`/prova/${provaId}/coordenadora/devolver`, {
          destino,
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, listarPendentes, aprovar, devolver };
}

// ============================================
// Hook para Dashboard de Provas (Gestao)
// ============================================

interface UseProvaDashboardReturn {
  loading: boolean;
  data: ProvaDashboardData | null;
  error: string | null;
  fetchDashboard: (provaCicloId?: string) => Promise<void>;
}

interface DashboardItemApi {
  status: ProvaStatus;
  count: number;
}

interface DashboardApiLegado {
  totais?: DashboardItemApi[];
  porSegmento?: Record<
    string,
    DashboardItemApi[] | ProvaDashboardData["porSegmento"][string]
  >;
}

const DASHBOARD_STATS_VAZIAS: ProvaDashboardData["stats"] = {
  total: 0,
  rascunho: 0,
  aguardandoAnalista: 0,
  aguardandoCoordenadora: 0,
  devolvidos: 0,
  aprovados: 0,
};

function somarStatus(
  itens: DashboardItemApi[],
  status: ProvaStatus[],
): number {
  return itens.reduce((acumulado, item) => {
    if (status.includes(item.status)) {
      return acumulado + item.count;
    }
    return acumulado;
  }, 0);
}

function normalizarDashboardData(
  payload: ProvaDashboardData | DashboardApiLegado,
): ProvaDashboardData {
  const totais = Array.isArray((payload as DashboardApiLegado).totais)
    ? ((payload as DashboardApiLegado).totais ?? [])
    : [];

  const stats: ProvaDashboardData["stats"] =
    "stats" in payload && payload.stats
      ? payload.stats
      : {
          total: totais.reduce((acumulado, item) => acumulado + item.count, 0),
          rascunho: somarStatus(totais, ["RASCUNHO"]),
          aguardandoAnalista: somarStatus(totais, [
            "AGUARDANDO_ANALISTA",
            "REVISAO_ANALISTA",
          ]),
          aguardandoCoordenadora: somarStatus(totais, [
            "AGUARDANDO_COORDENADORA",
          ]),
          devolvidos: somarStatus(totais, [
            "DEVOLVIDO_ANALISTA",
            "DEVOLVIDO_COORDENADORA",
          ]),
          aprovados: somarStatus(totais, ["APROVADO"]),
        };

  const porSegmentoRaw = (payload as DashboardApiLegado).porSegmento ?? {};
  const porSegmentoNormalizado: ProvaDashboardData["porSegmento"] = {};

  for (const [segmento, valor] of Object.entries(porSegmentoRaw)) {
    if (Array.isArray(valor)) {
      porSegmentoNormalizado[segmento] = {
        total: valor.reduce((acumulado, item) => acumulado + item.count, 0),
        aprovados: somarStatus(valor, ["APROVADO"]),
      };
      continue;
    }

    porSegmentoNormalizado[segmento] = {
      total: valor?.total ?? 0,
      aprovados: valor?.aprovados ?? 0,
    };
  }

  return {
    stats: stats ?? DASHBOARD_STATS_VAZIAS,
    porSegmento: porSegmentoNormalizado,
  };
}

/**
 * Hook para Dashboard de Gestao de Provas
 * - Estatisticas gerais (total, pendentes, aprovados, etc.)
 * - Estatisticas por segmento
 */
export function useProvaDashboard(): UseProvaDashboardReturn {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProvaDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(
    async (provaCicloId?: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (provaCicloId) {
          params.append("provaCicloId", provaCicloId);
        }
        const queryString = params.toString() ? `?${params.toString()}` : "";

        const result = await api.get<ProvaDashboardData | DashboardApiLegado>(
          `/prova/dashboard${queryString}`,
        );
        setData(normalizarDashboardData(result));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao buscar dashboard";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, data, error, fetchDashboard };
}

// ============================================
// Hook para Listagem de Provas (Gestao)
// ============================================

interface UseGestaoProvasReturn {
  provas: ProvaListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  isLoading: boolean;
  error: string | null;
  fetchProvas: (filtros: FiltrosGestaoProvas) => Promise<void>;
  deletarProva: (provaId: string) => Promise<void>;
}

/**
 * Hook para Listagem de Provas da Gestao
 * - Lista provas com filtros e paginacao
 * - Suporta filtros por status, ciclo, segmento, professora
 */
export function useGestaoProvas(): UseGestaoProvasReturn {
  const [provas, setProvas] = useState<ProvaListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProvas = useCallback(
    async (filtros: FiltrosGestaoProvas): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();

        if (filtros.status) {
          params.append("status", filtros.status);
        }
        if (filtros.provaCicloId) {
          params.append("provaCicloId", filtros.provaCicloId);
        }
        if (filtros.segmentoId) {
          params.append("segmentoId", filtros.segmentoId);
        }
        if (filtros.professora) {
          params.append("professora", filtros.professora);
        }
        if (filtros.dataInicio) {
          params.append("dataInicio", filtros.dataInicio);
        }
        if (filtros.dataFim) {
          params.append("dataFim", filtros.dataFim);
        }
        params.append("page", String(filtros.page));
        params.append("limit", String(filtros.limit));

        const queryString = params.toString();
        const result = await api.get<ListagemProvasResponse>(
          `/prova/gestao/listar?${queryString}`,
        );

        setProvas(result.data || []);
        setPagination(result.pagination);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao buscar provas";
        setError(message);
        setProvas([]);
        setPagination({ total: 0, page: 1, limit: 20, totalPages: 0 });
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const deletarProva = useCallback(
    async (provaId: string): Promise<void> => {
      await api.delete(`/prova/${provaId}`);
    },
    [],
  );

  return { provas, pagination, isLoading, error, fetchProvas, deletarProva };
}

// ============================================
// Hook para Buscar Prova Individual
// ============================================

interface UseProvaDetalheReturn {
  loading: boolean;
  prova: Prova | null;
  error: string | null;
  fetchProva: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar detalhes de uma prova especifica
 * Util para telas de revisao (analista/coordenadora)
 */
export function useProvaDetalhe(provaId?: string): UseProvaDetalheReturn {
  const [loading, setLoading] = useState(false);
  const [prova, setProva] = useState<Prova | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | undefined>(provaId);

  const fetchProva = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    setCurrentId(id);
    try {
      const result = await api.get<Prova>(`/prova/${id}`);
      setProva(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar prova";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async (): Promise<void> => {
    if (currentId) {
      await fetchProva(currentId);
    }
  }, [currentId, fetchProva]);

  return { loading, prova, error, fetchProva, refetch };
}
