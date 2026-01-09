/**
 * Planning Details Page - Visualizador e Controles
 * Epic 4 - Story 4.2: Visualizador de PDF Integrado
 * Epic 4 - Story 4.3 & 4.4: Ações de Aprovação
 */

import type { Metadata } from "next";

import { getPlanningById } from "../../../features/regencia/actions";
import { ApprovalControls } from "../../../features/regencia/components/approval-controls";
import { PdfViewer } from "../../../features/regencia/components/pdf-viewer";
import { PlanningViewerLayout } from "../../../features/regencia/components/planning-viewer-layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Revisar Planejamento | Essência",
  description: "Revisão de Planejamento Pedagógico",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanningDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getPlanningById(id);

  if (!result.success || !result.data) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Planejamento não encontrado</h1>
        <p className="text-muted-foreground">
          O planejamento solicitado não existe ou você não tem permissão para
          visualizá-lo.
        </p>
      </div>
    );
  }

  const planning = result.data;

  return (
    <PlanningViewerLayout
      professorName={planning.professorName}
      turma={planning.turma}
      quinzena={planning.quinzena}
      status={planning.status}
    >
      {/* Controles de Aprovação */}
      <ApprovalControls planningId={planning.id} status={planning.status} />

      {/* Visualizador de PDF */}
      <PdfViewer
        planningId={planning.id}
        turma={planning.turma}
        quinzena={planning.quinzena}
      />
    </PlanningViewerLayout>
  );
}
