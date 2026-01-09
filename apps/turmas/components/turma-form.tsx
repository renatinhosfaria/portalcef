"use client";

import { clientFetch } from "@essencia/shared/fetchers/client";
import { useTenant } from "@essencia/shared/providers/tenant";
import type { Turma } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import { Sheet } from "@essencia/ui/components/sheet";
import {
  AlertCircle,
  Building2,
  Check,
  GraduationCap,
  Hash,
  Loader2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface TurmaFormProps {
  isOpen: boolean;
  onClose: () => void;
  turmaToEdit?: Turma | null;
}

interface Unit {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

export function TurmaForm({ isOpen, onClose, turmaToEdit }: TurmaFormProps) {
  const router = useRouter();
  const { schoolId } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Available options
  const [units, setUnits] = useState<Unit[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    unitId: "",
    stageId: "",
    name: "",
    code: "",
    year: new Date().getFullYear(),
    shift: "matutino" as "matutino" | "vespertino" | "integral",
    capacity: 30,
  });

  const loadUnits = useCallback(async () => {
    if (!schoolId) return;

    setLoadingUnits(true);
    try {
      const data = await clientFetch<Unit[]>(`/schools/${schoolId}/units`);
      setUnits(data);
    } catch (e) {
      console.error("Error loading units:", e);
      setError("Erro ao carregar unidades");
    } finally {
      setLoadingUnits(false);
    }
  }, [schoolId]);

  const loadStages = useCallback(async (unitId: string) => {
    setLoadingStages(true);
    try {
      const data = await clientFetch<Stage[]>(`/units/${unitId}/stages`);
      setStages(data);
    } catch (e) {
      console.error("Error loading stages:", e);
      setError("Erro ao carregar etapas");
    } finally {
      setLoadingStages(false);
    }
  }, []);

  // Load units when form opens
  useEffect(() => {
    if (isOpen && schoolId) {
      loadUnits();
    }
  }, [isOpen, schoolId, loadUnits]);

  // Load stages when unitId changes
  useEffect(() => {
    if (formData.unitId) {
      loadStages(formData.unitId);
    } else {
      setStages([]);
      setFormData((prev) => ({ ...prev, stageId: "" }));
    }
  }, [formData.unitId, loadStages]);

  // Populate form when editing
  useEffect(() => {
    if (turmaToEdit) {
      setFormData({
        unitId: turmaToEdit.unitId,
        stageId: turmaToEdit.stageId,
        name: turmaToEdit.name,
        code: turmaToEdit.code,
        year: turmaToEdit.year,
        shift: (turmaToEdit.shift || "matutino") as
          | "matutino"
          | "vespertino"
          | "integral",
        capacity: turmaToEdit.capacity || 30,
      });
    } else {
      setFormData({
        unitId: "",
        stageId: "",
        name: "",
        code: "",
        year: new Date().getFullYear(),
        shift: "matutino" as "matutino" | "vespertino" | "integral",
        capacity: 30,
      });
    }
  }, [turmaToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation
    if (!formData.unitId) {
      setError("Unidade é obrigatória");
      setIsLoading(false);
      return;
    }

    if (!formData.stageId) {
      setError("Etapa é obrigatória");
      setIsLoading(false);
      return;
    }

    if (!formData.name.trim()) {
      setError("Nome da turma é obrigatório");
      setIsLoading(false);
      return;
    }

    if (!formData.code.trim()) {
      setError("Código é obrigatório");
      setIsLoading(false);
      return;
    }

    if (isNaN(formData.year) || formData.year < 2020) {
      setError("Ano inválido");
      setIsLoading(false);
      return;
    }

    if (isNaN(formData.capacity) || formData.capacity < 1) {
      setError("Capacidade deve ser maior que zero");
      setIsLoading(false);
      return;
    }

    try {
      // Ensure payload has correct types
      const payload = {
        unitId: formData.unitId,
        stageId: formData.stageId,
        name: formData.name.trim(),
        code: formData.code.trim(),
        year: Number(formData.year),
        shift: formData.shift,
        capacity: Number(formData.capacity),
      };

      console.log("Payload being sent:", payload);
      console.log("Payload types:", {
        unitId: typeof payload.unitId,
        stageId: typeof payload.stageId,
        name: typeof payload.name,
        code: typeof payload.code,
        year: typeof payload.year,
        shift: typeof payload.shift,
        capacity: typeof payload.capacity,
      });

      if (turmaToEdit) {
        // Update existing turma
        await clientFetch<Turma>(`/turmas/${turmaToEdit.id}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        // Create new turma
        await clientFetch<Turma>("/turmas", {
          method: "POST",
          body: payload,
        });
      }

      router.refresh();
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error("Error saving turma:", e);

      let errorMessage = "Erro ao salvar turma. Tente novamente.";

      if (e instanceof Error) {
        errorMessage = e.message;

        // Check if it's a FetchError with validation details
        if ('details' in e) {
          const details = (e as Error & { details?: unknown }).details;
          console.log("Validation details:", details);

          // Extract field errors from Zod's flattened format
          if (details && typeof details === 'object' && 'fieldErrors' in details) {
            const fieldErrors = details.fieldErrors as Record<string, string[]>;
            const errorMessages = Object.entries(fieldErrors)
              .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
              .join('\n');
            errorMessage = `Erro de validação:\n${errorMessages}`;
          }
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isEditing = !!turmaToEdit;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar Turma" : "Nova Turma"}
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
            Turma salva com sucesso!
          </div>
        )}

        {/* Unidade */}
        <div className="space-y-2">
          <Label htmlFor="unitId">
            Unidade <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <select
              id="unitId"
              required
              disabled={loadingUnits}
              className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
              value={formData.unitId}
              onChange={(e) =>
                setFormData({ ...formData, unitId: e.target.value, stageId: "" })
              }
            >
              <option value="">
                {loadingUnits ? "Carregando..." : "Selecione uma unidade"}
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Etapa */}
        <div className="space-y-2">
          <Label htmlFor="stageId">
            Etapa <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <GraduationCap className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <select
              id="stageId"
              required
              disabled={!formData.unitId || loadingStages}
              className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm disabled:opacity-50"
              value={formData.stageId}
              onChange={(e) => setFormData({ ...formData, stageId: e.target.value })}
            >
              <option value="">
                {!formData.unitId
                  ? "Selecione uma unidade primeiro"
                  : loadingStages
                    ? "Carregando..."
                    : "Selecione uma etapa"}
              </option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nome da Turma */}
        <div className="space-y-2">
          <Label htmlFor="name">
            Nome da Turma <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Users className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="name"
              placeholder="Ex: 1º Ano A"
              required
              className="pl-10"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
        </div>

        {/* Código Identificador */}
        <div className="space-y-2">
          <Label htmlFor="code">
            Código Identificador <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Hash className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="code"
              placeholder="Ex: EF1-1A"
              required
              className="pl-10"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>
        </div>

        {/* Ano Letivo e Capacidade */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="year">Ano Letivo</Label>
            <Input
              id="year"
              type="number"
              required
              value={formData.year}
              onChange={(e) =>
                setFormData({ ...formData, year: parseInt(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacidade</Label>
            <Input
              id="capacity"
              type="number"
              required
              value={formData.capacity}
              onChange={(e) =>
                setFormData({ ...formData, capacity: parseInt(e.target.value) })
              }
            />
          </div>
        </div>

        {/* Turno */}
        <div className="space-y-2">
          <Label htmlFor="shift">Turno</Label>
          <select
            id="shift"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={formData.shift}
            onChange={(e) =>
              setFormData({
                ...formData,
                shift: e.target.value as "matutino" | "vespertino" | "integral",
              })
            }
          >
            <option value="matutino">Matutino</option>
            <option value="vespertino">Vespertino</option>
            <option value="integral">Integral</option>
          </select>
        </div>

        {/* Actions */}
        <div className="pt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold min-w-[140px]"
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
              "Salvar Turma"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
