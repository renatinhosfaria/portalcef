"use client";

import { toast } from "@essencia/ui/components/toaster";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { saveDraft } from "../actions";
import type { PlanningFormData } from "../schemas";

const SERVER_SAVE_DELAY = 30000; // 30s após última mudança

/**
 * Hook para salvar rascunho no servidor automaticamente com debounce.
 * @param formData Dados atuais do formulário
 */
export function useServerAutoSave(formData: Partial<PlanningFormData>) {
  const [isPending, startTransition] = useTransition();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Função core de salvamento usando Server Action
  const saveToServer = useCallback(async () => {
    // Validação mínima antes de tentar salvar
    const turma = formData.turma;
    const quinzena = formData.quinzena;
    if (!turma || !quinzena) return;

    startTransition(async () => {
      try {
        const result = await saveDraft({
          turma,
          quinzena,
          objetivos: formData.objetivos,
          metodologia: formData.metodologia,
          recursos: formData.recursos,
        });

        if (result.success) {
          setLastSavedAt(new Date());
          toast.success("Rascunho salvo no servidor");
        } else {
          toast.error(result.error || "Erro ao salvar rascunho no servidor");
        }
      } catch (error) {
        console.error("saveToServer error:", error);
        toast.error("Erro de conexão ao salvar rascunho");
      }
    });
  }, [formData]);

  // Debounce automático
  useEffect(() => {
    // Ignorar primeira renderização para não salvar dados vazios/iniciais imediatamente
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Só agendar se tiver dados mínimos
    if (formData.turma && formData.quinzena) {
      timeoutRef.current = setTimeout(() => {
        saveToServer();
      }, SERVER_SAVE_DELAY);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [formData, saveToServer]);

  return {
    saveToServer,
    isSaving: isPending,
    lastSavedAt,
  };
}
