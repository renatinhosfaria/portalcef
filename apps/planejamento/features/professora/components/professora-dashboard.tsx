"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { useTenant } from "@essencia/shared/providers/tenant";
import { FileText, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { FeedbackAlert } from "./feedback-alert";
import { PlanningStatusCard } from "./planning-status-card";
import {
  getMyCurrentPlanning,
  getMyPendingFeedback,
  type CurrentPlanningData,
  type FeedbackData,
} from "../server/queries";

/**
 * ProfessoraDashboard - Personal dashboard for teachers
 * Shows their current planning status and actions
 */
export function ProfessoraDashboard() {
  const { name } = useTenant();
  const [isLoading, setIsLoading] = useState(true);
  const [planningData, setPlanningData] = useState<CurrentPlanningData | null>(
    null,
  );
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [currentQuinzena, setCurrentQuinzena] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Get cookies from document for API calls
        const cookies = document.cookie;

        // Fetch planning and feedback in parallel
        const [planningResult, feedbackResult] = await Promise.all([
          getMyCurrentPlanning(cookies),
          getMyPendingFeedback(cookies),
        ]);

        if (planningResult.success) {
          setPlanningData(planningResult.data ?? null);
          if (planningResult.data?.quinzena) {
            setCurrentQuinzena(planningResult.data.quinzena);
          }
        } else {
          // Se não tem planejamento, calcular quinzena localmente
          const now = new Date();
          const year = now.getFullYear();
          const start = new Date(year, 0, 0);
          const diff = now.getTime() - start.getTime();
          const oneDay = 1000 * 60 * 60 * 24;
          const dayOfYear = Math.floor(diff / oneDay);
          const quinzenaNumber = Math.ceil(dayOfYear / 14);
          setCurrentQuinzena(
            `${year}-Q${String(quinzenaNumber).padStart(2, "0")}`,
          );
        }

        if (feedbackResult.success && feedbackResult.data) {
          setFeedbackData(feedbackResult.data);
        }
      } catch (err) {
        console.error("ProfessoraDashboard error:", err);
        setError("Erro ao carregar dados");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  if (isLoading) {
    return <ProfessoraLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Ola, {name || "Professora"}!
        </h1>
        <p className="text-muted-foreground">
          Quinzena atual: {currentQuinzena}
        </p>
      </div>

      {/* Feedback Alert (if returned for adjustments) */}
      {feedbackData && (
        <div className="mb-6">
          <FeedbackAlert
            comment={feedbackData.comment}
            reviewerName={feedbackData.reviewerName}
            reviewedAt={feedbackData.createdAt}
          />
        </div>
      )}

      {/* Planning Status Card or Empty State */}
      {planningData ? (
        <PlanningStatusCard
          status={planningData.status}
          turma={planningData.turma}
          quinzena={planningData.quinzena}
          updatedAt={planningData.updatedAt ?? new Date()}
          hasDraft={planningData.hasDraft}
        />
      ) : (
        <EmptyPlanningState quinzena={currentQuinzena} />
      )}
    </div>
  );
}

function ProfessoraLoadingSkeleton() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function EmptyPlanningState({ quinzena }: { quinzena: string }) {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Nenhum planejamento iniciado</CardTitle>
        <CardDescription>
          Voce ainda nao iniciou seu planejamento para a quinzena {quinzena}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild size="lg">
          <Link href="/planejamentos/novo">
            <PlusCircle className="h-5 w-5 mr-2" />
            Criar Novo Planejamento
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
