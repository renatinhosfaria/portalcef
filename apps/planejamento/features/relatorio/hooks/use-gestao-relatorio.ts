"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useState } from "react";

import { obterMensagemErro } from "../../../lib/mensagens-erro";
import type {
  DashboardRelatorioData,
  FiltrosGestaoRelatorios,
  RelatorioDocumento,
  RelatorioListItem,
  RelatorioStatus,
} from "../types";

interface DashboardItemApi {
  status: RelatorioStatus;
  count: number;
}

interface DashboardApiLegado {
  totais?: DashboardItemApi[];
  porSegmento?: Record<string, DashboardItemApi[]>;
}

interface UseGestaoRelatorioReturn {
  loading: boolean;
  dashboardData: DashboardRelatorioData | null;
  relatorios: RelatorioListItem[];
  fetchDashboard: () => Promise<DashboardRelatorioData>;
  listar: (filtros?: FiltrosGestaoRelatorios) => Promise<RelatorioListItem[]>;
  aprovarCoordenadora: (relatorioId: string) => Promise<void>;
  devolverCoordenadora: (relatorioId: string, motivo: string) => Promise<void>;
  regerarPdfDocumento: (
    relatorioId: string,
    documentoId: string,
  ) => Promise<RelatorioDocumento>;
  imprimirDocumento: (
    relatorioId: string,
    documentoId: string,
  ) => Promise<RelatorioDocumento>;
}

const STATS_VAZIAS: DashboardRelatorioData["stats"] = {
  total: 0,
  rascunho: 0,
  aguardandoAnalista: 0,
  aguardandoCoordenadora: 0,
  devolvidos: 0,
  aprovados: 0,
};

function somarStatus(
  itens: DashboardItemApi[],
  status: RelatorioStatus[],
): number {
  return itens.reduce(
    (total, item) => (status.includes(item.status) ? total + item.count : total),
    0,
  );
}

function normalizarDashboard(
  payload: DashboardRelatorioData | DashboardApiLegado,
): DashboardRelatorioData {
  if ("stats" in payload && payload.stats) {
    return payload;
  }

  const totais = (payload as DashboardApiLegado).totais ?? [];
  const porSegmentoRaw = (payload as DashboardApiLegado).porSegmento ?? {};
  const porSegmento: DashboardRelatorioData["porSegmento"] = {};

  for (const [segmento, itens] of Object.entries(porSegmentoRaw)) {
    porSegmento[segmento] = {
      total: itens.reduce((total, item) => total + item.count, 0),
      aprovados: somarStatus(itens, ["APROVADO"]),
    };
  }

  return {
    stats: {
      total: totais.reduce((total, item) => total + item.count, 0),
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
    },
    porSegmento,
  };
}

export function useGestaoRelatorio(): UseGestaoRelatorioReturn {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] =
    useState<DashboardRelatorioData | null>(null);
  const [relatorios, setRelatorios] = useState<RelatorioListItem[]>([]);

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

  const fetchDashboard = useCallback(
    () =>
      executar(
        async () => {
          const payload = await api.get<DashboardRelatorioData | DashboardApiLegado>(
            "/relatorio/gestao/dashboard",
          );
          const normalizado = normalizarDashboard(payload ?? { totais: [] });
          setDashboardData(normalizado);
          return normalizado;
        },
        "Não foi possível carregar o painel de relatórios. Tente novamente.",
      ),
    [executar],
  );

  const listar = useCallback(
    (filtros: FiltrosGestaoRelatorios = {}) =>
      executar(
        async () => {
          const params = new URLSearchParams();
          if (filtros.status && filtros.status !== "todos") {
            params.set("status", filtros.status);
          }
          if (filtros.etapa) params.set("etapa", filtros.etapa);
          if (filtros.semestreId) params.set("semestreId", filtros.semestreId);
          const query = params.toString() ? `?${params.toString()}` : "";
          const data =
            (await api.get<RelatorioListItem[]>(
              `/relatorio/gestao/lista${query}`,
            )) ?? [];
          setRelatorios(data);
          return data;
        },
        "Não foi possível carregar a listagem de relatórios. Tente novamente.",
      ),
    [executar],
  );

  const aprovarCoordenadora = useCallback(
    (relatorioId: string) =>
      executar(
        async () => {
          await api.post(`/relatorio/${relatorioId}/aprovar-coordenadora`, {});
        },
        "Não foi possível aprovar o relatório. Tente novamente.",
      ),
    [executar],
  );

  const devolverCoordenadora = useCallback(
    (relatorioId: string, motivo: string) =>
      executar(
        async () => {
          await api.post(`/relatorio/${relatorioId}/devolver-coordenadora`, {
            motivo,
          });
        },
        "Não foi possível devolver o relatório. Tente novamente.",
      ),
    [executar],
  );

  const regerarPdfDocumento = useCallback(
    (relatorioId: string, documentoId: string) =>
      executar(
        () =>
          api.post<RelatorioDocumento>(
            `/relatorio/${relatorioId}/documento/${documentoId}/regerar-pdf`,
            {},
          ),
        "Não foi possível tentar gerar o PDF novamente. Tente novamente.",
      ),
    [executar],
  );

  const imprimirDocumento = useCallback(
    (relatorioId: string, documentoId: string) =>
      executar(
        () =>
          api.post<RelatorioDocumento>(
            `/relatorio/${relatorioId}/documento/${documentoId}/imprimir`,
            {},
          ),
        "Não foi possível registrar a impressão. Tente novamente.",
      ),
    [executar],
  );

  return {
    loading,
    dashboardData,
    relatorios,
    fetchDashboard,
    listar,
    aprovarCoordenadora,
    devolverCoordenadora,
    regerarPdfDocumento,
    imprimirDocumento,
  };
}
