/**
 * Regência Page - Lista de Planejamentos
 * Epic 4 - Story 4.1: Lista de Planejamentos por Segmento
 */

import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { getPlanningsBySegment } from "../../features/regencia/actions";
import { PlanningList } from "../../features/regencia/components/planning-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Regência | Essência",
  description: "Painel de Revisão de Planejamentos",
};

export default async function RegenciaPage() {
  const result = await getPlanningsBySegment();

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Painel de Regência
          </h1>
        </div>
        <p className="text-muted-foreground">
          Revise e aprove os planejamentos das professoras do seu segmento.
        </p>
      </div>

      {/* Stats (opcional - pode ser expandido) */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          {result.data ? (
            <>
              <span className="font-semibold text-foreground">
                {result.data.length}
              </span>{" "}
              planejamento(s) pendente(s)
            </>
          ) : (
            "Carregando..."
          )}
        </p>
      </div>

      {/* Lista de Planejamentos */}
      <PlanningList plannings={result.data || []} />
    </div>
  );
}
