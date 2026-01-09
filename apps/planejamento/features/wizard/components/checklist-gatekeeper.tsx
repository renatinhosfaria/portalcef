/**
 * ChecklistGatekeeper Component
 * Checklist de autoavaliação obrigatória
 * Epic 3 - Story 3.2: Checklist de Autoavaliação Obrigatória
 */

"use client";

import { Checkbox } from "@essencia/ui/components/checkbox";
import { Label } from "@essencia/ui/components/label";
import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface ChecklistState {
  ortografia: boolean;
  margens: boolean;
  cabecalho: boolean;
  fonte: boolean;
  imagens: boolean;
  linguagem: boolean;
}

const CHECKLIST_ITEMS = [
  {
    id: "ortografia",
    label: "Ortografia verificada",
    description: "Revisei a ortografia e gramática do documento",
  },
  {
    id: "margens",
    label: "Margens corretas",
    description: "As margens e espaçamentos estão adequados",
  },
  {
    id: "cabecalho",
    label: "Cabeçalho completo",
    description: "Todas as informações do cabeçalho estão preenchidas",
  },
  {
    id: "fonte",
    label: "Fonte e formatação adequadas",
    description: "A fonte e formatação estão consistentes",
  },
  {
    id: "imagens",
    label: "Imagens com boa qualidade",
    description: "Se houver imagens, estão nítidas e bem posicionadas",
  },
  {
    id: "linguagem",
    label: "Linguagem formal e clara",
    description: "O texto utiliza linguagem apropriada e clara",
  },
] as const;

interface ChecklistGatekeeperProps {
  onChange?: (isComplete: boolean, state: ChecklistState) => void;
  initialState?: Partial<ChecklistState>;
}

export function ChecklistGatekeeper({
  onChange,
  initialState,
}: ChecklistGatekeeperProps) {
  const [checklist, setChecklist] = useState<ChecklistState>({
    ortografia: initialState?.ortografia ?? false,
    margens: initialState?.margens ?? false,
    cabecalho: initialState?.cabecalho ?? false,
    fonte: initialState?.fonte ?? false,
    imagens: initialState?.imagens ?? false,
    linguagem: initialState?.linguagem ?? false,
  });

  const isComplete = Object.values(checklist).every(Boolean);
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = CHECKLIST_ITEMS.length;

  const handleCheck = useCallback(
    (id: keyof ChecklistState, checked: boolean) => {
      setChecklist((prev) => ({
        ...prev,
        [id]: checked,
      }));
    },
    [],
  );

  useEffect(() => {
    onChange?.(isComplete, checklist);
  }, [isComplete, checklist, onChange]);

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Checklist de Autoavaliação
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isComplete
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          }`}
        >
          {completedCount}/{totalCount} itens
        </span>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Marque todos os itens abaixo antes de enviar seu planejamento para
        revisão.
      </p>

      <div className="space-y-3">
        {CHECKLIST_ITEMS.map((item) => {
          const isChecked = checklist[item.id as keyof ChecklistState];
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                isChecked
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <Checkbox
                id={`checklist-${item.id}`}
                checked={isChecked}
                onCheckedChange={(checked) =>
                  handleCheck(item.id as keyof ChecklistState, checked === true)
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor={`checklist-${item.id}`}
                  className={`cursor-pointer text-sm font-medium ${
                    isChecked
                      ? "text-green-700 dark:text-green-400"
                      : "text-foreground"
                  }`}
                >
                  {item.label}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {isComplete && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-100 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            Ótimo! Todos os itens foram verificados. Você pode enviar seu
            planejamento.
          </span>
        </div>
      )}
    </div>
  );
}
