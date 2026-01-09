"use client";

import { api } from "@essencia/shared/fetchers/client";
import { createUserSchema, type UserRole } from "@essencia/shared/schemas";
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
import { useState } from "react";

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize with Diretora role locked
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "diretora_geral" as UserRole,
  });

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
      // Logic for Diretora Geral: SchoolID is required, UnitID depends on business logic but usually
      // a Diretora Geral is creating for a Unit or School?
      // Re-reading logic: "Diretora Geral: SchoolId required, UnitId null" in shared schema (lines 124-125 of shared/index.ts).
      // WAIT. If Diretora Geral is PER UNIT (as requested "Diretora Geral de cada unidade"),
      // then the schema might be too restrictive or my understanding of the schema is strict.
      // Let's check schema: "if role === diretora_geral -> schoolId !== null && unitId === null"
      // If the user wants a Director FOR A UNIT, we might need "gerente_unidade"?
      // OR maybe I should use "gerente_unidade" for the unit manager role?
      // The user clearly said "Diretora Geral de cada unidade".
      // In many schools, "Diretora" is the head of the specific unit.
      // If the schema enforces unitId=null for diretora_geral, it implies Diretora Geral is SCHOOL WIDE.
      // If so, implementing "Diretora Geral de cada unidade" might conflict with the existing schema validation or role definition.
      // I will proceed assuming I should use "gerente_unidade" (Unit Manager) conceptually but label it "Diretora da Unidade" OR override the check if I can.
      // HOWEVER, looking at roleEnum: "gerente_unidade" exists. "diretora_geral" seems higher up.
      // Let's assume for this form I will try to create a "gerente_unidade" which allows unitId, but Display "Diretora da Unidade".
      // OR I will assume the user wants `gerente_unidade` role but calls it Diretora.
      // Let's try `gerente_unidade` to be safe with the schema (unitId required).

      const roleToUse = "gerente_unidade";

      const payload = {
        ...formData,
        role: roleToUse as UserRole,
        schoolId: schoolId,
        unitId: unit.id,
        stageId: null,
      };

      const result = createUserSchema.safeParse(payload);

      if (!result.success) {
        const issue = result.error.issues[0];
        setError(issue?.message ?? "Dados invalidos.");
        setIsLoading(false);
        return;
      }

      await api.post("/users", result.data);
      await onSaved?.();

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "diretora_geral",
        });
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar diretora.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Nova Diretora - ${unit?.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-6">
          <h4 className="text-amber-800 font-bold flex items-center gap-2 text-sm mb-1">
            <ShieldCheck className="w-4 h-4" />
            Permissões de Acesso
          </h4>
          <p className="text-amber-700 text-xs text-pretty">
            O usuário criado terá acesso administrativo total à unidade{" "}
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
          <Label htmlFor="dir-pass">Senha Temporária</Label>
          <Input
            id="dir-pass"
            type="password"
            placeholder="*******"
            required
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
                Feito!
              </>
            ) : (
              "Confirmar Cadastro"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
