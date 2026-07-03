"use client";

import { formatarData } from "@essencia/shared/formatar-data";
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
  ClipboardCheck,
  Eye,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  PROVA_STATUS_COLORS,
  PROVA_STATUS_LABELS,
  type ProvaListItem,
  type ProvaStatus,
  useGestaoProvas,
} from "../../../../features/prova";

const STATUS_FILTER_OPTIONS = [
  { value: "todos", label: "Todas as Provas" },
  { value: "rascunho", label: "Em Rascunho" },
  { value: "aguardando-impressao", label: "Aguardando Impressao" },
  { value: "aguardando-analise", label: "Aguardando Analise" },
  { value: "devolvidos", label: "Devolvidas" },
  { value: "aprovados", label: "Aprovadas" },
];

const SEGMENTOS_OPTIONS = [
  { value: "todos", label: "Todos os Segmentos" },
  { value: "BERCARIO", label: "Bercario" },
  { value: "INFANTIL", label: "Infantil" },
  { value: "FUNDAMENTAL_I", label: "Fundamental I" },
  { value: "FUNDAMENTAL_II", label: "Fundamental II" },
];

interface ProvasGestaoContentProps {
  initialStatus: string;
  initialCiclo?: string;
  initialSegmento?: string;
  initialProfessora?: string;
  initialPage: number;
}

function getVerUrl(prova: ProvaListItem): string {
  return `/provas/gestao/provas/${prova.id}`;
}

function StatusBadge({ status }: { status: ProvaStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium",
        PROVA_STATUS_COLORS[status],
      )}
    >
      {PROVA_STATUS_LABELS[status]}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ProvasGestaoContent({
  initialStatus,
  initialCiclo,
  initialSegmento,
  initialProfessora,
  initialPage,
}: ProvasGestaoContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(initialStatus);
  const [segmento, setSegmento] = useState(initialSegmento || "todos");
  const [professora, setProfessora] = useState(initialProfessora || "");
  const [professoraInput, setProfessoraInput] = useState(
    initialProfessora || "",
  );
  const [page, setPage] = useState(initialPage);

  const {
    provas = [],
    pagination,
    isLoading,
    error,
    fetchProvas,
  } = useGestaoProvas();

  const buscarProvas = useCallback(() => {
    fetchProvas({
      status,
      provaCicloId: initialCiclo,
      segmentoId: segmento === "todos" ? undefined : segmento,
      professora: professora || undefined,
      page,
      limit: 20,
    });
  }, [fetchProvas, status, initialCiclo, segmento, professora, page]);

  useEffect(() => {
    buscarProvas();
  }, [buscarProvas]);

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
      router.push(
        `/provas/gestao/provas${queryString ? `?${queryString}` : ""}`,
      );
    },
    [router, searchParams],
  );

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
    router.push("/provas/gestao/provas");
  };

  const handlePageChange = (novaPagina: number) => {
    setPage(novaPagina);
    atualizarUrl({ page: novaPagina });
  };

  const statusLabel =
    STATUS_FILTER_OPTIONS.find((opt) => opt.value === status)?.label ||
    "Provas";

  const temFiltrosAtivos =
    status !== "todos" || segmento !== "todos" || professora !== "";

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-4">
          <Link href="/provas/gestao">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{statusLabel}</h1>
            <p className="text-muted-foreground">
              Listagem de provas com filtros
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
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-56">
              <label className="mb-1 block text-sm font-medium">Segmento</label>
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

            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-sm font-medium">
                Professora
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por nome..."
                  value={professoraInput}
                  onChange={(e) => setProfessoraInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleProfessoraSearch()
                  }
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

            {temFiltrosAtivos && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLimparFiltros}
                className="text-muted-foreground"
              >
                <X className="mr-1 h-4 w-4" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-32" />
          ) : (
            <>
              Mostrando{" "}
              <span className="font-medium">
                {provas.length > 0
                  ? `${(page - 1) * 20 + 1}-${Math.min(page * 20, pagination.total)}`
                  : "0"}
              </span>{" "}
              de <span className="font-medium">{pagination.total}</span> provas
            </>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={buscarProvas}
          disabled={isLoading}
        >
          <RefreshCcw
            className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
          />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton />
            </div>
          ) : provas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                Nenhuma prova encontrada
              </h3>
              <p className="max-w-md text-muted-foreground">
                Nao foram encontradas provas com os filtros selecionados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professora</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Enviada</TableHead>
                  <TableHead className="text-center">Docs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provas.map((prova) => (
                  <TableRow key={prova.id}>
                    <TableCell className="font-medium">
                      {prova.professorName}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{prova.turmaCode}</span>
                        <span className="block text-xs text-muted-foreground">
                          {prova.turmaName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{prova.segmento || "-"}</TableCell>
                    <TableCell>{prova.cicloPeriodo || "-"}</TableCell>
                    <TableCell>
                      {prova.submittedAt
                        ? formatarData(prova.submittedAt)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {prova.documentosCount}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={prova.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={getVerUrl(prova)}>
                        <Button variant="ghost" size="sm">
                          <Eye className="mr-1 h-4 w-4" />
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

      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
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
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
