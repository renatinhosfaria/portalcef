/**
 * PlanningViewerLayout Component
 * Layout da página de detalhes do planejamento com header e área de conteúdo
 * Epic 4 - Story 4.2: Visualizador de PDF Integrado
 */

"use client";

import { Button } from "@essencia/ui/components/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  StatusBadge,
  type PlanningStatusType,
} from "../../../components/status-badge";

interface PlanningViewerLayoutProps {
  children: ReactNode;
  professorName: string;
  turma: string;
  quinzena: string;
  status: PlanningStatusType;
}

export function PlanningViewerLayout({
  children,
  professorName,
  turma,
  quinzena,
  status,
}: PlanningViewerLayoutProps) {
  return (
    <div className="flex flex-col h-full min-h-screen bg-muted/30">
      {/* Header fixo */}
      <header className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          {/* Navegação */}
          <div className="flex items-center gap-4 mb-3">
            <Link href="/regencia">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
            </Link>
          </div>

          {/* Informações do planejamento */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                <span>{professorName}</span>
                <StatusBadge status={status} />
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {turma} • {quinzena}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Área de conteúdo (PDF + controles) */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
