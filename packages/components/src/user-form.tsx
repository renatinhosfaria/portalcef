"use client";

import { useRouter } from "next/navigation";

import {
  createUserSchema,
  updateUserSchema,
  type EducationStage,
  type UserRole,
} from "@essencia/shared/schemas";
import { stageRequiredRoles } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  AlertCircle,
  Building2,
  Check,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { UserSummary } from "@essencia/lib/types";

import { api } from "@essencia/shared/fetchers/client";
import { useTenant } from "@essencia/shared/providers/tenant";
import { ROLE_HIERARCHY } from "@essencia/shared/roles";
import type { School, Unit } from "@essencia/shared/schemas";
import { Sheet } from "@essencia/ui/components/sheet";

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: UserSummary | null;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "master", label: "Master (Global)" },
  { value: "diretora_geral", label: "Diretora Geral" },
  { value: "gerente_unidade", label: "Gerente de Unidade" },
  { value: "gerente_financeiro", label: "Gerente Financeiro" },
  { value: "coordenadora_geral", label: "Coordenadora Geral" },
  { value: "coordenadora_bercario", label: "Coordenadora Bercario" },
  { value: "coordenadora_infantil", label: "Coordenadora Infantil" },
  { value: "coordenadora_fundamental_i", label: "Coordenadora Fundamental I" },
  {
    value: "coordenadora_fundamental_ii",
    label: "Coordenadora Fundamental II",
  },
  { value: "coordenadora_medio", label: "Coordenadora Medio" },
  { value: "analista_pedagogico", label: "Analista Pedagógico" },
  { value: "professora", label: "Professora" },
  { value: "auxiliar_administrativo", label: "Auxiliar Administrativo" },
  { value: "auxiliar_sala", label: "Auxiliar de Sala" },
];

