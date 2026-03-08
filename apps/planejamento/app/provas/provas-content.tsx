"use client";

/**
 * ProvasContent - Lista de ciclos de prova da professora
 * Espelha o PlanejamentosContent adaptado para ciclos de prova
 */

import { api } from "@essencia/shared/fetchers/client";
import { Badge } from "@essencia/ui/components/badge";
import {
  Card,
  CardContent,
} from "@essencia/ui/components/card";
import { cn } from "@essencia/ui/lib/utils";
import { ArrowLeft, Calendar, ClipboardCheck, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  useCiclosDaTurma,
  type ProvaCiclo,
  type ProvaStatus,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../../features/prova";

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

interface ProvaExistente {
  id: string;
  provaCicloId: string;
  status: string;
}

function ProvaStatusBadge({ status }: { status: ProvaStatus }) {
  const colors = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  if (!colors) return null;

  return (
    <Badge
      variant="outline"
      className={cn(colors.bg, colors.text, colors.border, "border")}
    >
      {label}
    </Badge>
  );
}

export function ProvasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turmaIdParam = searchParams.get("turmaId");

  const [turma, setTurma] = useState<Turma | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [temMultiplasTurmas, setTemMultiplasTurmas] = useState(false);
  const [provasExistentes, setProvasExistentes] = useState<ProvaExistente[]>([]);
  const [isLoadingTurma, setIsLoadingTurma] = useState(true);
  const [isLoadingProvas, setIsLoadingProvas] = useState(true);
  const [errorTurma, setErrorTurma] = useState<string | null>(null);

  // Buscar turma e etapa do usuario
  useEffect(() => {
    async function fetchUserData() {
      try {
        setIsLoadingTurma(true);
        setErrorTurma(null);

        const turmas = await api.get<Turma[]>("/plannings/turmas");
        const turmasList = Array.isArray(turmas) ? turmas : [];

        setTemMultiplasTurmas(turmasList.length > 1);

        let selectedTurma: Turma | null = null;

        if (turmaIdParam) {
          selectedTurma = turmasList.find((t) => t.id === turmaIdParam) || null;
          if (!selectedTurma && turmasList.length > 1) {
            router.replace("/provas/turmas");
            return;
          }
        }

        if (!turmaIdParam && turmasList.length > 1) {
          router.replace("/provas/turmas");
          return;
        }

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
        console.error("Erro ao buscar dados do usuario:", err);
        setErrorTurma(err instanceof Error ? err.message : "Erro ao buscar turma");
      } finally {
        setIsLoadingTurma(false);
      }
    }

    fetchUserData();
  }, [turmaIdParam, router]);

  // Buscar provas existentes da professora
  useEffect(() => {
    async function fetchProvasExistentes() {
      try {
        setIsLoadingProvas(true);
        const response = await api.get<{ data: ProvaExistente[] }>("/prova/meus");
        if (response && Array.isArray(response.data)) {
          setProvasExistentes(response.data);
        } else if (Array.isArray(response)) {
          setProvasExistentes(response as unknown as ProvaExistente[]);
        } else {
          setProvasExistentes([]);
        }
      } catch (err) {
        console.error("Erro ao buscar provas existentes:", err);
        setProvasExistentes([]);
      } finally {
        setIsLoadingProvas(false);
      }
    }

    fetchProvasExistentes();
  }, []);

  // Buscar ciclos da turma
  const {
    ciclos,
    isLoading: isLoadingCiclos,
    error: errorCiclos,
  } = useCiclosDaTurma(turma?.id || "");

  // Mapa de cicloId -> prova existente
  const provasPorCiclo = useMemo(() => {
    const map = new Map<string, ProvaExistente>();
    for (const prova of provasExistentes) {
      map.set(prova.provaCicloId, prova);
    }
    return map;
  }, [provasExistentes]);

  const isLoading = isLoadingTurma || isLoadingCiclos || isLoadingProvas;
  const error = errorTurma || errorCiclos;

  /**
   * Formata data para exibicao
   */
  function formatarData(dataIso: string): string {
    return new Date(dataIso).toLocaleDateString("pt-BR");
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        {temMultiplasTurmas && (
          <div className="mb-4">
            <Link
              href="/provas/turmas"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Minhas Turmas
            </Link>
          </div>
        )}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Minhas Provas
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
            Carregando provas...
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
      {!isLoading && !error && ciclos.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Calendar className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              Nenhum ciclo de prova disponivel
            </h2>
            <p className="text-muted-foreground max-w-md">
              Nao ha ciclos de prova configurados para sua etapa no momento.
              Aguarde a coordenacao configurar os ciclos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grid de Ciclos de Prova */}
      {!isLoading && !error && ciclos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ciclos.map((ciclo) => {
            const provaExistente = provasPorCiclo.get(ciclo.id);

            return (
              <CicloCard
                key={ciclo.id}
                ciclo={ciclo}
                provaExistente={provaExistente}
                turmaId={turma?.id || ""}
                formatarData={formatarData}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CicloCardProps {
  ciclo: ProvaCiclo;
  provaExistente?: ProvaExistente;
  turmaId: string;
  formatarData: (data: string) => string;
}

function CicloCard({ ciclo, provaExistente, turmaId, formatarData }: CicloCardProps) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={() =>
        router.push(`/provas/${ciclo.id}?turmaId=${turmaId}`)
      }
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">
                {ciclo.descricao || `${ciclo.numero}a Prova`}
              </h3>
              <p className="text-xs text-muted-foreground">
                {formatarData(ciclo.dataInicio)} - {formatarData(ciclo.dataFim)}
              </p>
            </div>
          </div>
          {provaExistente && (
            <ProvaStatusBadge status={provaExistente.status as ProvaStatus} />
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Prazo:{" "}
            {new Date(ciclo.dataMaximaEntrega).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
