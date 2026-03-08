"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import type {
  OrdemServicoCategoria,
  OrdemServicoStatus,
} from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import { Card, CardContent, CardHeader } from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Headset,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useState } from "react";

import { NovaOsDialog } from "@/features/suporte-list/components/nova-os-dialog";
import { OsCard } from "@/features/suporte-list/components/os-card";
import { OsFiltros } from "@/features/suporte-list/components/os-filtros";
import { useOrdensServico } from "@/hooks/use-ordens-servico";

// ============================================
// Roles administrativas que veem o nome do criador
// ============================================
const ADMIN_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
];

// ============================================
// Componente de Skeleton para carregamento
// ============================================
function OsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-5 w-28 rounded-full" />
        <div className="flex items-center justify-between border-t pt-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Pagina principal
// ============================================
export default function SuportePage() {
  const { role } = useTenant();
  const isAdmin = ADMIN_ROLES.includes(role);

  // Estado dos filtros
  const [statusFiltro, setStatusFiltro] = useState<
    OrdemServicoStatus | undefined
  >(undefined);
  const [categoriaFiltro, setCategoriaFiltro] = useState<
    OrdemServicoCategoria | undefined
  >(undefined);
  const [pagina, setPagina] = useState(1);

  // Estado do dialog
  const [dialogOpen, setDialogOpen] = useState(false);

  // Buscar ordens de servico
  const { ordens, pagination, contagem, isLoading, error, refetch } =
    useOrdensServico({
      status: statusFiltro,
      categoria: categoriaFiltro,
      page: pagina,
    });

  // Callbacks de filtro (resetam a pagina ao filtrar)
  const handleStatusChange = useCallback(
    (novoStatus: OrdemServicoStatus | undefined) => {
      setStatusFiltro(novoStatus);
      setPagina(1);
    },
    [],
  );

  const handleCategoriaChange = useCallback(
    (novaCategoria: OrdemServicoCategoria | undefined) => {
      setCategoriaFiltro(novaCategoria);
      setPagina(1);
    },
    [],
  );

  // Callback de sucesso ao criar nova OS
  const handleNovaOsSucesso = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <>
      <div className="container mx-auto py-8 space-y-6">
        {/* ============================================ */}
        {/* Header */}
        {/* ============================================ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Suporte</h1>
            <p className="text-sm text-muted-foreground">
              {contagem.abertas} abertas &middot; {contagem.emAndamento} em
              andamento &middot; {contagem.resolvidas} resolvidas
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold rounded-xl shadow-lg shadow-[#A3D154]/20 gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nova OS
          </Button>
        </div>

        {/* ============================================ */}
        {/* Filtros */}
        {/* ============================================ */}
        <OsFiltros
          status={statusFiltro}
          categoria={categoriaFiltro}
          onStatusChange={handleStatusChange}
          onCategoriaChange={handleCategoriaChange}
        />

        {/* ============================================ */}
        {/* Conteudo */}
        {/* ============================================ */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <OsCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">Erro ao carregar</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : ordens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Headset className="h-16 w-16 text-muted-foreground/40" />
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">
                Nenhuma ordem de servico encontrada
              </p>
              <p className="text-sm text-muted-foreground">
                {statusFiltro || categoriaFiltro
                  ? "Tente ajustar os filtros para ver mais resultados."
                  : "Clique em \"Nova OS\" para abrir uma solicitacao."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ordens.map((ordem) => (
              <OsCard key={ordem.id} ordem={ordem} isAdmin={isAdmin} />
            ))}
          </div>
        )}

        {/* ============================================ */}
        {/* Paginacao */}
        {/* ============================================ */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Pagina {pagina} de {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= pagination.totalPages}
              onClick={() => setPagina((p) => p + 1)}
              className="gap-1"
            >
              Proxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* Dialog Nova OS */}
      {/* ============================================ */}
      <NovaOsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleNovaOsSucesso}
      />
    </>
  );
}
