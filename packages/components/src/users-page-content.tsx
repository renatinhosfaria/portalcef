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
  incluirInativos: boolean;
}

const ALLOWED_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
];

export function UsersPageContent({ users, incluirInativos }: UsersPageContentProps) {
  const { role, isLoaded } = useTenant();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserSummary | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToInativar, setUserToInativar] = useState<UserSummary | null>(null);
  const [userToReativar, setUserToReativar] = useState<UserSummary | null>(null);
  const [vinculoError, setVinculoError] = useState<{
    user: UserSummary;
    turmas: Array<{ id: string; name: string; code: string }>;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
    } catch {
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

  const handleInativarClick = (user: UserSummary) => setUserToInativar(user);
  const handleReativarClick = (user: UserSummary) => setUserToReativar(user);

  const confirmInativar = async () => {
    if (!userToInativar) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/users/${userToInativar.id}/inativar`, {
        method: "PUT",
        credentials: "include",
      });

      if (response.status === 422) {
        const body = await response.json();
        const turmas = (body?.message?.turmas ?? body?.error?.turmas ?? []) as Array<{
          id: string;
          name: string;
          code: string;
        }>;
        setUserToInativar(null);
        setVinculoError({ user: userToInativar, turmas });
        return;
      }

      if (!response.ok) {
        throw new Error("Falha ao inativar usuário");
      }

      toast.success("Usuário inativado", {
        description: `${userToInativar.name} não conseguirá mais fazer login.`,
      });
      window.location.reload();
    } catch {
      toast.error("Erro ao inativar", {
        description: "Não foi possível inativar o usuário. Tente novamente.",
      });
    } finally {
      setIsProcessing(false);
      setUserToInativar(null);
    }
  };

  const confirmReativar = async () => {
    if (!userToReativar) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/users/${userToReativar.id}/reativar`, {
        method: "PUT",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Falha ao reativar usuário");
      }

      toast.success("Usuário reativado", {
        description: `${userToReativar.name} pode fazer login novamente.`,
      });
      window.location.reload();
    } catch {
      toast.error("Erro ao reativar", {
        description: "Não foi possível reativar o usuário. Tente novamente.",
      });
    } finally {
      setIsProcessing(false);
      setUserToReativar(null);
    }
  };

  const handleToggleInativos = (incluir: boolean) => {
    const url = new URL(window.location.href);
    if (incluir) {
      url.searchParams.set("inativos", "true");
    } else {
      url.searchParams.delete("inativos");
    }
    window.location.href = url.toString();
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
        onInativarClick={handleInativarClick}
        onReativarClick={handleReativarClick}
        incluirInativos={incluirInativos}
        onToggleInativos={handleToggleInativos}
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

      {/* Inativar Confirmation Dialog */}
      <Dialog open={!!userToInativar} onOpenChange={(open) => !open && setUserToInativar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Inativação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja inativar o usuário{" "}
              <strong>{userToInativar?.name}</strong>?
              <br />
              Sessões ativas serão encerradas imediatamente. O usuário não conseguirá
              mais fazer login até ser reativado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToInativar(null)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={confirmInativar}
              disabled={isProcessing}
            >
              {isProcessing ? "Inativando..." : "Inativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reativar Confirmation Dialog */}
      <Dialog open={!!userToReativar} onOpenChange={(open) => !open && setUserToReativar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Reativação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja reativar o usuário{" "}
              <strong>{userToReativar?.name}</strong>?
              <br />
              O usuário poderá fazer login novamente após esta ação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToReativar(null)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmReativar}
              disabled={isProcessing}
            >
              {isProcessing ? "Reativando..." : "Reativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vínculos Error Dialog (422 response) */}
      <Dialog open={!!vinculoError} onOpenChange={(open) => !open && setVinculoError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Não é possível inativar</DialogTitle>
            <DialogDescription>
              <strong>{vinculoError?.user.name}</strong> ainda é titular das turmas
              listadas abaixo. Atribua outra professora a essas turmas (ou remova
              a titularidade) antes de inativar.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc list-inside text-sm text-slate-700 my-4 space-y-1">
            {vinculoError?.turmas.map((t) => (
              <li key={t.id}>
                <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                  {t.code}
                </span>{" "}
                {t.name}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setVinculoError(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
