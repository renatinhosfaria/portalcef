"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useTenant } from "@essencia/shared/providers/tenant";
import type { Turma } from "@essencia/shared/types";
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

import { GerenciarProfessoraDialog } from "./gerenciar-professora-dialog";
import { TurmaForm } from "./turma-form";
import { TurmasList } from "./turmas-list";

interface TurmasPageContentProps {
  turmas: Turma[];
  isLoading: boolean;
  onRefresh: () => void;
}

const ALLOWED_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora", // Professors usually need to see classes
  "auxiliar_administrativo",
];

export function TurmasPageContent({ turmas, isLoading, onRefresh }: TurmasPageContentProps) {
  const { role, isLoaded } = useTenant();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [turmaToEdit, setTurmaToEdit] = useState<Turma | null>(null);
  const [isGerenciarProfessoraOpen, setIsGerenciarProfessoraOpen] = useState(false);
  const [turmaToManageProfessora, setTurmaToManageProfessora] = useState<Turma | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [turmaToDelete, setTurmaToDelete] = useState<Turma | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleEditClick = (turma: Turma) => {
    setTurmaToEdit(turma);
    setIsFormOpen(true);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setTurmaToEdit(null);
    // Refresh data when closing in case changes were made
    onRefresh();
  };

  const handleGerenciarProfessoraClick = (turma: Turma) => {
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

  const handleDeleteClick = (turma: Turma) => {
    setTurmaToDelete(turma);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!turmaToDelete) return;

    setIsDeleting(true);
    try {
      await api.delete(`/turmas/${turmaToDelete.id}`);
      toast.success("Turma excluída com sucesso");
      setIsDeleteDialogOpen(false);
      setTurmaToDelete(null);
      onRefresh();
    } catch {
      toast.error("Erro ao excluir turma. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setTurmaToDelete(null);
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
        onDeleteClick={handleDeleteClick}
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <DialogTitle>Excluir Turma</DialogTitle>
                <DialogDescription>
                  Esta ação não pode ser desfeita.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600">
              Tem certeza que deseja excluir permanentemente a turma{" "}
              <span className="font-semibold text-slate-900">
                {turmaToDelete?.name}
              </span>
              {turmaToDelete?.code && (
                <span className="text-slate-500"> ({turmaToDelete.code})</span>
              )}
              ? Todos os dados associados serão removidos.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir Turma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
