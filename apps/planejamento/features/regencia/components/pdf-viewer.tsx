/**
 * PdfViewer Component
 * Visualizador de PDF integrado usando iframe nativo
 * Epic 4 - Story 4.2: Visualizador de PDF Integrado
 */

"use client";

import { Card, CardContent } from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { AlertCircle, FileText } from "lucide-react";
import { useState } from "react";

interface PdfViewerProps {
  planningId: string;
  turma?: string;
  quinzena?: string;
}

export function PdfViewer({ planningId, turma, quinzena }: PdfViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Construir URL do PDF com parâmetros de fallback
  const pdfUrl = `/api/pdf/${planningId}${turma ? `?turma=${encodeURIComponent(turma)}` : ""}${quinzena ? `&quinzena=${encodeURIComponent(quinzena)}` : ""}`;

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-12 text-center">
          <div className="mx-auto w-fit p-4 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            Erro ao carregar o documento
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Não foi possível carregar o PDF. Tente recarregar a página ou entre
            em contato com o suporte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 z-10">
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 bg-muted rounded-full mb-4 animate-pulse">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PDF iframe */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <iframe
          src={pdfUrl}
          title="Visualização do Planejamento"
          className="w-full border-0"
          style={{
            height: "calc(100vh - 280px)",
            minHeight: "500px",
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
}
