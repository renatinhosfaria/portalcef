"use client";

import { api } from "@essencia/shared/fetchers/client";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { PeriodoCardProfessora } from "../../features/periodos/components/periodo-card-professora";
import { PeriodosEmptyState } from "../../features/periodos/components/periodos-empty-state";
import { usePeriodosDaTurma } from "../../features/periodos/hooks/use-periodos";

/**
 * Interface da turma do usuário
 */
interface Turma {
  id: string;
  name: string;
  code: string;
  stageId: string;
}

/**
 * Interface da etapa (stage)
 */
interface Stage {
  id: string;
  name: string;
  code: string;
}

export function PlanejamentosContent() {
  const [turma, setTurma] = useState<Turma | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [isLoadingTurma, setIsLoadingTurma] = useState(true);
  const [errorTurma, setErrorTurma] = useState<string | null>(null);

  // Buscar turma e etapa do usuário
  useEffect(() => {
    async function fetchUserData() {
      try {
        setIsLoadingTurma(true);
        setErrorTurma(null);

        // Buscar turmas do usuário
        const turmas = await api.get<Turma[]>("/plannings/turmas");
        const primaryTurma = Array.isArray(turmas) && turmas.length > 0 ? turmas[0] : null;
        setTurma(primaryTurma);

        // Buscar etapa da turma
        if (primaryTurma) {
          const stages = await api.get<Stage[]>("/stages");
          const userStage = Array.isArray(stages)
            ? stages.find((s) => s.id === primaryTurma.stageId)
            : null;
          setStage(userStage || null);
        }
      } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        setErrorTurma(
          err instanceof Error ? err.message : "Erro ao buscar turma"
        );
      } finally {
        setIsLoadingTurma(false);
      }
    }

    fetchUserData();
  }, []);

  // Buscar períodos da turma
  const { periodos, isLoading: isLoadingPeriodos, error: errorPeriodos } = usePeriodosDaTurma(
    turma?.id || ""
  );

  const isLoading = isLoadingTurma || isLoadingPeriodos;
  const error = errorTurma || errorPeriodos;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
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

      {/* Grid de Períodos */}
      {!isLoading && !error && periodos.length > 0 && (
        <div className="grid gap-4">
          {periodos.map((periodo) => (
            <PeriodoCardProfessora
              key={periodo.id}
              periodo={periodo}
              planoExistente={undefined} // TODO: Buscar plano existente via API
            />
          ))}
        </div>
      )}
    </div>
  );
}
