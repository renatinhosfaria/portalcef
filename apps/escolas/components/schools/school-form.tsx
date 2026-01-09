"use client";

import { api } from "@essencia/shared/fetchers/client";
import {
  createSchoolSchema,
  createUnitSchema,
  createUserSchema,
  type UserRole,
} from "@essencia/shared/schemas";
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
  Landmark,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet } from "../ui/sheet";

import type { SchoolListItem } from "./school-list";

interface EducationStage {
  id: string;
  name: string;
  code: string;
}

interface SchoolFormProps {
  isOpen: boolean;
  onClose: () => void;
  schoolToEdit?: SchoolListItem | null;
  onSaved?: () => void | Promise<void>;
}

const DIRECTOR_ROLE: UserRole = "diretora_geral";
const unitFieldsSchema = createUnitSchema.omit({ schoolId: true });
const PLACEHOLDER_SCHOOL_ID = "00000000-0000-0000-0000-000000000000";

const getInitialFormData = () => ({
  school: {
    name: "",
    code: "",
  },
  unit: {
    name: "",
    code: "",
    address: "",
    stageIds: [] as string[],
  },
  director: {
    name: "",
    email: "",
    password: "",
  },
});

export function SchoolForm({
  isOpen,
  onClose,
  schoolToEdit,
  onSaved,
}: SchoolFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [availableStages, setAvailableStages] = useState<EducationStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);

  const [formData, setFormData] = useState(getInitialFormData);

  const isEditing = !!schoolToEdit;

  useEffect(() => {
    if (schoolToEdit) {
      setFormData((current) => ({
        ...current,
        school: {
          name: schoolToEdit.name,
          code: schoolToEdit.code,
        },
      }));
      return;
    }

    if (isOpen) {
      setFormData(getInitialFormData());
    }
  }, [isOpen, schoolToEdit]);

  useEffect(() => {
    async function fetchStages() {
      if (!isOpen || isEditing) return;

      setStagesLoading(true);
      try {
        const response = await api.get<EducationStage[]>("/stages");
        setAvailableStages(response);
      } catch (err) {
        console.error("Erro ao carregar etapas:", err);
      } finally {
        setStagesLoading(false);
      }
    }

    fetchStages();
  }, [isOpen, isEditing]);

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    setFormData(getInitialFormData());
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const schoolPayload = {
        name: formData.school.name.trim(),
        code: formData.school.code.trim(),
      };
      const schoolResult = createSchoolSchema.safeParse(schoolPayload);

      if (!schoolResult.success) {
        const issue = schoolResult.error.issues[0];
        setError(issue?.message ?? "Dados invalidos.");
        setIsLoading(false);
        return;
      }

      if (isEditing && schoolToEdit) {
        await api.put(`/schools/${schoolToEdit.id}`, schoolResult.data);
        await onSaved?.();
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          handleClose();
        }, 1000);
        return;
      }

      const unitPayload = {
        name: formData.unit.name.trim(),
        code: formData.unit.code.trim(),
        address: formData.unit.address.trim() || undefined,
      };
      const unitResult = unitFieldsSchema.safeParse(unitPayload);

      if (!unitResult.success) {
        const issue = unitResult.error.issues[0];
        setError(issue?.message ?? "Dados invalidos.");
        setIsLoading(false);
        return;
      }

      const directorPayload = {
        name: formData.director.name.trim(),
        email: formData.director.email.trim(),
        password: formData.director.password,
        role: DIRECTOR_ROLE,
        schoolId: PLACEHOLDER_SCHOOL_ID,
        unitId: null,
        stageId: null,
      };
      const directorResult = createUserSchema.safeParse(directorPayload);

      if (!directorResult.success) {
        const issue = directorResult.error.issues[0];
        setError(issue?.message ?? "Dados invalidos.");
        setIsLoading(false);
        return;
      }

      const createdSchool = await api.post<{ id: string }>(
        "/schools",
        schoolResult.data,
      );
      const createdUnit = await api.post<{ id: string }>(
        `/schools/${createdSchool.id}/units`,
        unitResult.data,
      );

      if (formData.unit.stageIds.length > 0) {
        await api.post(`/units/${createdUnit.id}/stages`, {
          stageIds: formData.unit.stageIds,
        });
      }

      const directorCreatePayload = {
        ...directorResult.data,
        schoolId: createdSchool.id,
      };

      await api.post("/users", directorCreatePayload);
      await onSaved?.();

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        handleClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar escola.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Editar Escola" : "Nova Escola"}
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
          <Label htmlFor="school-name">Nome da Instituição</Label>
          <div className="relative">
            <Landmark className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="school-name"
              placeholder="Ex: Colégio Essência - Matriz"
              required
              className="pl-10"
              value={formData.school.name}
              onChange={(e) =>
                setFormData((current) => ({
                  ...current,
                  school: { ...current.school, name: e.target.value },
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="school-code">Código Identificador (Slug)</Label>
          <div className="relative">
            <Hash className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="school-code"
              placeholder="ex: essencia-sp-matriz"
              required
              className="pl-10"
              value={formData.school.code}
              onChange={(e) =>
                setFormData((current) => ({
                  ...current,
                  school: { ...current.school, code: e.target.value },
                }))
              }
            />
          </div>
          <p className="text-xs text-slate-500">
            Usado para URLs e identificação interna. Use letras minúsculas e
            hífen.
          </p>
        </div>

        {!isEditing && (
          <>
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                Unidade Principal
              </h3>
              <div className="space-y-2">
                <Label htmlFor="unit-name">Nome da Unidade</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="unit-name"
                    placeholder="Ex: Unidade Vila Madalena"
                    required
                    className="pl-10"
                    value={formData.unit.name}
                    onChange={(e) =>
                      setFormData((current) => ({
                        ...current,
                        unit: { ...current.unit, name: e.target.value },
                      }))
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
                    value={formData.unit.code}
                    onChange={(e) =>
                      setFormData((current) => ({
                        ...current,
                        unit: { ...current.unit, code: e.target.value },
                      }))
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
                    value={formData.unit.address}
                    onChange={(e) =>
                      setFormData((current) => ({
                        ...current,
                        unit: { ...current.unit, address: e.target.value },
                      }))
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
                  <p className="text-sm text-slate-500">
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
                          checked={formData.unit.stageIds.includes(stage.id)}
                          onCheckedChange={(checked) => {
                            setFormData((current) => ({
                              ...current,
                              unit: {
                                ...current.unit,
                                stageIds: checked
                                  ? [...current.unit.stageIds, stage.id]
                                  : current.unit.stageIds.filter(
                                      (id) => id !== stage.id,
                                    ),
                              },
                            }));
                          }}
                        />
                        <span className="text-sm text-slate-700">
                          {stage.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                Diretora Geral
              </h3>
              <div className="space-y-2">
                <Label htmlFor="director-name">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="director-name"
                    placeholder="Ex: Ana Souza"
                    required
                    className="pl-10"
                    value={formData.director.name}
                    onChange={(e) =>
                      setFormData((current) => ({
                        ...current,
                        director: { ...current.director, name: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="director-email">E-mail Institucional</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="director-email"
                    type="email"
                    placeholder="ana.souza@essencia.edu.br"
                    required
                    className="pl-10"
                    value={formData.director.email}
                    onChange={(e) =>
                      setFormData((current) => ({
                        ...current,
                        director: {
                          ...current.director,
                          email: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="director-password">Senha Temporária</Label>
                <Input
                  id="director-password"
                  type="password"
                  placeholder="*******"
                  required
                  value={formData.director.password}
                  onChange={(e) =>
                    setFormData((current) => ({
                      ...current,
                      director: {
                        ...current.director,
                        password: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <p className="text-xs text-slate-500">
                A diretora geral terá acesso administrativo total a todas as
                unidades da escola.
              </p>
            </div>
          </>
        )}

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
            ) : isEditing ? (
              "Salvar Alterações"
            ) : (
              "Cadastrar Escola"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
