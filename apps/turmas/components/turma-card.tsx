"use client";

/**
 * Turma Card Component
 * Exibe informações de uma turma em formato de card
 */

import type { Turma } from "@essencia/shared/types";
import { Edit, MoreVertical, Trash2 } from "lucide-react";

interface TurmaCardProps {
  turma: Turma;
}

export function TurmaCard({ turma }: TurmaCardProps) {
  const shifts = {
    matutino: "Matutino",
    vespertino: "Vespertino",
    integral: "Integral",
  };

  const shiftLabel =
    turma.shift && turma.shift in shifts
      ? shifts[turma.shift as keyof typeof shifts]
      : turma.shift || "-";

  return (
    <div className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground">{turma.name}</h3>
          <p className="text-sm text-muted-foreground">{turma.code}</p>
        </div>
        <button className="p-2 hover:bg-muted rounded">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Ano letivo:</span>
          <span className="font-medium">{turma.year}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Turno:</span>
          <span className="font-medium">{shiftLabel}</span>
        </div>

        {turma.capacity && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Capacidade:</span>
            <span className="font-medium">{turma.capacity} alunos</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status:</span>
          <span
            className={`inline-flex items-center gap-2 font-medium text-xs px-2 py-1 rounded ${
              turma.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            {turma.isActive ? "Ativa" : "Inativa"}
          </span>
        </div>
      </div>

      <div className="flex gap-2 border-t border-border pt-4">
        <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 transition-colors">
          <Edit className="w-4 h-4" />
          Editar
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-destructive text-destructive rounded hover:bg-destructive/5 transition-colors">
          <Trash2 className="w-4 h-4" />
          Desativar
        </button>
      </div>
    </div>
  );
}
