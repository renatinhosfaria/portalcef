"use client";

import { clientFetch } from "@essencia/shared/fetchers/client";
import type { Turma } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import { Label } from "@essencia/ui/components/label";
import { Sheet } from "@essencia/ui/components/sheet";
import { AlertCircle, Check, Loader2, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Professor {
  id: string;
  name: string;
  email: string;
}

interface GerenciarProfessoraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  turma: Turma | null;
  onSuccess: () => void;
}

export function GerenciarProfessoraDialog({
  isOpen,
  onClose,
  turma,
  onSuccess,
}: GerenciarProfessoraDialogProps) {
  const [professoras, setProfessoras] = useState<Professor[]>([]);
  const [selectedProfessoraId, setSelectedProfessoraId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfessoras, setIsLoadingProfessoras] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadProfessoras = useCallback(async () => {
    if (!turma) return;

    setIsLoadingProfessoras(true);
    setError(null);

    try {
      const data = await clientFetch<Professor[]>(
        `/turmas/${turma.id}/professoras-disponiveis`,
      );
      setProfessoras(data ?? []);
    } catch (err) {
      console.error("Erro ao carregar professoras:", err);
      setError("Erro ao carregar professoras disponíveis");
    } finally {
      setIsLoadingProfessoras(false);
    }
  }, [turma]);

  // Carregar professoras disponíveis quando o dialog abre
  useEffect(() => {
    if (isOpen && turma) {
      loadProfessoras();
      // Pré-selecionar professora atual se houver
      if (turma.professoraId) {
        setSelectedProfessoraId(turma.professoraId);
      } else {
        setSelectedProfessoraId("");
      }
    }
  }, [isOpen, turma, loadProfessoras]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turma) return;

    setIsLoading(true);
    setError(null);

    try {
      if (selectedProfessoraId) {
        // Atribuir ou alterar professora
        await clientFetch(`/turmas/${turma.id}/professora`, {
          method: "PUT",
          body: { professoraId: selectedProfessoraId },
        });
      } else {
        // Remover professora
        await clientFetch(`/turmas/${turma.id}/professora`, {
          method: "DELETE",
        });
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Erro ao gerenciar professora:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao salvar alterações";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!turma || !turma.professoraId) return;

    setIsLoading(true);
    setError(null);

    try {
      await clientFetch(`/turmas/${turma.id}/professora`, {
        method: "DELETE",
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Erro ao remover professora:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao remover professora";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!turma) return null;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Gerenciar Professora">
      <div className="mt-6">
        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">Turma:</strong> {turma.name} (
            {turma.code})
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            Professora atualizada com sucesso!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seletor de Professora */}
          <div className="space-y-2">
            <Label htmlFor="professora">Professora Titular</Label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <select
                id="professora"
                disabled={isLoadingProfessoras || isLoading}
                className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm disabled:opacity-50"
                value={selectedProfessoraId}
                onChange={(e) => setSelectedProfessoraId(e.target.value)}
              >
                <option value="">
                  {isLoadingProfessoras
                    ? "Carregando..."
                    : "Nenhuma professora atribuída"}
                </option>
                {professoras.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              Apenas professoras da mesma unidade e etapa da turma são exibidas
            </p>
          </div>

          {/* Aviso se não houver professoras disponíveis */}
          {!isLoadingProfessoras && professoras.length === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <p className="font-medium mb-1">Nenhuma professora disponível</p>
              <p className="text-xs">
                Não há professoras cadastradas para esta unidade e etapa. Entre
                em contato com a administração.
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <div>
              {turma.professoraId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={isLoading || success}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remover Professora
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold min-w-[120px]"
                disabled={
                  isLoading ||
                  success ||
                  isLoadingProfessoras ||
                  !selectedProfessoraId
                }
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
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Sheet>
  );
}
