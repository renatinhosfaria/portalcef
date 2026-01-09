"use client";

import { api } from "@essencia/shared/fetchers/client";
import { createUnitSchema, updateUnitSchema } from "@essencia/shared/schemas";
import { Button } from "@essencia/ui/components/button";
import { Checkbox } from "@essencia/ui/components/checkbox";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Check,
  Hash,
  Loader2,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet } from "../ui/sheet";

import type { UnitListItem } from "./unit-list";

interface EducationStage {
  id: string;
  name: string;
  code: string;
}

interface UnitFormProps {
  isOpen: boolean;
  onClose: () => void;
  unitToEdit?: UnitListItem | null;
  schoolId: string;
  onSaved?: () => void | Promise<void>;
}

export function UnitForm({
  isOpen,
  onClose,
  unitToEdit,
  schoolId,
  onSaved,
}: UnitFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [availableStages, setAvailableStages] = useState<EducationStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    stageIds: [] as string[],
  });

  const isEditing = !!unitToEdit;

  useEffect(() => {
    async function loadData() {
      if (!isOpen) return;

      // Carregar etapas disponíveis
      setStagesLoading(true);
      try {
        const stages = await api.get<EducationStage[]>("/stages");
        setAvailableStages(stages);

        // Se estiver editando, carregar etapas da unidade
        if (unitToEdit) {
          const unitStages = await api.get<EducationStage[]>(
            `/units/${unitToEdit.id}/stages`,
          );
          setFormData({
            name: unitToEdit.name,
            code: unitToEdit.code,
            address: unitToEdit.address ?? "",
            stageIds: unitStages.map((s) => s.id),
          });
        } else {
          setFormData({ name: "", code: "", address: "", stageIds: [] });
        }
      } catch (err) {
        console.error("Erro ao carregar etapas:", err);
      } finally {
        setStagesLoading(false);
      }
    }

    loadData();
  }, [isOpen, unitToEdit]);

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    setFormData({ name: "", code: "", address: "", stageIds: [] });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        address: formData.address.trim() || undefined,
      };
      const result = isEditing
        ? updateUnitSchema.safeParse(payload)
        : createUnitSchema.safeParse({ ...payload, schoolId });

      if (!result.success) {
        const issue = result.error.issues[0];
        setError(issue?.message ?? "Dados invalidos.");
        setIsLoading(false);
        return;
      }

      let unitId: string;

      if (isEditing && unitToEdit) {
        await api.put(
          `/schools/${schoolId}/units/${unitToEdit.id}`,
          result.data,
        );
        unitId = unitToEdit.id;
      } else {
        const created = await api.post<{ id: string }>(
          `/schools/${schoolId}/units`,
          result.data,
        );
        unitId = created.id;
      }

      // Atualizar etapas da unidade (substituir todas)
      await api.put(`/units/${unitId}/stages`, {
        stageIds: formData.stageIds,
      });

      await onSaved?.();

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        handleClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar unidade.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Editar Unidade" : "Nova Unidade"}
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
            Salvo com sucesso!
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="unit-name">Nome da Unidade</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="unit-name"
              placeholder="Ex: Unidade Vila Madalena"
              required
              className="pl-10"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit-code">Código da Unidade</Label>
          <div className="relative">
            <Hash className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="unit-code"
              placeholder="ex: vila-madalena"
              required
              className="pl-10"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit-address">Endereço Completo</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="unit-address"
              placeholder="Rua, Número, Bairro - Cidade/UF"
              className="pl-10"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            Etapas de Ensino
          </Label>
          <p className="text-xs text-slate-500">
            Selecione quais etapas de ensino esta unidade oferecerá.
          </p>
          {stagesLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando etapas...
            </div>
          ) : availableStages.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma etapa disponível.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {availableStages.map((stage) => (
                <label
                  key={stage.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={formData.stageIds.includes(stage.id)}
                    onCheckedChange={(checked) => {
                      setFormData((current) => ({
                        ...current,
                        stageIds: checked
                          ? [...current.stageIds, stage.id]
                          : current.stageIds.filter((id) => id !== stage.id),
                      }));
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
            disabled={isLoading || success}
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
              "Salvar Unidade"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
