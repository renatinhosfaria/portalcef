"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useTenant } from "@essencia/shared/providers/tenant";
import type { TurmaWithProfessora } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { toast } from "@essencia/ui/components/toaster";
import { AlertTriangle, Ban } from "lucide-react";
import { useState } from "react";

import { getTurmaCapabilities } from "../lib/capabilities";

import { GerenciarProfessoraDialog } from "./gerenciar-professora-dialog";
import { TurmaForm } from "./turma-form";
import { TurmasList } from "./turmas-list";

interface TurmasPageContentProps {
  turmas: TurmaWithProfessora[];
  isLoading: boolean;
  onRefresh: () => void;
}

const ALLOWED_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
];

export function TurmasPageContent({
  turmas,
  isLoading,
  onRefresh,
}: TurmasPageContentProps) {
  const { role, isLoaded } = useTenant();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [turmaToEdit, setTurmaToEdit] = useState<TurmaWithProfessora | null>(
    null,
  );
  const [isGerenciarProfessoraOpen, setIsGerenciarProfessoraOpen] =
    useState(false);
  const [turmaToManageProfessora, setTurmaToManageProfessora] =
    useState<TurmaWithProfessora | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [turmaToArchive, setTurmaToArchive] =
    useState<TurmaWithProfessora | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const capabilities = getTurmaCapabilities(role);

  if (!isLoaded) {
    return null;
  }

  // Access Control
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <Ban className="w-8 h-8 text-red-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Acesso Negado</h2>
          <p className="text-slate-500 max-w-md">
            Você não tem permissão para acessar o módulo de gestão de turmas.
            Entre em contato com o administrador se acredita que isso é um erro.
          </p>
        </div>
      </div>
    );
  }

  const handleCreateClick = () => {
    setTurmaToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (turma: TurmaWithProfessora) => {
    setTurmaToEdit(turma);
    setIsFormOpen(true);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setTurmaToEdit(null);
    // Refresh data when closing in case changes were made
    onRefresh();
  };

  const handleGerenciarProfessoraClick = (turma: TurmaWithProfessora) => {
    setTurmaToManageProfessora(turma);
    setIsGerenciarProfessoraOpen(true);
  };

  const handleGerenciarProfessoraClose = () => {
    setIsGerenciarProfessoraOpen(false);
    setTurmaToManageProfessora(null);
  };

  const handleGerenciarProfessoraSuccess = () => {
    // Refresh data after professor assignment
    onRefresh();
  };

  const handleArchiveClick = (turma: TurmaWithProfessora) => {
    setTurmaToArchive(turma);
    setIsArchiveDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!turmaToArchive) return;

    setIsArchiving(true);
    try {
      await api.patch(`/turmas/${turmaToArchive.id}/arquivar`);
      toast.success("Turma arquivada com sucesso");
      setIsArchiveDialogOpen(false);
      setTurmaToArchive(null);
      onRefresh();
    } catch {
      toast.error("Erro ao arquivar turma. Tente novamente.");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleArchiveCancel = () => {
    setIsArchiveDialogOpen(false);
    setTurmaToArchive(null);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Gestão de Turmas
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl text-balance">
          Gerencie as turmas, turnos e capacidades da unidade escolar.
        </p>
      </div>

      <TurmasList
        turmas={turmas}
        isLoading={isLoading}
        onRefresh={onRefresh}
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onGerenciarProfessoraClick={handleGerenciarProfessoraClick}
        onArchiveClick={handleArchiveClick}
        {...capabilities}
      />

      <TurmaForm
        isOpen={isFormOpen}
        onClose={handleFormCancel}
        turmaToEdit={turmaToEdit}
      />

      <GerenciarProfessoraDialog
        isOpen={isGerenciarProfessoraOpen}
        onClose={handleGerenciarProfessoraClose}
        turma={turmaToManageProfessora}
        onSuccess={handleGerenciarProfessoraSuccess}
      />

      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <DialogTitle>Arquivar Turma</DialogTitle>
                <DialogDescription>
                  A turma ficará inativa e poderá ser restaurada futuramente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600">
              Tem certeza que deseja arquivar a turma{" "}
              <span className="font-semibold text-slate-900">
                {turmaToArchive?.name}
              </span>
              {turmaToArchive?.code && (
                <span className="text-slate-500"> ({turmaToArchive.code})</span>
              )}
              ? Os planos e demais registros associados serão preservados.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleArchiveCancel}
              disabled={isArchiving}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchiveConfirm}
              disabled={isArchiving}
            >
              {isArchiving ? "Arquivando..." : "Arquivar Turma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
