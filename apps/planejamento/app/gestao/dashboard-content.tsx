"use client";

/**
 * DashboardContent Component
 * Client component para o dashboard de gestao
 * Task 4.6: Exibe estatisticas gerais e por segmento dos planos de aula
 */

import { TarefasPendentesWidgetContainer } from "@essencia/components/tarefas";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Progress } from "@essencia/ui/components/progress";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { cn } from "@essencia/ui/lib/utils";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileEdit,
  FileSearch,
  LayoutDashboard,
  RefreshCcw,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDashboard } from "../../features/plano-aula";
/**
 * Segmentos disponiveis no sistema
 */
const SEGMENTOS = [
  { code: "BERCARIO", label: "Bercario", color: "bg-pink-500" },
  { code: "INFANTIL", label: "Infantil", color: "bg-blue-500" },
  { code: "FUNDAMENTAL_I", label: "Fund. I", color: "bg-green-500" },
  { code: "FUNDAMENTAL_II", label: "Fund. II", color: "bg-purple-500" },
] as const;

/**
 * Interface para os cards de estatisticas
 */
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?:
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "purple";
  description?: string;
  href?: string;
}

/**
 * Card de estatistica individual
 * Quando href esta presente, o card se torna clicavel
 */
function StatCard({
  title,
  value,
  icon,
  variant = "default",
  description,
  href,
}: StatCardProps) {
  const variantStyles = {
    default: {
      card: "border-border",
      icon: "bg-muted text-muted-foreground",
      value: "text-foreground",
    },
    success: {
      card: "border-green-500/50 bg-green-50/50 dark:bg-green-950/20",
      icon: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
      value: "text-green-600 dark:text-green-400",
    },
    warning: {
      card: "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20",
      icon: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400",
      value: "text-yellow-600 dark:text-yellow-400",
    },
    destructive: {
      card: "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
      icon: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
      value: "text-red-600 dark:text-red-400",
    },
    info: {
      card: "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20",
      icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
      value: "text-blue-600 dark:text-blue-400",
    },
    purple: {
      card: "border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/20",
      icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
      value: "text-purple-600 dark:text-purple-400",
    },
  };

  const styles = variantStyles[variant];

  const cardContent = (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        styles.card,
        href && "cursor-pointer hover:scale-[1.02]",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <p className={cn("text-2xl font-bold", styles.value)}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          <div className={cn("p-2 rounded-lg", styles.icon)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}

/**
 * Card de progresso por segmento
 */
interface SegmentProgressCardProps {
  segmento: { code: string; label: string; color: string };
  data: { total: number; aprovados: number };
}

function SegmentProgressCard({ segmento, data }: SegmentProgressCardProps) {
  const percentage =
    data.total > 0 ? Math.round((data.aprovados / data.total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", segmento.color)} />
          <span className="text-sm font-medium">{segmento.label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {data.aprovados}/{data.total} ({percentage}%)
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

/**
 * Skeleton para o dashboard durante carregamento
 */
function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      {/* Progress Section Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function DashboardContent() {
  const {
    fetchDashboard,
    data,
    loading: dashboardLoading,
    error,
  } = useDashboard();

  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Carrega os dados do dashboard
   */
  const carregarDados = useCallback(async () => {
    try {
      await fetchDashboard();
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    }
  }, [fetchDashboard]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  /**
   * Atualiza os dados do dashboard
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await carregarDados();
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Calcula estatisticas derivadas
   */
  const estatisticas = useMemo(() => {
    if (!data) return null;

    const stats = data.stats || {
      total: 0,
      rascunho: 0,
      aguardandoAnalista: 0,
      aguardandoCoordenadora: 0,
      devolvidos: 0,
      aprovados: 0,
    };
    const porSegmento = data.porSegmento || {};

    const totalDevolvidos = stats.devolvidos || 0;
    const totalPendentes =
      (stats.aguardandoAnalista || 0) + (stats.aguardandoCoordenadora || 0);
    const taxaAprovacao =
      (stats.total || 0) > 0
        ? Math.round(((stats.aprovados || 0) / stats.total) * 100)
        : 0;

    return {
      ...stats,
      totalPendentes,
      totalDevolvidos,
      taxaAprovacao,
      porSegmento,
    };
  }, [data]);

  const isLoading = dashboardLoading;

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p className="font-medium">Erro ao carregar dashboard</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={carregarDados}
                className="mt-4 text-sm underline hover:no-underline"
              >
                Tentar novamente
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!estatisticas) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileSearch className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">
                Nenhum dado disponivel
              </h2>
              <p className="text-muted-foreground max-w-md">
                Nao foram encontrados dados de planos de aula para exibir no
                dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Dashboard de Planos de Aula
              </h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/gestao/periodos">
            <Button variant="outline" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              Configurar Prazos
            </Button>
          </Link>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
              "bg-muted hover:bg-muted/80 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <RefreshCcw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <StatCard
          title="Total de Planos"
          value={estatisticas.total}
          icon={<Users className="h-5 w-5" />}
          variant="default"
          description="planos criados"
          href="/gestao/planos?status=todos"
        />
        <StatCard
          title="Em Rascunho"
          value={estatisticas.rascunho}
          icon={<FileEdit className="h-5 w-5" />}
          variant="default"
          description="ainda nao enviados"
          href="/gestao/planos?status=rascunho"
        />
        <StatCard
          title="Aguardando Analise"
          value={estatisticas.aguardandoAnalista}
          icon={<Clock className="h-5 w-5" />}
          variant="info"
          description="com a analista"
          href="/gestao/planos?status=aguardando-analise"
        />
        <StatCard
          title="Aguardando Aprovacao"
          value={estatisticas.aguardandoCoordenadora}
          icon={<Send className="h-5 w-5" />}
          variant="purple"
          description="com a coordenadora"
          href="/gestao/planos?status=aguardando-aprovacao"
        />
        <StatCard
          title="Devolvidos"
          value={estatisticas.devolvidos}
          icon={<AlertCircle className="h-5 w-5" />}
          variant={estatisticas.devolvidos > 0 ? "warning" : "default"}
          description="precisam de ajustes"
          href="/gestao/planos?status=devolvidos"
        />
        <StatCard
          title="Aprovados"
          value={estatisticas.aprovados}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="success"
          description={`${estatisticas.taxaAprovacao}% do total`}
          href="/gestao/planos?status=aprovados"
        />
      </div>

      {/* Progress por Segmento e Resumo */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Progresso por Segmento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progresso por Segmento</CardTitle>
            <CardDescription>
              Percentual de planos aprovados em cada segmento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SEGMENTOS.map((segmento) => {
              const segmentoData = estatisticas.porSegmento[segmento.code] || {
                total: 0,
                aprovados: 0,
              };
              return (
                <SegmentProgressCard
                  key={segmento.code}
                  segmento={segmento}
                  data={segmentoData}
                />
              );
            })}

            {/* Total Geral */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Total Geral</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {estatisticas.aprovados}/{estatisticas.total} (
                  {estatisticas.taxaAprovacao}%)
                </span>
              </div>
              <Progress value={estatisticas.taxaAprovacao} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Resumo do Fluxo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo do Fluxo</CardTitle>
            <CardDescription>
              Distribuicao dos planos no pipeline de aprovacao
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Grafico de barras simplificado */}
              <FlowSummaryBar
                label="Em Rascunho"
                value={estatisticas.rascunho}
                total={estatisticas.total}
                color="bg-gray-400"
              />
              <FlowSummaryBar
                label="Aguardando Analise"
                value={estatisticas.aguardandoAnalista}
                total={estatisticas.total}
                color="bg-blue-500"
              />
              <FlowSummaryBar
                label="Aguardando Aprovacao"
                value={estatisticas.aguardandoCoordenadora}
                total={estatisticas.total}
                color="bg-purple-500"
              />
              <FlowSummaryBar
                label="Devolvidos"
                value={estatisticas.devolvidos}
                total={estatisticas.total}
                color="bg-yellow-500"
              />
              <FlowSummaryBar
                label="Aprovados"
                value={estatisticas.aprovados}
                total={estatisticas.total}
                color="bg-green-500"
              />
            </div>

            {/* Metricas adicionais */}
            <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {estatisticas.taxaAprovacao}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Taxa de Aprovacao
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">
                  {estatisticas.totalPendentes}
                </p>
                <p className="text-xs text-muted-foreground">
                  Em Processamento
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Widget de Tarefas Urgentes */}
      <div className="mt-8">
        <TarefasPendentesWidgetContainer modulo="PLANEJAMENTO" />
      </div>
    </div>
  );
}

/**
 * Barra de resumo do fluxo
 */
interface FlowSummaryBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function FlowSummaryBar({ label, value, total, color }: FlowSummaryBarProps) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const barWidth = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value} <span className="text-muted-foreground">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
