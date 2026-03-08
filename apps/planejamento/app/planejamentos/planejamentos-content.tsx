"use client";

import { api } from "@essencia/shared/fetchers/client";
import { ArrowLeft, LayoutDashboard, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PeriodosEmptyState } from "../../features/periodos/components/periodos-empty-state";
import { PlanoAulaGrid } from "../../features/periodos/components/plano-aula-grid";
import { usePeriodosDaTurma } from "../../features/periodos/hooks/use-periodos";

interface Turma {
  id: string;
  name: string;
  code: string;
  stageId: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface PlanoExistente {
  id: string;
  planoAulaPeriodoId?: string;
  quinzenaId?: string;
  status: string;
}

interface FeriasResponse {
  success: boolean;
  data?: { startDate: string };
}

export function PlanejamentosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turmaIdParam = searchParams.get("turmaId");

  const [turma, setTurma] = useState<Turma | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [temMultiplasTurmas, setTemMultiplasTurmas] = useState(false);
  const [planosExistentes, setPlanosExistentes] = useState<PlanoExistente[]>([]);
  const [dataInicioFeriasJulho, setDataInicioFeriasJulho] = useState<string | undefined>(undefined);
  const [isLoadingTurma, setIsLoadingTurma] = useState(true);
  const [isLoadingPlanos, setIsLoadingPlanos] = useState(true);
  const [errorTurma, setErrorTurma] = useState<string | null>(null);

  // Buscar turma e etapa do usuário
  useEffect(() => {
    async function fetchUserData() {
      try {
        setIsLoadingTurma(true);
        setErrorTurma(null);

        const turmas = await api.get<Turma[]>("/plannings/turmas");
        const turmasList = Array.isArray(turmas) ? turmas : [];

        setTemMultiplasTurmas(turmasList.length > 1);

        // Determinar turma: pelo param da URL ou a primeira (única)
        let selectedTurma: Turma | null = null;

        if (turmaIdParam) {
          selectedTurma = turmasList.find((t) => t.id === turmaIdParam) || null;
          // turmaId inválido → redireciona para seleção
          if (!selectedTurma && turmasList.length > 1) {
            router.replace("/planejamentos/turmas");
            return;
          }
        }

        // Sem param e múltiplas turmas → seleção
        if (!turmaIdParam && turmasList.length > 1) {
          router.replace("/planejamentos/turmas");
          return;
        }

        // Sem param e 1 turma → usa a única
        if (!selectedTurma && turmasList.length > 0) {
          selectedTurma = turmasList[0] ?? null;
        }

        setTurma(selectedTurma);

        if (selectedTurma) {
          const stages = await api.get<Stage[]>("/stages");
          const userStage = Array.isArray(stages)
            ? stages.find((s) => s.id === selectedTurma!.stageId)
            : null;
          setStage(userStage || null);
        }
      } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        setErrorTurma(err instanceof Error ? err.message : "Erro ao buscar turma");
      } finally {
        setIsLoadingTurma(false);
      }
    }

    fetchUserData();
  }, [turmaIdParam, router]);

  // Buscar planos existentes da professora
  useEffect(() => {
    async function fetchPlanosExistentes() {
      try {
        setIsLoadingPlanos(true);
        const response = await api.get<{ data: PlanoExistente[] }>("/plano-aula/meus");
        if (response && Array.isArray(response.data)) {
          setPlanosExistentes(response.data);
        } else if (Array.isArray(response)) {
          setPlanosExistentes(response);
        } else {
          setPlanosExistentes([]);
        }
      } catch (err) {
        console.error("Erro ao buscar planos existentes:", err);
        setPlanosExistentes([]);
      } finally {
        setIsLoadingPlanos(false);
      }
    }

    fetchPlanosExistentes();
  }, []);

  // Buscar data de início das férias de julho
  useEffect(() => {
    async function fetchFeriasJulho() {
      try {
        const response = await api.get<FeriasResponse>(
          `/calendar/ferias-julho?year=${new Date().getFullYear()}`,
        );
        if (response?.success && response.data?.startDate) {
          setDataInicioFeriasJulho(response.data.startDate);
        }
      } catch (err) {
        console.error("Erro ao buscar data de férias:", err);
      }
    }

    fetchFeriasJulho();
  }, []);

  // Buscar períodos da turma
  const {
    periodos,
    isLoading: isLoadingPeriodos,
    error: errorPeriodos,
  } = usePeriodosDaTurma(turma?.id || "");

  const isLoading = isLoadingTurma || isLoadingPeriodos || isLoadingPlanos;
  const error = errorTurma || errorPeriodos;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        {temMultiplasTurmas && (
          <div className="mb-4">
            <Link
              href="/planejamentos/turmas"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Minhas Turmas
            </Link>
          </div>
        )}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Meus Planos de Aula
          </h1>
        </div>
        {turma && (
          <p className="text-muted-foreground">
            Turma: {turma.name} {stage ? `• ${stage.name}` : ""}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Carregando planos de aula...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && periodos.length === 0 && (
        <PeriodosEmptyState etapa={stage?.name || ""} />
      )}

      {/* Grid de Planos de Aula por Semestre */}
      {!isLoading && !error && periodos.length > 0 && (
        <PlanoAulaGrid
          periodos={periodos}
          planosExistentes={planosExistentes}
          dataInicioFeriasJulho={dataInicioFeriasJulho}
        />
      )}
    </div>
  );
}
