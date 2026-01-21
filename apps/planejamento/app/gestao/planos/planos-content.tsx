"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Input } from "@essencia/ui/components/input";
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
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  useGestaoPlanos,
  STATUS_FILTER_OPTIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  type PlanoAulaStatus,
  type PlanoAulaListItem,
} from "../../../features/plano-aula";

/**
 * Segmentos disponiveis para filtro
 */
const SEGMENTOS_OPTIONS = [
  { value: "todos", label: "Todos os Segmentos" },
  { value: "BERCARIO", label: "Bercario" },
  { value: "INFANTIL", label: "Infantil" },
  { value: "FUNDAMENTAL_I", label: "Fundamental I" },
  { value: "FUNDAMENTAL_II", label: "Fundamental II" },
];

interface PlanosContentProps {
  initialStatus: string;
  initialQuinzena?: string;
  initialSegmento?: string;
  initialProfessora?: string;
  initialPage: number;
}

/**
 * Retorna URL para visualizar o plano baseado no status
 */
function getVerUrl(plano: PlanoAulaListItem): string {
  switch (plano.status) {
    case "RASCUNHO":
      return `/plano-aula/${plano.quinzenaId}?planoId=${plano.id}`;
    case "AGUARDANDO_ANALISTA":
    case "DEVOLVIDO_ANALISTA":
    case "REVISAO_ANALISTA":
      return `/analise/${plano.id}`;
    default:
      return `/coordenacao/${plano.id}`;
  }
}

/**
 * Badge de status do plano
 */
function StatusBadge({ status }: { status: PlanoAulaStatus }) {
  const colors = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border",
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {label}
    </span>
  );
}

/**
 * Skeleton para loading da tabela
 */
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function PlanosContent({
  initialStatus,
  initialQuinzena,
  initialSegmento,
  initialProfessora,
  initialPage,
}: PlanosContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estados de filtros
  const [status, setStatus] = useState(initialStatus);
  const [segmento, setSegmento] = useState(initialSegmento || "todos");
  const [professora, setProfessora] = useState(initialProfessora || "");
  const [professoraInput, setProfessoraInput] = useState(initialProfessora || "");
  const [page, setPage] = useState(initialPage);

  // Hook de listagem
  const { planos = [], pagination, isLoading, error, fetchPlanos } = useGestaoPlanos();

  /**
   * Busca planos com os filtros atuais
   */
  const buscarPlanos = useCallback(() => {
    fetchPlanos({
      status,
      quinzenaId: initialQuinzena,
      segmentoId: segmento === "todos" ? undefined : segmento,
      professora: professora || undefined,
      page,
      limit: 20,
    });
  }, [fetchPlanos, status, initialQuinzena, segmento, professora, page]);

  // Busca inicial e quando filtros mudam
  useEffect(() => {
    buscarPlanos();
  }, [buscarPlanos]);

  /**
   * Atualiza URL com os filtros
   */
  const atualizarUrl = useCallback(
    (novosFiltros: {
      status?: string;
      segmento?: string;
      professora?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (novosFiltros.status !== undefined) {
        if (novosFiltros.status === "todos") {
          params.delete("status");
        } else {
          params.set("status", novosFiltros.status);
        }
      }

      if (novosFiltros.segmento !== undefined) {
        if (novosFiltros.segmento === "todos" || novosFiltros.segmento === "") {
          params.delete("segmento");
        } else {
          params.set("segmento", novosFiltros.segmento);
        }
      }

      if (novosFiltros.professora !== undefined) {
        if (novosFiltros.professora === "") {
          params.delete("professora");
        } else {
          params.set("professora", novosFiltros.professora);
        }
      }

      if (novosFiltros.page !== undefined) {
        if (novosFiltros.page === 1) {
          params.delete("page");
        } else {
          params.set("page", String(novosFiltros.page));
        }
      }

      const queryString = params.toString();
      router.push(`/gestao/planos${queryString ? `?${queryString}` : ""}`);
    },
    [router, searchParams]
  );

  /**
   * Handlers de filtros
   */
  const handleStatusChange = (novoStatus: string) => {
    setStatus(novoStatus);
    setPage(1);
    atualizarUrl({ status: novoStatus, page: 1 });
  };

  const handleSegmentoChange = (novoSegmento: string) => {
    setSegmento(novoSegmento);
    setPage(1);
    atualizarUrl({ segmento: novoSegmento, page: 1 });
  };

  const handleProfessoraSearch = () => {
    setProfessora(professoraInput);
    setPage(1);
    atualizarUrl({ professora: professoraInput, page: 1 });
  };

  const handleLimparFiltros = () => {
    setStatus("todos");
    setSegmento("todos");
    setProfessora("");
    setProfessoraInput("");
    setPage(1);
    router.push("/gestao/planos");
  };

  const handlePageChange = (novaPagina: number) => {
    setPage(novaPagina);
    atualizarUrl({ page: novaPagina });
  };

  // Titulo dinamico baseado no filtro de status
  const statusLabel =
    STATUS_FILTER_OPTIONS.find((opt) => opt.value === status)?.label ||
    "Planos de Aula";

  const temFiltrosAtivos = status !== "todos" || segmento !== "" || professora !== "";

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/gestao">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{statusLabel}</h1>
            <p className="text-muted-foreground">
              Listagem de planos de aula com filtros
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Status */}
            <div className="w-48">
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Segmento */}
            <div className="w-48">
              <label className="text-sm font-medium mb-1 block">Segmento</label>
              <Select value={segmento} onValueChange={handleSegmentoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os Segmentos" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Professora */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Professora</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por nome..."
                  value={professoraInput}
                  onChange={(e) => setProfessoraInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleProfessoraSearch()}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleProfessoraSearch}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Limpar Filtros */}
            {temFiltrosAtivos && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLimparFiltros}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contagem e Atualizar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-32 inline-block" />
          ) : (
            <>
              Mostrando{" "}
              <span className="font-medium">
                {planos.length > 0
                  ? `${(page - 1) * 20 + 1}-${Math.min(page * 20, pagination.total)}`
                  : "0"}
              </span>{" "}
              de <span className="font-medium">{pagination.total}</span> planos
            </>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={buscarPlanos}
          disabled={isLoading}
        >
          <RefreshCcw
            className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
          />
          Atualizar
        </Button>
      </div>

      {/* Erro */}
      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton />
            </div>
          ) : planos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum plano encontrado
              </h3>
              <p className="text-muted-foreground max-w-md">
                Nao foram encontrados planos com os filtros selecionados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professora</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Quinzena</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead className="text-center">Docs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.map((plano) => (
                  <TableRow key={plano.id}>
                    <TableCell className="font-medium">
                      {plano.professorName}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{plano.turmaCode}</span>
                        <span className="text-muted-foreground text-xs block">
                          {plano.turmaName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{plano.segmento || "-"}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{plano.quinzenaId}</span>
                        <span className="text-muted-foreground text-xs block">
                          {plano.quinzenaPeriodo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {plano.submittedAt
                        ? new Date(plano.submittedAt).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {plano.documentosCount}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={plano.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={getVerUrl(plano)}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
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

      {/* Paginacao */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= pagination.totalPages || isLoading}
          >
            Proxima
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
