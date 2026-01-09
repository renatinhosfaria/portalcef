"use client";

import { api } from "@essencia/shared/fetchers/client";
import {
  createUserSchema,
  updateUserSchema,
  type UserRole,
} from "@essencia/shared/schemas";
import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  AlertCircle,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet } from "../ui/sheet";

interface DirectorSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
}

interface DirectorGeneralFormProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  schoolName?: string | null;
  onSaved?: () => void | Promise<void>;
}

const DIRECTOR_ROLE: UserRole = "diretora_geral";
const getInitialFormData = () => ({
  name: "",
  email: "",
  password: "",
});

export function DirectorGeneralForm({
  isOpen,
  onClose,
  schoolId,
  schoolName,
  onSaved,
}: DirectorGeneralFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [directorId, setDirectorId] = useState<string | null>(null);
  const [formData, setFormData] = useState(getInitialFormData);

  const isEditing = !!directorId;
  const isDisabled = isLoading || isFetching;

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccess(false);
    setDirectorId(null);
    setFormData(getInitialFormData());

    if (!schoolId) {
      setError("Escola invalida.");
      return;
    }

    let isActive = true;

    const loadDirector = async () => {
      setIsFetching(true);
      try {
        const users = await api.get<DirectorSummary[]>("/users");
        const director = users.find(
          (user) =>
            user.role === DIRECTOR_ROLE &&
            user.schoolId === schoolId &&
            !user.unitId,
        );

        if (!isActive) return;

        if (director) {
          setDirectorId(director.id);
          setFormData({
            name: director.name ?? "",
            email: director.email ?? "",
            password: "",
          });
        } else {
          setDirectorId(null);
          setFormData(getInitialFormData());
        }
      } catch (err) {
        if (!isActive) return;
        setError(
          err instanceof Error
            ? err.message
            : "Erro ao carregar diretora geral.",
        );
      } finally {
        if (isActive) {
          setIsFetching(false);
        }
      }
    };

    void loadDirector();

    return () => {
      isActive = false;
    };
  }, [isOpen, schoolId]);

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    setIsFetching(false);
    setDirectorId(null);
    setFormData(getInitialFormData());
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!schoolId) {
      setError("Escola invalida.");
      setIsLoading(false);
      return;
    }

    try {
      const basePayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
      };

      if (isEditing && directorId) {
        const result = updateUserSchema.safeParse(basePayload);
        if (!result.success) {
          const issue = result.error.issues[0];
          setError(issue?.message ?? "Dados invalidos.");
          setIsLoading(false);
          return;
        }

        await api.put(`/users/${directorId}`, result.data);
      } else {
        const createPayload = {
          ...basePayload,
          password: formData.password,
          role: DIRECTOR_ROLE,
          schoolId,
          unitId: null,
          stageId: null,
        };
        const result = createUserSchema.safeParse(createPayload);
        if (!result.success) {
          const issue = result.error.issues[0];
          setError(issue?.message ?? "Dados invalidos.");
          setIsLoading(false);
          return;
        }

        await api.post("/users", result.data);
      }

      await onSaved?.();

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        handleClose();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar diretora geral.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const title = schoolName
    ? `Diretora Geral - ${schoolName}`
    : "Diretora Geral";

  return (
    <Sheet isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {isFetching && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando diretora geral...
          </div>
        )}

        {!isFetching && !isEditing && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
            <h4 className="text-amber-800 font-bold flex items-center gap-2 text-sm mb-1">
              <ShieldCheck className="w-4 h-4" />
              Nenhuma diretora geral vinculada
            </h4>
            <p className="text-amber-700 text-xs text-pretty">
              Cadastre a diretora geral para liberar acesso administrativo total
              a escola.
            </p>
          </div>
        )}

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
          <Label htmlFor="director-general-name">Nome Completo</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="director-general-name"
              placeholder="Ex: Ana Souza"
              required
              className="pl-10"
              value={formData.name}
              onChange={(e) =>
                setFormData((current) => ({
                  ...current,
                  name: e.target.value,
                }))
              }
              disabled={isDisabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="director-general-email">E-mail Institucional</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="director-general-email"
              type="email"
              placeholder="ana.souza@essencia.edu.br"
              required
              className="pl-10"
              value={formData.email}
              onChange={(e) =>
                setFormData((current) => ({
                  ...current,
                  email: e.target.value,
                }))
              }
              disabled={isDisabled}
            />
          </div>
        </div>

        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="director-general-password">Senha Temporaria</Label>
            <Input
              id="director-general-password"
              type="password"
              placeholder="*******"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData((current) => ({
                  ...current,
                  password: e.target.value,
                }))
              }
              disabled={isDisabled}
            />
          </div>
        )}

        <div className="pt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold min-w-[160px]"
            disabled={isDisabled || success}
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
              "Salvar Alteracoes"
            ) : (
              "Cadastrar Diretora"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
