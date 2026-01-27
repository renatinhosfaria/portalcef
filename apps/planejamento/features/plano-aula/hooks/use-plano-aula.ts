"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useState } from "react";
import type {
  PlanoAula,
  PlanoAulaSummary,
  DashboardData,
  CriarPlanoResult,
  PlanoDocumento,
  AddComentarioDto,
  FiltrosGestaoPlanos,
  ListagemPlanosResponse,
  PlanoAulaListItem,
} from "../types";

// ============================================
// Hook para Professora
// ============================================

interface UsePlanoAulaReturn {
  loading: boolean;
  error: string | null;
  criarPlano: (
    turmaId: string,
    quinzenaId: string,
  ) => Promise<CriarPlanoResult>;
  getPlano: (id: string) => Promise<PlanoAula>;
  uploadDocumento: (planoId: string, file: File) => Promise<PlanoDocumento>;
  addLink: (planoId: string, url: string) => Promise<PlanoDocumento>;
  deleteDocumento: (planoId: string, docId: string) => Promise<void>;
  aprovarDocumento: (documentoId: string) => Promise<PlanoDocumento>;
  submeterPlano: (planoId: string) => Promise<{ success: boolean }>;
  editarComentario: (comentarioId: string, comentario: string) => Promise<void>;
  deletarComentario: (comentarioId: string) => Promise<void>;
}

/**
 * Hook para ações da Professora
 * - Criar plano de aula
 * - Upload de documentos
 * - Adicionar links do YouTube
 * - Excluir documentos
 * - Submeter para análise
 */
