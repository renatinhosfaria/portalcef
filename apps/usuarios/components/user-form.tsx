"use client";

import { createUserSchema, type UserRole } from "@essencia/shared/schemas";
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
import { useState } from "react";

import type { UserSummary } from "../lib/types";

import { useTenant } from "@essencia/shared/providers/tenant";
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
  { value: "coordenadora_geral", label: "Coordenadora Geral" },
  { value: "professora", label: "Professora" },
  { value: "auxiliar_administrativo", label: "Auxiliar Administrativo" },
];

export function UserForm({ isOpen, onClose, userToEdit }: UserFormProps) {
  const { role: currentUserRole, schoolId, unitId } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "professora" as UserRole,
    unitId: unitId || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Prepare payload
      const payload = {
        ...formData,
        schoolId: schoolId,
        unitId: formData.unitId || null,
      };

      // Validate client-side
      const result = createUserSchema.safeParse(payload);

      if (!result.success) {
        const issues = result.error.issues;
        const firstIssue = issues[0];
        setError(firstIssue?.message ?? "Dados invalidos.");
        setIsLoading(false);
        return;
      }

      // Simulate API Call
      await new Promise((resolve) => setTimeout(resolve, 1500));

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
        });
      }, 1000);
    } catch {
      setError("Erro ao salvar usuário. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const isEditing = !!userToEdit;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar Usuário" : "Novo Úsuário"}
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
            onChange={(e) =>
              setFormData({ ...formData, role: e.target.value as UserRole })
            }
          >
            {ROLE_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={
                  currentUserRole !== "master" && opt.value === "master"
                }
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Show Unit Selector if Master or Diretora */}
        {(currentUserRole === "master" ||
          currentUserRole === "diretora_geral") && (
          <div className="space-y-2">
            <Label htmlFor="unit">Unidade Vinculada</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                id="unit"
                placeholder="ID da Unidade (UUID)" // In real app this would be a Select
                className="pl-10"
                value={formData.unitId}
                onChange={(e) =>
                  setFormData({ ...formData, unitId: e.target.value })
                }
                disabled={
                  currentUserRole !== "master" &&
                  currentUserRole !== "diretora_geral"
                } // Only Master/Diretora can change unit
              />
            </div>
            <p className="text-xs text-slate-500">
              Deixe em branco se o cargo for de nível Escola (ex: Diretora).
            </p>
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
