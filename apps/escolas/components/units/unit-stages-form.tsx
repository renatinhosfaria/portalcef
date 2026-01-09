"use client";

import { api } from "@essencia/shared/fetchers/client";
import { Button } from "@essencia/ui/components/button";
import { Checkbox } from "@essencia/ui/components/checkbox";
import { Label } from "@essencia/ui/components/label";
import { AlertCircle, BookOpen, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet } from "../ui/sheet";

import type { UnitListItem } from "./unit-list";

interface EducationStage {
  id: string;
  name: string;
  code: string;
}

interface UnitStagesFormProps {
  isOpen: boolean;
  onClose: () => void;
  unit: UnitListItem | null;
  onSaved?: () => void | Promise<void>;
}

export function UnitStagesForm({
  isOpen,
  onClose,
  unit,
  onSaved,
}: UnitStagesFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [availableStages, setAvailableStages] = useState<EducationStage[]>([]);
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);

  useEffect(() => {
    async function loadStages() {
      if (!isOpen || !unit) return;

      setStagesLoading(true);
      setError(null);
      try {
        const [allStages, unitStages] = await Promise.all([
          api.get<EducationStage[]>("/stages"),
          api.get<EducationStage[]>(`/units/${unit.id}/stages`),
        ]);

        setAvailableStages(allStages);
        setSelectedStageIds(unitStages.map((s) => s.id));
      } catch (err) {
        console.error("Erro ao carregar etapas:", err);
        setError("Erro ao carregar etapas");
      } finally {
        setStagesLoading(false);
      }
    }

    loadStages();
  }, [isOpen, unit]);

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    setSelectedStageIds([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) return;

    setIsLoading(true);
    setError(null);

    try {
      await api.put(`/units/${unit.id}/stages`, {
        stageIds: selectedStageIds,
      });

      await onSaved?.();

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        handleClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar etapas");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleClose}
      title={unit ? `Gerenciar Etapas - ${unit.name}` : "Gerenciar Etapas"}
    >
      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            Etapas salvas com sucesso!
          </div>
        )}

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            Etapas de Ensino
          </Label>
          <p className="text-xs text-slate-500">
            Selecione quais etapas de ensino esta unidade oferecerá.
          </p>

          {stagesLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando etapas...
            </div>
          ) : availableStages.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Nenhuma etapa disponível.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {availableStages.map((stage) => (
                <label
                  key={stage.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedStageIds.includes(stage.id)}
                    onCheckedChange={(checked) => {
                      setSelectedStageIds((current) =>
                        checked
                          ? [...current, stage.id]
                          : current.filter((id) => id !== stage.id),
                      );
                    }}
                  />
                  <span className="text-sm text-slate-700">{stage.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold min-w-[140px]"
            disabled={isLoading || success || stagesLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : success ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Salvo!
              </>
            ) : (
              "Salvar Etapas"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
