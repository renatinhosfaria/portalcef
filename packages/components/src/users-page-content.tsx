"use client";

import { Ban } from "lucide-react";
import { useState } from "react";

import type { UserSummary } from "@essencia/lib/types";
import { useTenant } from "@essencia/shared/providers/tenant";
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
import { DashboardStats } from "./dashboard-stats";
import { UserForm } from "./user-form";
import { UserList } from "./user-list";

interface UsersPageContentProps {
  users: UserSummary[];
}

const ALLOWED_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
];

export function UsersPageContent({ users }: UsersPageContentProps) {
  const { role, isLoaded } = useTenant();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserSummary | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isLoaded) {
    return null; // Or a loading spinner, but TenantProvider handles that mostly
  }

  // Access Control: Strict check
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <Ban className="w-8 h-8 text-red-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Acesso Negado</h2>
          <p className="text-slate-500 max-w-md">
            Você não tem permissão para acessar o módulo de gestão de usuários.
            Entre em contato com o administrador se acredita que isso é um erro.
          </p>
        </div>
      </div>
    );
  }

  const handleCreateClick = () => {
    setUserToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (user: UserSummary) => {
    setUserToEdit(user);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setUserToEdit(null);
  };

  const handleDeleteClick = (user: UserSummary) => {
    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir usuário");
      }

      toast.success("Usuário excluído", {
        description: `${userToDelete.name} foi removido do sistema.`,
      });

      // Recarregar a página para atualizar a lista
      window.location.reload();
    } catch (error) {
      toast.error("Erro ao excluir", {
        description: "Não foi possível excluir o usuário. Tente novamente.",
      });
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  const cancelDelete = () => {
    setUserToDelete(null);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Gestão de Usuários
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl text-balance">
          Gerencie o acesso, permissões e hierarquia do sistema administrativo.
        </p>
      </div>

      <DashboardStats />

      {/* Pass real users to UserList */}
      <UserList
        users={users}
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <UserForm
        isOpen={isFormOpen}
        onClose={handleClose}
        userToEdit={userToEdit}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{userToDelete?.name}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
