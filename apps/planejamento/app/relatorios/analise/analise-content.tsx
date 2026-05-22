"use client";

import { formatarDataHora } from "@essencia/shared/formatar-data";
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
  STATUS_COLORS,
  STATUS_LABELS,
  type RelatorioStatus,
  type RelatorioSummary,
  useAnalistaRelatorio,
} from "../../../features/relatorio";
import { obterMensagemErro } from "../../../lib/mensagens-erro";

const segmentos = [
  { value: "todos", label: "Todos", code: null },
  { value: "bercario", label: "Berçário", code: "BERCARIO" },
  { value: "infantil", label: "Infantil", code: "INFANTIL" },
] as const;

type SegmentoValue = (typeof segmentos)[number]["value"];

function getEtapaCode(relatorio: RelatorioSummary): string | undefined {
  return relatorio.etapaCode;
}

function StatusBadge({ status }: { status: RelatorioStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AnaliseRelatorioContent() {
  const { listarPendentes } = useAnalistaRelatorio();
  const [relatorios, setRelatorios] = useState<RelatorioSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segmentoAtivo, setSegmentoAtivo] =
    useState<SegmentoValue>("todos");

  const carregarRelatorios = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRelatorios(await listarPendentes());
    } catch (err) {
      setError(
        obterMensagemErro(
          err,
          "Não foi possível carregar os relatórios pendentes. Tente novamente.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [listarPendentes]);

  useEffect(() => {
    void carregarRelatorios();
  }, [carregarRelatorios]);

  const relatoriosFiltrados = useMemo(() => {
    if (segmentoAtivo === "todos") return relatorios;
    const segmento = segmentos.find((item) => item.value === segmentoAtivo);
    if (!segmento?.code) return relatorios;
    return relatorios.filter((relatorio) => getEtapaCode(relatorio) === segmento.code);
  }, [relatorios, segmentoAtivo]);

  const contagemPorSegmento = useMemo(() => {
    const contagem: Record<string, number> = { todos: relatorios.length };
    for (const segmento of segmentos) {
      if (segmento.code) {
        contagem[segmento.value] = relatorios.filter(
          (relatorio) => getEtapaCode(relatorio) === segmento.code,
        ).length;
      }
    }
    return contagem;
  }, [relatorios]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Análise de Relatórios
            </h1>
            <div className="text-muted-foreground">
              {isLoading ? (
                <Skeleton className="inline-block h-4 w-48" />
              ) : (
                `${relatorios.length} relatório${relatorios.length !== 1 ? "s" : ""} pendente${relatorios.length !== 1 ? "s" : ""} de análise`
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {segmentos.map((segmento) => {
          const count = contagemPorSegmento[segmento.value] || 0;
          const isActive = segmentoAtivo === segmento.value;

          return (
            <button
              key={segmento.value}
              type="button"
              onClick={() => setSegmentoAtivo(segmento.value)}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {segmento.label}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Carregando relatórios pendentes...
          </span>
        </div>
      )}

      {error && !isLoading && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center text-destructive">
            <p className="font-medium">Erro ao carregar relatórios</p>
            <p className="mt-1 text-sm">{error}</p>
            <button
              type="button"
              onClick={carregarRelatorios}
              className="mt-4 text-sm underline hover:no-underline"
            >
              Tentar novamente
            </button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && relatoriosFiltrados.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <FileSearch className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">
              Nenhum relatório pendente
            </h2>
            <p className="max-w-md text-muted-foreground">
              Não há relatórios aguardando análise no momento.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && relatoriosFiltrados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Relatórios Aguardando Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professora</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Data Envio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatoriosFiltrados.map((relatorio) => (
                  <TableRow key={relatorio.id}>
                    <TableCell className="font-medium">
                      {relatorio.professorName}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{relatorio.turmaName}</span>
                      {relatorio.turmaCode && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({relatorio.turmaCode})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relatorio.etapaName || relatorio.etapaCode || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relatorio.submittedAt
                        ? formatarDataHora(relatorio.submittedAt)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={relatorio.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/relatorios/analise/${relatorio.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
