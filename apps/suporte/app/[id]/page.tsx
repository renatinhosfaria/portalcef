"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import type { OrdemServicoStatus } from "@essencia/shared/types";
import { STATUS_LABELS } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@essencia/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@essencia/ui/components/dropdown-menu";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { toast } from "@essencia/ui/toaster";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useCallback } from "react";

import { OsResponder } from "@/features/suporte-detalhe/components/os-responder";
import { OsTimeline } from "@/features/suporte-detalhe/components/os-timeline";
import {
  OsCategoriaBadge,
  OsStatusBadge,
} from "@/features/suporte-list/components/os-status-badge";
import { useOrdemServico } from "@/hooks/use-ordem-servico";
import { apiPatch } from "@/lib/api";

// ============================================
// Roles administrativas
// ============================================
const ADMIN_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
];

// ============================================
// Transicoes de status disponiveis para admin
// ============================================
const STATUS_TRANSITIONS: Record<OrdemServicoStatus, OrdemServicoStatus[]> = {
  ABERTA: ["EM_ANDAMENTO", "RESOLVIDA", "FECHADA"],
  EM_ANDAMENTO: ["RESOLVIDA", "FECHADA"],
  RESOLVIDA: ["EM_ANDAMENTO", "FECHADA"],
  FECHADA: [],
};

// ============================================
// Componente de Loading
// ============================================
function DetalheLoading() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <Skeleton className="h-5 w-24" />
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-8 w-2/3" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="py-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-start">
              <Skeleton className="h-20 w-3/4 rounded-2xl" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Pagina de Detalhe
// ============================================
export default function SuporteDetalhePage() {
  const params = useParams();
  const id = params.id as string;
  const { role, userId } = useTenant();
  const isAdmin = ADMIN_ROLES.includes(role);

  const { ordem, isLoading, error, refetch } = useOrdemServico(id);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // ============================================
  // Alterar Status
  // ============================================
  const handleChangeStatus = useCallback(
    async (novoStatus: OrdemServicoStatus) => {
      if (!ordem) return;
      setIsChangingStatus(true);

      try {
        await apiPatch(`suporte/${ordem.id}/status`, { status: novoStatus });
        toast.success(`Status alterado para "${STATUS_LABELS[novoStatus]}".`);
        void refetch();
      } catch {
        toast.error("Erro ao alterar o status. Tente novamente.");
      } finally {
        setIsChangingStatus(false);
      }
    },
    [ordem, refetch],
  );

  // ============================================
  // Callback apos enviar mensagem
  // ============================================
  const handleMessageSent = useCallback(() => {
    void refetch();
  }, [refetch]);

  // ============================================
  // Estado de carregamento
  // ============================================
  if (isLoading) {
    return <DetalheLoading />;
  }

  // ============================================
  // Estado de erro
  // ============================================
  if (error) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

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
      </div>
    );
  }

  // ============================================
  // Sem dados
  // ============================================
  if (!ordem) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-semibold">
            Ordem de servico nao encontrada
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // Dados carregados
  // ============================================
  const statusTransitions = STATUS_TRANSITIONS[ordem.status];
  const isFechada = ordem.status === "FECHADA";
  const dataAbertura = format(
    new Date(ordem.createdAt),
    "dd/MM/yyyy 'as' HH:mm",
    { locale: ptBR },
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* ============================================ */}
      {/* Botao Voltar */}
      {/* ============================================ */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      {/* ============================================ */}
      {/* Card do Cabecalho */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="space-y-4">
          {/* Linha 1: Numero + Status Badge + (admin: dropdown de status) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold font-mono text-muted-foreground">
                OS-{ordem.numero}
              </span>
              <OsStatusBadge status={ordem.status} />
            </div>

            {/* Dropdown de mudanca de status (somente admin) */}
            {isAdmin && statusTransitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={isChangingStatus}
                  >
                    {isChangingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Alterar Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {statusTransitions.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => void handleChangeStatus(status)}
                    >
                      {STATUS_LABELS[status]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Linha 2: Titulo */}
          <h1 className="text-xl font-bold text-foreground">{ordem.titulo}</h1>

          {/* Linha 3: Categoria + Data + Criador */}
          <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
            <OsCategoriaBadge categoria={ordem.categoria} />
            <span>Aberta em {dataAbertura}</span>
            <span>&middot;</span>
            <span>
              por{" "}
              <span className="font-medium text-foreground">
                {ordem.criadoPorNome}
              </span>
            </span>
          </div>

          {/* Descricao original (primeira mensagem / descricao da OS) */}
          {ordem.descricao && (
            <div className="pt-2 border-t">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {ordem.descricao}
              </p>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* ============================================ */}
      {/* Timeline de Mensagens */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-0">
          <h2 className="text-lg font-semibold">Mensagens</h2>
        </CardHeader>
        <CardContent>
          <OsTimeline
            mensagens={ordem.mensagens}
            currentUserId={userId}
          />
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* Formulario de Resposta (oculto se fechada) */}
      {/* ============================================ */}
      {!isFechada && (
        <OsResponder
          ordemServicoId={ordem.id}
          onMessageSent={handleMessageSent}
        />
      )}

      {/* Mensagem quando OS esta fechada */}
      {isFechada && (
        <div className="rounded-xl border bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
          Esta ordem de servico foi fechada e nao aceita novas mensagens.
        </div>
      )}
    </div>
  );
}
