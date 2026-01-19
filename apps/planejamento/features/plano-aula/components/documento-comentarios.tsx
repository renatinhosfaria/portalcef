"use client";

/**
 * DocumentoComentarios Component
 * Lista de comentarios em um documento (feedback da analista/coordenadora)
 * Task 3.2: Criar componentes de upload e lista de documentos
 */

import { cn } from "@essencia/ui/lib/utils";
import { CheckCircle2, Circle, MessageSquare } from "lucide-react";

import type { DocumentoComentario } from "../types";

interface DocumentoComentariosProps {
  comentarios: DocumentoComentario[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentoComentarios({
  comentarios,
}: DocumentoComentariosProps) {
  if (comentarios.length === 0) {
    return null;
  }

  const unresolvedCount = comentarios.filter((c) => !c.resolved).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          {comentarios.length} comentario{comentarios.length !== 1 && "s"}
        </span>
        {unresolvedCount > 0 && (
          <span className="text-yellow-600">
            ({unresolvedCount} pendente{unresolvedCount !== 1 && "s"})
          </span>
        )}
      </div>

      {/* Comments List */}
      <div className="space-y-2">
        {comentarios.map((comentario) => (
          <div
            key={comentario.id}
            className={cn(
              "rounded-lg border p-3 text-sm",
              comentario.resolved
                ? "border-green-200 bg-green-50/50"
                : "border-yellow-300 bg-yellow-50",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {/* Status Icon */}
                {comentario.resolved ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                )}

                {/* Author Name */}
                <span className="font-medium">{comentario.autorName}</span>
              </div>

              {/* Date */}
              <span className="text-xs text-muted-foreground">
                {formatDate(comentario.createdAt)}
              </span>
            </div>

            {/* Comment Text */}
            <p
              className={cn(
                "pl-6",
                comentario.resolved
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {comentario.comentario}
            </p>

            {/* Status Badge */}
            <div className="mt-2 pl-6">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  comentario.resolved
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700",
                )}
              >
                {comentario.resolved ? "Resolvido" : "Pendente"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
