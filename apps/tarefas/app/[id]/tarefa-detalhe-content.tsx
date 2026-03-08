"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { Textarea } from "@essencia/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PrazoIndicator } from "@/components/prazo-indicator";
import { PrioridadeBadge } from "@/components/prioridade-badge";
import { StatusBadge } from "@/components/status-badge";
import { TarefaHistoricoTimeline } from "@/features/tarefa-detalhe/components/tarefa-historico-timeline";
import { useCancelarTarefa } from "@/features/tarefa-detalhe/hooks/use-cancelar-tarefa";
import { useEditarTarefa } from "@/features/tarefa-detalhe/hooks/use-editar-tarefa";
import { useTarefa } from "@/features/tarefa-detalhe/hooks/use-tarefa";
import { apiPatch } from "@/lib/api";

interface Props {
  id: string;
}

export function TarefaDetalheContent({ id }: Props) {
  const router = useRouter();
  const session = useTenant();
  const { tarefa, isLoading, error, refetch } = useTarefa(id);
  const { editar, isLoading: editando } = useEditarTarefa(id);
  const { cancelar, isLoading: cancelando } = useCancelarTarefa(id);

  const [isEditing, setIsEditing] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"ALTA" | "MEDIA" | "BAIXA">(
    "MEDIA",
  );
  const [prazo, setPrazo] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const [dialogConcluir, setDialogConcluir] = useState(false);
  const [dialogCancelar, setDialogCancelar] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const podeEditar =
    tarefa &&
    tarefa.status === "PENDENTE" &&
    (session.userId === tarefa.criadoPor ||
      session.userId === tarefa.responsavel);

  const iniciarEdicao = () => {
    if (!tarefa) return;
    setTitulo(tarefa.titulo);
    setDescricao(tarefa.descricao ?? "");
    setPrioridade(tarefa.prioridade);
    setPrazo(tarefa.prazo.slice(0, 10));
    setResponsavel(tarefa.responsavel);
    setIsEditing(true);
    setActionError(null);
  };

  const salvarEdicao = async () => {
    setActionError(null);
    try {
      await editar({
        titulo,
        descricao: descricao || undefined,
        prioridade,
        prazo: new Date(prazo).toISOString(),
        responsavel,
      });
      setIsEditing(false);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao salvar tarefa",
      );
    }
  };

  const handleConcluir = async () => {
    setActionError(null);
    try {
      await apiPatch(`tarefas/${id}/concluir`);
      setDialogConcluir(false);
      await refetch();
    } catch (err) {
      setDialogConcluir(false);
      setActionError(
        err instanceof Error ? err.message : "Erro ao concluir tarefa",
      );
    }
  };

  const handleCancelar = async () => {
    setActionError(null);
    try {
      await cancelar();
      setDialogCancelar(false);
      await refetch();
    } catch (err) {
      setDialogCancelar(false);
      setActionError(
        err instanceof Error ? err.message : "Erro ao cancelar tarefa",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !tarefa) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          ← Voltar
        </Button>
        <p className="text-destructive">
          {error?.message ?? "Tarefa não encontrada"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        ← Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="space-y-3">
            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
            ) : (
              <CardTitle className="text-2xl">{tarefa.titulo}</CardTitle>
            )}
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={tarefa.status} />
              <PrioridadeBadge prioridade={tarefa.prioridade} />
              <PrazoIndicator prazo={tarefa.prazo} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Descrição */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Descrição
            </p>
            {isEditing ? (
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            ) : (
              <p className="text-sm">
                {tarefa.descricao ?? (
                  <span className="text-muted-foreground italic">
                    Sem descrição
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Prioridade, Prazo e Responsável em modo edição */}
          {isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={prioridade}
                    onValueChange={(v) =>
                      setPrioridade(v as "ALTA" | "MEDIA" | "BAIXA")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="MEDIA">Média</SelectItem>
                      <SelectItem value="BAIXA">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prazo">Prazo</Label>
                  <Input
                    id="prazo"
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável (ID do usuário)</Label>
                <Input
                  id="responsavel"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="UUID do responsável"
                />
              </div>
            </div>
          )}

          {/* Informações */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Informações
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Criado por: </span>
                <span className="font-medium">{tarefa.criadoPorNome}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Responsável: </span>
                <span className="font-medium">{tarefa.responsavelNome}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Criado em: </span>
                <span>
                  {new Date(tarefa.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Origem: </span>
                <span>
                  {tarefa.tipoOrigem === "MANUAL" ? "Manual" : "Automática"}
                </span>
              </div>
            </div>
          </div>

          {/* Contextos */}
          {tarefa.contextos.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Contextos
              </p>
              {tarefa.contextos.map((contexto) => (
                <div key={contexto.id} className="text-sm flex flex-wrap gap-2">
                  <span className="bg-muted px-2 py-0.5 rounded text-xs">
                    {contexto.modulo}
                  </span>
                  {contexto.turmaName && (
                    <span className="text-muted-foreground">
                      Turma:{" "}
                      <span className="text-foreground">
                        {contexto.turmaName}
                      </span>
                    </span>
                  )}
                  {contexto.etapaName && (
                    <span className="text-muted-foreground">
                      Etapa:{" "}
                      <span className="text-foreground">
                        {contexto.etapaName}
                      </span>
                    </span>
                  )}
                  {contexto.professoraName && (
                    <span className="text-muted-foreground">
                      Professora:{" "}
                      <span className="text-foreground">
                        {contexto.professoraName}
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feedback de erro */}
          {actionError && (
            <p className="text-sm text-destructive border border-destructive/30 bg-destructive/10 px-3 py-2 rounded">
              {actionError}
            </p>
          )}

          {/* Ações */}
          {podeEditar && (
            <div className="border-t pt-4">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button
                    onClick={salvarEdicao}
                    disabled={editando || !titulo.trim()}
                  >
                    {editando ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={editando}
                  >
                    Cancelar edição
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={iniciarEdicao}>
                    Editar
                  </Button>

                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setDialogConcluir(true)}
                  >
                    Concluir
                  </Button>

                  <Button
                    variant="destructive"
                    disabled={cancelando}
                    onClick={() => setDialogCancelar(true)}
                  >
                    Cancelar tarefa
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico Timeline */}
      <TarefaHistoricoTimeline tarefaId={tarefa.id} />

      {/* Dialog: Concluir */}
      <Dialog open={dialogConcluir} onOpenChange={setDialogConcluir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir tarefa?</DialogTitle>
            <DialogDescription>
              A tarefa será marcada como concluída. Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogConcluir(false)}>
              Voltar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConcluir}
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cancelar */}
      <Dialog open={dialogCancelar} onOpenChange={setDialogCancelar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar tarefa?</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar esta tarefa? Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCancelar(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancelar}>
              Cancelar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
