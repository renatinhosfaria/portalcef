"use client";

import type { WorkflowCategoria } from "@essencia/shared/types/workflows";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@essencia/ui/components/alert-dialog";
import { Badge } from "@essencia/ui/components/badge";
import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { Input } from "@essencia/ui/components/input";
import { Check, Pencil, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { atualizarCategoria, criarCategoria } from "@/lib/api";

interface GerenciarCategoriasDialogProps {
  open: boolean;
  categorias: WorkflowCategoria[];
  onOpenChange: (open: boolean) => void;
  onCategoriasChange: (categorias: WorkflowCategoria[]) => void;
}

function ordenarCategorias(categorias: WorkflowCategoria[]) {
  return [...categorias].sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function GerenciarCategoriasDialog({
  open,
  categorias,
  onOpenChange,
  onCategoriasChange,
}: GerenciarCategoriasDialogProps) {
  const [categoriasLocais, setCategoriasLocais] = useState(() =>
    ordenarCategorias(categorias),
  );
  const [novaCategoria, setNovaCategoria] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [mutacaoId, setMutacaoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [categoriaParaInativar, setCategoriaParaInativar] =
    useState<WorkflowCategoria | null>(null);

  useEffect(() => {
    setCategoriasLocais(ordenarCategorias(categorias));
  }, [categorias]);

  useEffect(() => {
    if (!open) {
      setNovaCategoria("");
      setEditandoId(null);
      setNomeEdicao("");
      setErro(null);
      setCategoriaParaInativar(null);
    }
  }, [open]);

  function publicarCategorias(proximas: WorkflowCategoria[]) {
    const ordenadas = ordenarCategorias(proximas);
    setCategoriasLocais(ordenadas);
    onCategoriasChange(ordenadas);
  }

  function substituirCategoria(categoriaAtualizada: WorkflowCategoria) {
    publicarCategorias(
      categoriasLocais.map((categoria) =>
        categoria.id === categoriaAtualizada.id
          ? categoriaAtualizada
          : categoria,
      ),
    );
  }

  async function adicionarCategoria(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nome = novaCategoria.trim();

    if (nome.length < 2) {
      setErro("Informe uma categoria com pelo menos 2 letras.");
      return;
    }

    try {
      setErro(null);
      setMutacaoId("nova");
      const criada = await criarCategoria({ nome });
      publicarCategorias([...categoriasLocais, criada]);
      setNovaCategoria("");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a categoria.",
      );
    } finally {
      setMutacaoId(null);
    }
  }

  async function salvarNome(categoria: WorkflowCategoria) {
    const nome = nomeEdicao.trim();
    if (nome.length < 2) {
      setErro("Informe uma categoria com pelo menos 2 letras.");
      return;
    }

    try {
      setErro(null);
      setMutacaoId(categoria.id);
      const atualizada = await atualizarCategoria(categoria.id, { nome });
      substituirCategoria(atualizada);
      setEditandoId(null);
      setNomeEdicao("");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível renomear a categoria.",
      );
    } finally {
      setMutacaoId(null);
    }
  }

  async function alternarStatus(categoria: WorkflowCategoria) {
    try {
      setErro(null);
      setMutacaoId(categoria.id);
      const atualizada = await atualizarCategoria(categoria.id, {
        ativo: !categoria.ativo,
      });
      substituirCategoria(atualizada);
      setCategoriaParaInativar(null);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a categoria.",
      );
    } finally {
      setMutacaoId(null);
    }
  }

  const mutacaoEmAndamento = mutacaoId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar categorias</DialogTitle>
          <DialogDescription>
            Crie, renomeie ou altere a disponibilidade das categorias da
            unidade.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={adicionarCategoria}
        >
          <div className="space-y-2">
            <label
              htmlFor="nova-categoria-gestao"
              className="text-sm font-medium text-slate-700"
            >
              Nova categoria
            </label>
            <Input
              id="nova-categoria-gestao"
              value={novaCategoria}
              disabled={mutacaoEmAndamento}
              onChange={(event) => setNovaCategoria(event.target.value)}
              placeholder="Ex.: Financeiro"
            />
          </div>
          <Button
            type="submit"
            className="gap-2 sm:self-end"
            disabled={mutacaoEmAndamento}
          >
            <Plus className="h-4 w-4" />
            Adicionar categoria
          </Button>
        </form>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {categoriasLocais.map((categoria) => (
            <div
              key={categoria.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {editandoId === categoria.id ? (
                <div className="flex min-w-0 flex-1 gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor={`categoria-nome-${categoria.id}`}
                      className="sr-only"
                    >
                      Nome da categoria {categoria.nome}
                    </label>
                    <Input
                      id={`categoria-nome-${categoria.id}`}
                      value={nomeEdicao}
                      disabled={mutacaoEmAndamento}
                      onChange={(event) => setNomeEdicao(event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    aria-label={`Salvar nome de ${categoria.nome}`}
                    disabled={mutacaoEmAndamento}
                    onClick={() => void salvarNome(categoria)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={`Cancelar edição de ${categoria.nome}`}
                    disabled={mutacaoEmAndamento}
                    onClick={() => {
                      setEditandoId(null);
                      setNomeEdicao("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-slate-900">
                    {categoria.nome}
                  </span>
                  <Badge variant={categoria.ativo ? "secondary" : "outline"}>
                    {categoria.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              )}

              {editandoId !== categoria.id ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    aria-label={`Renomear ${categoria.nome}`}
                    disabled={mutacaoEmAndamento}
                    onClick={() => {
                      setEditandoId(categoria.id);
                      setNomeEdicao(categoria.nome);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Renomear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`${categoria.ativo ? "Inativar" : "Ativar"} ${categoria.nome}`}
                    disabled={mutacaoEmAndamento}
                    onClick={() => {
                      if (categoria.ativo) {
                        setCategoriaParaInativar(categoria);
                        return;
                      }
                      void alternarStatus(categoria);
                    }}
                  >
                    {categoria.ativo ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {erro ? (
          <p className="text-sm text-red-600" role="alert">
            {erro}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutacaoEmAndamento}
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={categoriaParaInativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !mutacaoEmAndamento) {
            setCategoriaParaInativar(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Inativar categoria {categoriaParaInativar?.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A categoria deixará de estar disponível para novos modelos. Os
              modelos que já a utilizam continuarão acessíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutacaoEmAndamento}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutacaoEmAndamento}
              onClick={() => {
                if (categoriaParaInativar) {
                  void alternarStatus(categoriaParaInativar);
                }
              }}
            >
              Confirmar inativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