export function usePlanoAula(): UsePlanoAulaReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criarPlano = useCallback(
    async (turmaId: string, quinzenaId: string): Promise<CriarPlanoResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<CriarPlanoResult>("/plano-aula", {
          turmaId,
          quinzenaId,
        });
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao criar plano";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getPlano = useCallback(async (id: string): Promise<PlanoAula> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PlanoAula>(`/plano-aula/${id}`);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar plano";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocumento = useCallback(
    async (planoId: string, file: File): Promise<PlanoDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await api.post<PlanoDocumento>(
          `/plano-aula/${planoId}/documentos/upload`,
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
    async (planoId: string, url: string): Promise<PlanoDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<PlanoDocumento>(
          `/plano-aula/${planoId}/documentos/link`,
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
    async (planoId: string, docId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await api.delete(`/plano-aula/${planoId}/documentos/${docId}`);
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
    async (documentoId: string): Promise<PlanoDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<PlanoDocumento>(
          `/plano-aula/documentos/${documentoId}/aprovar`,
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

  const submeterPlano = useCallback(
    async (planoId: string): Promise<{ success: boolean }> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<{ success: boolean }>(
          `/plano-aula/${planoId}/submeter`,
          {}, // Body vazio necessário para Content-Type: application/json
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao submeter plano";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const editarComentario = useCallback(
    async (comentarioId: string, comentario: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await api.patch(`/plano-aula/comentarios/${comentarioId}`, {
          comentario,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao editar comentário";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deletarComentario = useCallback(
    async (comentarioId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await api.delete(`/plano-aula/comentarios/${comentarioId}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao deletar comentário";
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
    criarPlano,
    getPlano,
    uploadDocumento,
    addLink,
    deleteDocumento,
    aprovarDocumento,
    submeterPlano,
    editarComentario,
    deletarComentario,
  };
}

// ============================================
// Hook para Analista Pedagógica
// ============================================

interface UseAnalistaActionsReturn {
  loading: boolean;
  listarPendentes: () => Promise<PlanoAulaSummary[]>;
  aprovar: (planoId: string) => Promise<void>;
  devolver: (
    planoId: string,
    comentarios?: AddComentarioDto[],
  ) => Promise<void>;
}

/**
 * Hook para ações da Analista Pedagógica
 * - Listar planos pendentes de análise
 * - Aprovar plano (envia para coordenação)
 * - Devolver plano (envia para professora)
 */
export function useAnalistaActions(): UseAnalistaActionsReturn {
  const [loading, setLoading] = useState(false);

  const listarPendentes = useCallback(async (): Promise<PlanoAulaSummary[]> => {
    const result = await api.get<PlanoAulaSummary[]>(
      "/plano-aula/analista/pendentes",
    );
    return result || [];
  }, []);

  const aprovar = useCallback(async (planoId: string): Promise<void> => {
    setLoading(true);
    try {
      await api.post(`/plano-aula/${planoId}/analista/aprovar`, {});
    } finally {
      setLoading(false);
    }
  }, []);

  const devolver = useCallback(
    async (
      planoId: string,
      comentarios?: AddComentarioDto[],
    ): Promise<void> => {
      setLoading(true);
      try {
        await api.post(`/plano-aula/${planoId}/analista/devolver`, {
          comentarios,
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
// Hook para Coordenadora de Segmento
// ============================================

interface UseCoordenadoraActionsReturn {
  loading: boolean;
  listarPendentes: () => Promise<PlanoAulaSummary[]>;
  aprovar: (planoId: string) => Promise<void>;
  devolver: (
    planoId: string,
    destino: "PROFESSORA" | "ANALISTA",
    comentarios?: AddComentarioDto[],
  ) => Promise<void>;
}

/**
 * Hook para ações da Coordenadora de Segmento
 * - Listar planos pendentes de aprovação
 * - Aprovar plano (aprovação final)
 * - Devolver plano (para professora ou analista)
 */
export function useCoordenadoraActions(): UseCoordenadoraActionsReturn {
  const [loading, setLoading] = useState(false);

  const listarPendentes = useCallback(async (): Promise<PlanoAulaSummary[]> => {
    const result = await api.get<PlanoAulaSummary[]>(
      "/plano-aula/coordenadora/pendentes",
    );
    return result || [];
  }, []);

  const aprovar = useCallback(async (planoId: string): Promise<void> => {
    setLoading(true);
    try {
      await api.post(`/plano-aula/${planoId}/coordenadora/aprovar`, {});
    } finally {
      setLoading(false);
    }
  }, []);

  const devolver = useCallback(
    async (
      planoId: string,
      destino: "PROFESSORA" | "ANALISTA",
      comentarios?: AddComentarioDto[],
    ): Promise<void> => {
      setLoading(true);
      try {
        await api.post(`/plano-aula/${planoId}/coordenadora/devolver`, {
          destino,
          comentarios,
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
// Hook para Dashboard (Gestão)
// ============================================

interface UseDashboardReturn {
  loading: boolean;
  data: DashboardData | null;
  error: string | null;
  fetchDashboard: (quinzenaId?: string) => Promise<void>;
}

/**
 * Hook para Dashboard de Gestão
 * - Estatísticas gerais (total, pendentes, aprovados, etc.)
 * - Estatísticas por segmento
 */
export function useDashboard(): UseDashboardReturn {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(
    async (quinzenaId?: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (quinzenaId) {
          params.append("quinzenaId", quinzenaId);
        }
        const queryString = params.toString() ? `?${params.toString()}` : "";

        const result = await api.get<DashboardData>(
          `/plano-aula/dashboard${queryString}`,
        );
        setData(result);
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
// Hook para Configuração de Prazos
// ============================================

interface QuinzenaConfig {
  id: string;
  unitId: string;
  quinzenaId: string;
  deadline: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface UseDeadlinesReturn {
  loading: boolean;
  deadlines: QuinzenaConfig[];
  error: string | null;
  fetchDeadlines: () => Promise<void>;
  setDeadline: (quinzenaId: string, deadline: string) => Promise<void>;
}

/**
 * Hook para Configuração de Prazos (Coordenadora Geral)
 * - Listar prazos configurados
 * - Definir/atualizar prazo de uma quinzena
 */
export function useDeadlines(): UseDeadlinesReturn {
  const [loading, setLoading] = useState(false);
  const [deadlines, setDeadlines] = useState<QuinzenaConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDeadlines = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<QuinzenaConfig[]>(
        "/plano-aula/config/deadlines",
      );
      setDeadlines(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar prazos";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const setDeadline = useCallback(
    async (quinzenaId: string, deadline: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await api.post("/plano-aula/config/deadline", { quinzenaId, deadline });
        // Atualizar lista local
        await fetchDeadlines();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao definir prazo";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchDeadlines],
  );

  return { loading, deadlines, error, fetchDeadlines, setDeadline };
}

// ============================================
// Hook para Buscar Plano Individual
// ============================================

interface UsePlanoDetalheReturn {
  loading: boolean;
  plano: PlanoAula | null;
  error: string | null;
  fetchPlano: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar detalhes de um plano específico
 * Útil para telas de revisão (analista/coordenadora)
 */
export function usePlanoDetalhe(planoId?: string): UsePlanoDetalheReturn {
  const [loading, setLoading] = useState(false);
  const [plano, setPlano] = useState<PlanoAula | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | undefined>(planoId);

  const fetchPlano = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    setCurrentId(id);
    try {
      const result = await api.get<PlanoAula>(`/plano-aula/${id}`);
      setPlano(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar plano";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async (): Promise<void> => {
    if (currentId) {
      await fetchPlano(currentId);
    }
  }, [currentId, fetchPlano]);

  return { loading, plano, error, fetchPlano, refetch };
}

// ============================================
// Hook para Listagem de Planos (Gestão)
// ============================================

interface UseGestaoPlanosReturn {
  planos: PlanoAulaListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  isLoading: boolean;
  error: string | null;
  fetchPlanos: (filtros: FiltrosGestaoPlanos) => Promise<void>;
}

/**
 * Hook para Listagem de Planos da Gestão
 * - Lista planos com filtros e paginação
 * - Suporta filtros por status, quinzena, segmento, professora
 */
export function useGestaoPlanos(): UseGestaoPlanosReturn {
  const [planos, setPlanos] = useState<PlanoAulaListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanos = useCallback(
    async (filtros: FiltrosGestaoPlanos): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();

        // Adicionar filtros aos query params
        if (filtros.status) {
          params.append("status", filtros.status);
        }
        if (filtros.quinzenaId) {
          params.append("quinzenaId", filtros.quinzenaId);
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
        const result = await api.get<ListagemPlanosResponse>(
          `/plano-aula/gestao/listar?${queryString}`,
        );

        setPlanos(result.data || []);
        setPagination(result.pagination);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao buscar planos";
        setError(message);
        setPlanos([]);
        setPagination({ total: 0, page: 1, limit: 20, totalPages: 0 });
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { planos, pagination, isLoading, error, fetchPlanos };
}
