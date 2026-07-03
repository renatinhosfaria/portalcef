"use client";

import { formatarData } from "@essencia/shared/formatar-data";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
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
import { ArrowLeft, Eye, FileText, RefreshCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  STATUS_COLORS,
  STATUS_LABELS,
  type RelatorioListItem,
  type RelatorioStatus,
  useGestaoRelatorio,
} from "../../../../features/relatorio";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "RASCUNHO", label: "Rascunhos" },
  { value: "AGUARDANDO_ANALISTA", label: "Aguardando Analista" },
  { value: "AGUARDANDO_COORDENADORA", label: "Aguardando Coordenação" },
  { value: "DEVOLVIDO_ANALISTA", label: "Devolvidos pela Analista" },
  { value: "DEVOLVIDO_COORDENADORA", label: "Devolvidos pela Coordenadora" },
  { value: "APROVADO", label: "Aprovados" },
] as const;

const ETAPA_OPTIONS = [
  { value: "todos", label: "Todas as Etapas" },
  { value: "BERCARIO", label: "Berçário" },
  { value: "INFANTIL", label: "Infantil" },
] as const;

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

function getVerUrl(relatorio: RelatorioListItem): string {
  if (relatorio.status === "RASCUNHO") {
    return `/relatorios/${relatorio.semestreId}?turmaId=${relatorio.id}`;
  }
  return `/relatorios/analise/${relatorio.id}`;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function RelatoriosGestaoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") || "todos");
  const [etapa, setEtapa] = useState(searchParams.get("etapa") || "todos");
  const { relatorios, loading, listar } = useGestaoRelatorio();

  const buscarRelatorios = useCallback(() => {
    listar({
      status,
      etapa: etapa === "todos" ? undefined : (etapa as "BERCARIO" | "INFANTIL"),
    });
  }, [etapa, listar, status]);

  useEffect(() => {
    buscarRelatorios();
  }, [buscarRelatorios]);

  const atualizarUrl = useCallback(
    (novosFiltros: { status?: string; etapa?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (novosFiltros.status !== undefined) {
        if (novosFiltros.status === "todos") params.delete("status");
        else params.set("status", novosFiltros.status);
      }
      if (novosFiltros.etapa !== undefined) {
        if (novosFiltros.etapa === "todos") params.delete("etapa");
        else params.set("etapa", novosFiltros.etapa);
      }
      const query = params.toString();
      router.push(`/relatorios/gestao/relatorios${query ? `?${query}` : ""}`);
    },
    [router, searchParams],
  );

  const handleStatusChange = (novoStatus: string) => {
    setStatus(novoStatus);
    atualizarUrl({ status: novoStatus });
  };

  const handleEtapaChange = (novaEtapa: string) => {
    setEtapa(novaEtapa);
    atualizarUrl({ etapa: novaEtapa });
  };

  const handleLimparFiltros = () => {
    setStatus("todos");
    setEtapa("todos");
    router.push("/relatorios/gestao/relatorios");
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-4">
          <Link href="/relatorios/gestao">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Relatórios da Gestão
            </h1>
            <p className="text-muted-foreground">
              Listagem gerencial de relatórios semestrais
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-56">
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="mb-1 block text-sm font-medium">Etapa</label>
              <Select value={etapa} onValueChange={handleEtapaChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ETAPA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={buscarRelatorios}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            {(status !== "todos" || etapa !== "todos") && (
              <Button variant="ghost" onClick={handleLimparFiltros}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <TableSkeleton />
          ) : relatorios.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
              <h2 className="mb-2 text-lg font-semibold">
                Nenhum relatório encontrado
              </h2>
              <p className="text-muted-foreground">
                Ajuste os filtros ou aguarde novos envios.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professora</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorios.map((relatorio) => (
                  <TableRow key={relatorio.id}>
                    <TableCell className="font-medium">
                      {relatorio.professorName}
                    </TableCell>
                    <TableCell>
                      {relatorio.turmaName}
                      {relatorio.turmaCode && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({relatorio.turmaCode})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{relatorio.etapaName || relatorio.etapaCode}</TableCell>
                    <TableCell>
                      <StatusBadge status={relatorio.status} />
                    </TableCell>
                    <TableCell>
                      {relatorio.submittedAt
                        ? formatarData(relatorio.submittedAt)
                        : "-"}
                    </TableCell>
                    <TableCell>{relatorio.documentosCount}</TableCell>
                    <TableCell className="text-right">
                      <Link href={getVerUrl(relatorio)}>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