export function UserForm({ isOpen, onClose, userToEdit }: UserFormProps) {
  const router = useRouter();
  const { role: currentUserRole, schoolId, unitId } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [isLoadingSchool, setIsLoadingSchool] = useState(false);
  const [stages, setStages] = useState<EducationStage[]>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchData() {
      setIsLoadingSchool(true);
      try {
        // If user is master, fetch all schools
        if (currentUserRole === "master") {
          const schoolsData = await api.get<School[]>("/schools", {
            signal: abortController.signal,
          });
          setSchools(schoolsData);

          // If editing, also fetch the specific school and units
          if (userToEdit?.schoolId) {
            const [schoolData, unitsData] = await Promise.all([
              api.get<School>(`/schools/${userToEdit.schoolId}`, {
                signal: abortController.signal,
              }),
              api.get<Unit[]>(`/schools/${userToEdit.schoolId}/units`, {
                signal: abortController.signal,
              }),
            ]);
            setSchool(schoolData);
            setUnits(unitsData);
            setSelectedSchoolId(userToEdit.schoolId);
          }
        } else {
          // For non-master users, use tenant's schoolId
          const targetSchoolId = schoolId;

          if (targetSchoolId) {
            const [schoolData, unitsData] = await Promise.all([
              api.get<School>(`/schools/${targetSchoolId}`, {
                signal: abortController.signal,
              }),
              api.get<Unit[]>(`/schools/${targetSchoolId}/units`, {
                signal: abortController.signal,
              }),
            ]);
            setSchool(schoolData);
            setUnits(unitsData);
          }
        }
      } catch (e) {
        // Ignore abort errors
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("Failed to fetch school/units data", e);
        setError(
          "Erro ao carregar dados da escola. Verifique suas permissões.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingSchool(false);
        }
      }
    }
    fetchData();

    return () => {
      abortController.abort();
    };
  }, [schoolId, userToEdit, currentUserRole]);

  // Fetch units when master selects a school
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchUnits() {
      if (currentUserRole === "master" && selectedSchoolId && !userToEdit) {
        try {
          const [schoolData, unitsData] = await Promise.all([
            api.get<School>(`/schools/${selectedSchoolId}`, {
              signal: abortController.signal,
            }),
            api.get<Unit[]>(`/schools/${selectedSchoolId}/units`, {
              signal: abortController.signal,
            }),
          ]);
          setSchool(schoolData);
          setUnits(unitsData);
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
          console.error("Failed to fetch units for selected school", e);
        }
      }
    }

    fetchUnits();

    return () => {
      abortController.abort();
    };
  }, [selectedSchoolId, currentUserRole, userToEdit]);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchStages() {
      setIsLoadingStages(true);
      try {
        const stagesData = await api.get<EducationStage[]>("/stages", {
          signal: abortController.signal,
        });
        setStages(stagesData);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("Failed to fetch stages data", e);
        setError(
          "Erro ao carregar dados de etapas. Verifique suas permissões.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingStages(false);
        }
      }
    }

    fetchStages();

    return () => {
      abortController.abort();
    };
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "professora" as UserRole,
    unitId: unitId || "",
    stageId: "",
  });

  // Populate form when editing
  useEffect(() => {
    if (userToEdit && isOpen) {
      setFormData({
        name: userToEdit.name,
        email: userToEdit.email,
        password: "", // Never pre-fill password
        role: userToEdit.role,
        unitId: userToEdit.unitId || unitId || "",
        stageId: userToEdit.stageId || "",
      });
      if (userToEdit.schoolId) {
        setSelectedSchoolId(userToEdit.schoolId);
      }
    } else if (!isOpen) {
      // Reset form when closing
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "professora",
        unitId: unitId || "",
        stageId: "",
      });
      setSelectedSchoolId("");
      setSchools([]);
      setUnits([]);
      setSchool(null);
    }
  }, [userToEdit, isOpen, unitId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const requiresStage = stageRequiredRoles.includes(formData.role);

      // Validate school selection for master creating non-master users
      if (
        currentUserRole === "master" &&
        formData.role !== "master" &&
        !selectedSchoolId &&
        !userToEdit
      ) {
        setError("Por favor, selecione uma escola.");
        setIsLoading(false);
        return;
      }

      // Prepare payload based on role
      let payload: {
        name: string;
        email: string;
        password: string;
        role: UserRole;
        schoolId: string | null;
        unitId: string | null;
        stageId: string | null;
      };

      // Determine schoolId based on current user role
      const effectiveSchoolId =
        currentUserRole === "master" ? selectedSchoolId : schoolId;

      if (formData.role === "master") {
        // Master: no school or unit
        payload = {
          ...formData,
          schoolId: null,
          unitId: null,
          stageId: null,
        };
      } else if (formData.role === "diretora_geral") {
        // Diretora Geral: school required, no unit
        payload = {
          ...formData,
          schoolId: effectiveSchoolId,
          unitId: null,
          stageId: null,
        };
      } else {
        // Other roles: both school and unit required
        payload = {
          ...formData,
          schoolId: effectiveSchoolId,
          unitId: formData.unitId || null,
          stageId: requiresStage ? formData.stageId || null : null,
        };
      }

      if (isEditing) {
        // When editing, remove password and validate with updateUserSchema
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _password, ...updatePayload } = payload;
        const result = updateUserSchema.safeParse(updatePayload);

        if (!result.success) {
          const issues = result.error.issues;
          const firstIssue = issues[0];
          setError(firstIssue?.message ?? "Dados invalidos.");
          setIsLoading(false);
          return;
        }

        await api.put(`/users/${userToEdit.id}`, updatePayload);
        router.refresh();
      } else {
        // When creating, validate with createUserSchema (password required)
        const result = createUserSchema.safeParse(payload);

        if (!result.success) {
          const issues = result.error.issues;
          const firstIssue = issues[0];
          setError(firstIssue?.message ?? "Dados invalidos.");
          setIsLoading(false);
          return;
        }

        await api.post("/users", payload);
        router.refresh();
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        // Reset form
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "professora",
          unitId: unitId || "",
          stageId: "",
        });
        setSelectedSchoolId("");
        setSchools([]);
        setUnits([]);
        setSchool(null);
      }, 1000);
    } catch (e) {
      console.error(e);
      setError("Erro ao salvar usuário. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const isEditing = !!userToEdit;
  const requiresStage = stageRequiredRoles.includes(formData.role);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar Usuário" : "Novo Usuário"}
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
            Usuário salvo com sucesso!
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Nome Completo</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="name"
              placeholder="Ex: Maria da Silva"
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
          <Label htmlFor="email">E-mail Institucional</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="maria@essencia.edu.br"
              required
              className="pl-10"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
        </div>

        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="password">Senha Temporária</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                required
                className="pl-10"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="role">Cargo / Função</Label>
          <select
            id="role"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={formData.role}
            onChange={(e) => {
              const nextRole = e.target.value as UserRole;
              setFormData((prev) => ({
                ...prev,
                role: nextRole,
                stageId: stageRequiredRoles.includes(nextRole)
                  ? prev.stageId
                  : "",
              }));
            }}
          >
            {ROLE_OPTIONS.filter((opt) => {
              // Master can assign any role
              if (currentUserRole === "master") return true;

              // Others can only assign roles with lower privilege (higher number)
              const currentLevel = ROLE_HIERARCHY[currentUserRole] ?? 999;
              const optionLevel = ROLE_HIERARCHY[opt.value] ?? 999;
              return optionLevel > currentLevel;
            }).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* School field */}
        {formData.role !== "master" && (
          <div className="space-y-2">
            <Label htmlFor="school">Escola</Label>
            {currentUserRole === "master" ? (
              // Master can select school
              <div className="relative">
                <select
                  id="school"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedSchoolId}
                  onChange={(e) => {
                    setSelectedSchoolId(e.target.value);
                    // Reset unit selection when school changes
                    setFormData({ ...formData, unitId: "" });
                  }}
                  required={!userToEdit}
                  disabled={isLoadingSchool || !!userToEdit}
                >
                  <option value="">
                    {isLoadingSchool
                      ? "Carregando escolas..."
                      : "Selecione a Escola"}
                  </option>
                  {schools.map((sch) => (
                    <option key={sch.id} value={sch.id}>
                      {sch.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              // Non-master users see read-only school field
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="school"
                  value={
                    isLoadingSchool
                      ? "Carregando..."
                      : school?.name || "Escola não encontrada"
                  }
                  readOnly
                  className="pl-10 bg-slate-50 text-slate-500"
                  disabled
                />
              </div>
            )}
            <p className="text-xs text-slate-500">
              {currentUserRole === "master"
                ? "Selecione a escola a qual este usuário pertence."
                : "Todos os usuários (exceto Master) são vinculados a esta escola."}
            </p>
          </div>
        )}

        {/* Show Unit field only for roles that require it */}
        {formData.role !== "master" && formData.role !== "diretora_geral" && (
          <div className="space-y-2">
            <Label htmlFor="unit">Unidade</Label>
            <div className="relative">
              <select
                id="unit"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.unitId}
                onChange={(e) =>
                  setFormData({ ...formData, unitId: e.target.value })
                }
                required
              >
                <option value="">Selecione a Unidade</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              Selecione a unidade a qual este usuário pertence.
            </p>
          </div>
        )}

        {/* Show Stage field for stage-scoped roles */}
        {requiresStage && (
          <div className="space-y-2">
            <Label htmlFor="stage">Etapa</Label>
            <div className="relative">
              <select
                id="stage"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.stageId}
                onChange={(e) =>
                  setFormData({ ...formData, stageId: e.target.value })
                }
                required
                disabled={isLoadingStages}
              >
                <option value="">
                  {isLoadingStages ? "Carregando..." : "Selecione a Etapa"}
                </option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              Selecione a etapa pedagógica deste usuário.
            </p>
          </div>
        )}

        {/* Info message for Master role */}
        {formData.role === "master" && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
            <strong>Atenção:</strong> Usuários com role Master não são
            vinculados a nenhuma escola ou unidade (acesso global).
          </div>
        )}

        {/* Info message for Diretora Geral role */}
        {formData.role === "diretora_geral" && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <strong>Atenção:</strong> Diretora Geral tem acesso a toda a escola
            e todas as suas unidades.
          </div>
        )}

        {/* Hierarchy info message */}
        {currentUserRole !== "master" && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
            <strong>Nota:</strong> Você pode criar usuários apenas com roles de
            menor privilégio que o seu.
          </div>
        )}

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
              "Salvar Usuário"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
