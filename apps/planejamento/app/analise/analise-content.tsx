"use client";

/**
 * AnaliseContent Component
 * Client component para a dashboard da analista pedagogica
 * Task 4.2: Exibe lista de planos pendentes com filtro por segmento
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@essencia/ui/components/table";
import { cn } from "@essencia/ui/lib/utils";
import { ClipboardList, FileSearch, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PlanoStatusBadge,
  useAnalistaActions,
  type PlanoAulaSummary,
} from "../../features/plano-aula";

/**
 * Definicao dos segmentos para filtro
 */
const segmentos = [
  { value: "todos", label: "Todos", code: null },
  { value: "bercario", label: "Bercario", code: "BERCARIO" },
  { value: "infantil", label: "Infantil", code: "INFANTIL" },
  { value: "fundamental_i", label: "Fund. I", code: "FUNDAMENTAL_I" },
  { value: "fundamental_ii", label: "Fund. II", code: "FUNDAMENTAL_II" },
] as const;

type SegmentoValue = (typeof segmentos)[number]["value"];

/**
 * Formata a data de envio para exibicao
 */
function formatarDataEnvio(data?: string): string {
  if (!data) return "-";
  const date = new Date(data);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Extrai o nome da quinzena do ID (ex: "2026-Q01" -> "Quinzena 01")
 */
function formatarQuinzena(quinzenaId: string): string {
  const match = quinzenaId.match(/Q(\d+)/);
  if (match?.[1]) {
    return `Quinzena ${match[1]}`;
  }
  return quinzenaId;
}

export function AnaliseContent() {
  const { listarPendentes } = useAnalistaActions();
  const [planos, setPlanos] = useState<PlanoAulaSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segmentoAtivo, setSegmentoAtivo] = useState<SegmentoValue>("todos");

  /**
   * Carrega os planos pendentes da API
   */
  const carregarPlanos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resultado = await listarPendentes();
      setPlanos(resultado);
    } catch (err) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Erro ao carregar planos pendentes";
      setError(mensagem);
    } finally {
      setIsLoading(false);
    }
  }, [listarPendentes]);

  useEffect(() => {
    carregarPlanos();
  }, [carregarPlanos]);

  /**
   * Filtra planos pelo segmento selecionado
   */
  const planosFiltrados = useMemo(() => {
    if (segmentoAtivo === "todos") {
      return planos;
    }
    const segmento = segmentos.find((s) => s.value === segmentoAtivo);
    if (!segmento?.code) {
      return planos;
    }
    return planos.filter((p) => p.stageCode === segmento.code);
  }, [planos, segmentoAtivo]);

  /**
   * Calcula contagem por segmento para exibir nas tabs
   */
  const contagemPorSegmento = useMemo(() => {
    const contagem: Record<string, number> = { todos: planos.length };
    for (const segmento of segmentos) {
      if (segmento.code) {
        contagem[segmento.value] = planos.filter(
          (p) => p.stageCode === segmento.code,
        ).length;
      }
    }
    return contagem;
  }, [planos]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Analise de Planos de Aula
            </h1>
            <p className="text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-48 inline-block" />
              ) : (
                `${planos.length} plano${planos.length !== 1 ? "s" : ""} pendente${planos.length !== 1 ? "s" : ""} de analise`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filtro por Segmento (Tabs) */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg bg-muted p-1 flex-wrap gap-1">
          {segmentos.map((segmento) => {
            const count = contagemPorSegmento[segmento.value] || 0;
            const isActive = segmentoAtivo === segmento.value;

            return (
              <button
                key={segmento.value}
                onClick={() => setSegmentoAtivo(segmento.value)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {segmento.label}
                <span
                  className={cn(
                    "text-xs rounded-full px-2 py-0.5",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted-foreground/10 text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Carregando planos pendentes...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p className="font-medium">Erro ao carregar planos</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={carregarPlanos}
                className="mt-4 text-sm underline hover:no-underline"
              >
                Tentar novamente
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && planosFiltrados.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileSearch className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">
                Nenhum plano pendente
              </h2>
              <p className="text-muted-foreground max-w-md">
                {segmentoAtivo === "todos"
                  ? "Nao ha planos de aula aguardando sua analise no momento."
                  : `Nao ha planos de aula do segmento "${segmentos.find((s) => s.value === segmentoAtivo)?.label}" aguardando analise.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Planos */}
      {!isLoading && !error && planosFiltrados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Planos Aguardando Analise</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professora</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Quinzena</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Data Envio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planosFiltrados.map((plano) => (
                  <TableRow key={plano.id}>
                    <TableCell className="font-medium">
                      {plano.professorName}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{plano.turmaName}</span>
                        {plano.turmaCode && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({plano.turmaCode})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatarQuinzena(plano.quinzenaId)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {plano.stageName || plano.stageCode || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatarDataEnvio(plano.submittedAt)}
                    </TableCell>
                    <TableCell>
                      <PlanoStatusBadge status={plano.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/analise/${plano.id}`}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                      >
                        Revisar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
