"use client";

/**
 * DocumentoComentarios Component
 * Lista de comentarios em um documento (feedback da analista/coordenadora)
 * Task 3.2: Criar componentes de upload e lista de documentos
 */

import { useState } from "react";

import { Button } from "@essencia/ui/components/button";
import { Textarea } from "@essencia/ui/components/textarea";
import { cn } from "@essencia/ui/lib/utils";
import {
  CheckCircle2,
  Circle,
  Edit2,
  MessageSquare,
  Save,
  Trash2,
  X,
} from "lucide-react";

import type { DocumentoComentario } from "../types";

interface DocumentoComentariosProps {
  comentarios: DocumentoComentario[];
  currentUserId?: string;
  onEdit?: (comentarioId: string, novoTexto: string) => Promise<void>;
  onDelete?: (comentarioId: string) => Promise<void>;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentoComentarios({
  comentarios,
  currentUserId,
  onEdit,
  onDelete,
}: DocumentoComentariosProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  if (comentarios.length === 0) {
    return null;
  }

  const unresolvedCount = comentarios.filter((c) => !c.resolved).length;

  const handleStartEdit = (comentario: DocumentoComentario) => {
    setEditingId(comentario.id);
    setEditText(comentario.comentario);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = async (comentarioId: string) => {
    if (!onEdit || !editText.trim()) return;
    try {
      setSavingId(comentarioId);
      await onEdit(comentarioId, editText.trim());
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error("Erro ao editar comentário:", error);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (comentarioId: string) => {
    if (!onDelete) return;
    if (!confirm("Tem certeza que deseja excluir este comentário?")) return;
    try {
      setDeletingId(comentarioId);
      await onDelete(comentarioId);
    } catch (error) {
      console.error("Erro ao deletar comentário:", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          {comentarios.length} comentario{comentarios.length !== 1 && "s"}
        </span>
        {unresolvedCount > 0 && (
          <span className="text-yellow-600">
            ({unresolvedCount} pendente{unresolvedCount !== 1 && "s"})
          </span>
        )}
      </div>

      {/* Comments List */}
      <div className="space-y-2">
        {comentarios.map((comentario) => {
          const isEditing = editingId === comentario.id;
          const isAuthor = currentUserId === comentario.autorId;
          const isDeleting = deletingId === comentario.id;
          const isSaving = savingId === comentario.id;

          return (
            <div
              key={comentario.id}
              className={cn(
                "rounded-lg border p-3 text-sm",
                comentario.resolved
                  ? "border-green-200 bg-green-50/50"
                  : "border-yellow-300 bg-yellow-50",
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {/* Status Icon */}
                  {comentario.resolved ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  )}

                  {/* Author Name */}
                  <span className="font-medium">{comentario.autorName}</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Date */}
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comentario.createdAt)}
                  </span>

                  {/* Edit/Delete Buttons - Only for author */}
                  {isAuthor && !isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleStartEdit(comentario)}
                        disabled={isDeleting}
                        title="Editar comentário"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(comentario.id)}
                        disabled={isDeleting}
                        title="Excluir comentário"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Comment Text or Edit Mode */}
              {isEditing ? (
                <div className="space-y-2 pl-6">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[80px] text-sm"
                    placeholder="Digite seu comentário..."
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(comentario.id)}
                      disabled={!editText.trim() || isSaving}
                      className="h-7"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {isSaving ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="h-7"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <p
                  className={cn(
                    "pl-6",
                    comentario.resolved
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  {comentario.comentario}
                </p>
              )}

              {/* Status Badge */}
              {!isEditing && (
                <div className="mt-2 pl-6">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      comentario.resolved
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700",
                    )}
                  >
                    {comentario.resolved ? "Resolvido" : "Pendente"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
