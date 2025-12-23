"use client";

import { api } from "@essencia/shared/fetchers/client";
import { createUnitSchema, updateUnitSchema } from "@essencia/shared/schemas";
import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  AlertCircle,
  Building2,
  Check,
  Hash,
  Loader2,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet } from "../ui/sheet";

import type { UnitListItem } from "./unit-list";

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

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
  });

  const isEditing = !!unitToEdit;

  useEffect(() => {
    if (unitToEdit) {
      setFormData({
        name: unitToEdit.name,
        code: unitToEdit.code,
        address: unitToEdit.address ?? "",
      });
      return;
    }

    if (isOpen) {
      setFormData({ name: "", code: "", address: "" });
    }
  }, [isOpen, unitToEdit]);

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    setFormData({ name: "", code: "", address: "" });
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

      if (isEditing && unitToEdit) {
        await api.put(
          `/schools/${schoolId}/units/${unitToEdit.id}`,
          result.data,
        );
      } else {
        await api.post(`/schools/${schoolId}/units`, result.data);
      }
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
