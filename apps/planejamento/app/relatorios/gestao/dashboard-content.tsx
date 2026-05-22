"use client";

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

import { useGestaoRelatorio } from "../../../features/relatorio";

const SEGMENTOS = [
  { code: "BERCARIO", label: "Berçário", color: "bg-pink-500" },
  { code: "INFANTIL", label: "Infantil", color: "bg-blue-500" },
] as const;

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "purple";
  description?: string;
  href?: string;
}

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
      card: "border-green-500/50 bg-green-50/50",
      icon: "bg-green-100 text-green-600",
      value: "text-green-600",
    },
    warning: {
      card: "border-yellow-500/50 bg-yellow-50/50",
      icon: "bg-yellow-100 text-yellow-600",
      value: "text-yellow-600",
    },
    info: {
      card: "border-blue-500/50 bg-blue-50/50",
      icon: "bg-blue-100 text-blue-600",
      value: "text-blue-600",
    },
    purple: {
      card: "border-purple-500/50 bg-purple-50/50",
      icon: "bg-purple-100 text-purple-600",
      value: "text-purple-600",
    },
  };
  const styles = variantStyles[variant];
  const content = (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        styles.card,
        href && "cursor-pointer hover:scale-[1.02]",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <p className={cn("text-2xl font-bold", styles.value)}>{value}</p>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className={cn("rounded-lg p-2", styles.icon)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function SegmentProgressCard({
  segmento,
  data,
}: {
  segmento: (typeof SEGMENTOS)[number];
  data: { total: number; aprovados: number };
}) {
  const percentage =
    data.total > 0 ? Math.round((data.aprovados / data.total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded-full", segmento.color)} />
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

function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    </div>
  );
}

export function GestaoRelatorioContent() {
  const { fetchDashboard, dashboardData, loading } = useGestaoRelatorio();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setError(null);
      await fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    }
  }, [fetchDashboard]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const estatisticas = useMemo(() => {
    if (!dashboardData) return null;
    const stats = dashboardData.stats;
    const totalPendentes =
      stats.aguardandoAnalista + stats.aguardandoCoordenadora;
    const taxaAprovacao =
      stats.total > 0 ? Math.round((stats.aprovados / stats.total) * 100) : 0;
    return { ...stats, totalPendentes, taxaAprovacao };
  }, [dashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await carregarDados();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading && !dashboardData) return <DashboardSkeleton />;

  if (error && !dashboardData) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center text-destructive">
            <AlertCircle className="mx-auto mb-4 h-12 w-12" />
            <p className="font-medium">Erro ao carregar dashboard</p>
            <p className="mt-1 text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!estatisticas || !dashboardData) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileSearch className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-semibold">
              Nenhum dado disponível
            </h2>
            <p className="text-muted-foreground">
              Não foram encontrados relatórios para exibir no dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Dashboard de Relatórios
              </h1>
              <p className="text-muted-foreground">
                Acompanhamento dos relatórios semanais da educação infantil
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/relatorios/gestao/semanas">
            <Button variant="outline" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              Configurar Semanas
            </Button>
          </Link>
          <Link href="/relatorios/gestao/relatorios">
            <Button variant="outline" className="gap-2">
              <FileSearch className="h-4 w-4" />
              Listar Relatórios
            </Button>
          </Link>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCcw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total"
          value={estatisticas.total}
          icon={<Users className="h-5 w-5" />}
          description="relatórios criados"
          href="/relatorios/gestao/relatorios?status=todos"
        />
        <StatCard
          title="Rascunhos"
          value={estatisticas.rascunho}
          icon={<FileEdit className="h-5 w-5" />}
          href="/relatorios/gestao/relatorios?status=RASCUNHO"
        />
        <StatCard
          title="Aguardando Analista"
          value={estatisticas.aguardandoAnalista}
          icon={<Clock className="h-5 w-5" />}
          variant="info"
          href="/relatorios/gestao/relatorios?status=AGUARDANDO_ANALISTA"
        />
        <StatCard
          title="Aguardando Coordenação"
          value={estatisticas.aguardandoCoordenadora}
          icon={<Send className="h-5 w-5" />}
          variant="purple"
          href="/relatorios/gestao/relatorios?status=AGUARDANDO_COORDENADORA"
        />
        <StatCard
          title="Devolvidos"
          value={estatisticas.devolvidos}
          icon={<AlertCircle className="h-5 w-5" />}
          variant={estatisticas.devolvidos > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Aprovados"
          value={estatisticas.aprovados}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="success"
          description={`${estatisticas.taxaAprovacao}% do total`}
          href="/relatorios/gestao/relatorios?status=APROVADO"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progresso por Etapa</CardTitle>
          <CardDescription>
            Percentual de relatórios aprovados em Berçário e Infantil
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SEGMENTOS.map((segmento) => (
            <SegmentProgressCard
              key={segmento.code}
              segmento={segmento}
              data={
                dashboardData.porSegmento[segmento.code] || {
                  total: 0,
                  aprovados: 0,
                }
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
