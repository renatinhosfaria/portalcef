"use client";

import { api } from "@essencia/shared/fetchers/client";
import { createUserSchema, updateUserSchema } from "@essencia/shared/schemas";
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

import type { UnitListItem } from "./unit-list";

interface DirectorFormProps {
  isOpen: boolean;
  onClose: () => void;
  unit: UnitListItem | null;
  schoolId: string;
  onSaved?: () => void | Promise<void>;
}

export function DirectorForm({
  isOpen,
  onClose,
  unit,
  schoolId,
  onSaved,
}: DirectorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [directorId, setDirectorId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (!isOpen || !unit?.id) {
      setDirectorId(null);
      setFormData({ name: "", email: "", password: "" });
      setError(null);
      setSuccess(false);
      return;
    }

    let ativo = true;
    setIsLoadingExisting(true);
    setError(null);
    setSuccess(false);

    void api
      .get<
        Array<{
          id: string;
          name: string;
          email: string;
          role: string;
          unitId: string | null;
        }>
      >("/users")
      .then((users) => {
        if (!ativo) return;
        const existing = users.find(
          (user) => user.role === "gerente_unidade" && user.unitId === unit.id,
        );
        setDirectorId(existing?.id ?? null);
        setFormData({
          name: existing?.name ?? "",
          email: existing?.email ?? "",
          password: "",
        });
      })
      .catch((err) => {
        if (ativo) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar gerente da unidade.",
          );
        }
      })
      .finally(() => {
        if (ativo) setIsLoadingExisting(false);
      });

    return () => {
      ativo = false;
    };
  }, [isOpen, unit?.id]);

  const resetForm = () => {
    setDirectorId(null);
    setFormData({ name: "", email: "", password: "" });
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!unit?.id) {
      setError("Unidade não identificada.");
      setIsLoading(false);
      return;
    }

    try {
      if (directorId) {
        const result = updateUserSchema.safeParse({
          name: formData.name.trim(),
          email: formData.email.trim(),
          ...(formData.password ? { password: formData.password } : {}),
        });

        if (!result.success) {
          const issue = result.error.issues[0];
          setError(issue?.message ?? "Dados invalidos.");
          setIsLoading(false);
          return;
        }

        await api.put(`/users/${directorId}`, result.data);
      } else {
        const result = createUserSchema.safeParse({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: "gerente_unidade",
          schoolId,
          unitId: unit.id,
          stageId: null,
        });

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
        onClose();
        resetForm();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar gerente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`${directorId ? "Editar" : "Novo"} Gerente da Unidade - ${unit?.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-6">
          <h4 className="text-amber-800 font-bold flex items-center gap-2 text-sm mb-1">
            <ShieldCheck className="w-4 h-4" />
            Permissões de Acesso
          </h4>
          <p className="text-amber-700 text-xs text-pretty">
            O usuário terá acesso administrativo à unidade{" "}
            <strong>{unit?.name}</strong> e poderá gerenciar professores e
            alunos locais.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            Cadastrado com sucesso!
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="dir-name">Nome Completo</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="dir-name"
              placeholder="Ex: Ana Souza"
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
          <Label htmlFor="dir-email">E-mail Institucional</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="dir-email"
              type="email"
              placeholder="ana.souza@essencia.edu.br"
              required
              className="pl-10"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dir-pass">
            {directorId ? "Nova Senha (opcional)" : "Senha Temporária"}
          </Label>
          <Input
            id="dir-pass"
            type="password"
            placeholder="*******"
            required={!directorId}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />
        </div>

        <div className="pt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold min-w-[140px]"
            disabled={isLoading || isLoadingExisting || success}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : success ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Feito!
              </>
            ) : directorId ? (
              "Salvar Alterações"
            ) : (
              "Cadastrar Gerente"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
