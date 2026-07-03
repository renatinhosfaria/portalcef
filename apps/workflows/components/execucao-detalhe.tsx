"use client";

import type {
  WorkflowEtapa,
  WorkflowEtapaProgresso,
  WorkflowExecucaoDetalhe as WorkflowExecucaoDetalheTipo,
  WorkflowExecucaoStatus,
  WorkflowHistoricoItem,
} from "@essencia/shared/types/workflows";
import { Badge } from "@essencia/ui/components/badge";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Checkbox } from "@essencia/ui/components/checkbox";
import { Progress } from "@essencia/ui/components/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import { Textarea } from "@essencia/ui/components/textarea";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  History,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AnexosExecucao } from "./anexos-execucao";
import { CancelarExecucaoDialog } from "./cancelar-execucao-dialog";

const STATUS_LABEL: Record<WorkflowExecucaoStatus, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const AVISO_MODELO_ATUALIZADO =
  "Este workflow foi atualizado pela gestao. Revise as etapas pendentes.";

interface ExecucaoDetalheProps {
  execucao: WorkflowExecucaoDetalheTipo;
  isGestao: boolean;
  carregando?: boolean;
  onAtualizarEtapa: (
    execucaoId: string,
    etapaId: string,
    body: { concluida?: boolean; observacao?: string | null },
  ) => void | Promise<void>;
  onConcluir: (execucaoId: string) => void | Promise<void>;
  onCancelar: (execucaoId: string, motivo: string) => void | Promise<void>;
  onReabrir: (execucaoId: string, motivo: string) => void | Promise<void>;
  onEnviarAnexo?: (formData: FormData) => void | Promise<void>;
  onRemoverAnexo?: (anexoId: string) => void | Promise<void>;
}

function progressoPorEtapa(progresso: WorkflowEtapaProgresso[]) {
  return new Map(progresso.map((item) => [item.etapaId, item]));
}

function obterProgresso(
  mapaProgresso: Map<string, WorkflowEtapaProgresso>,
  etapa: WorkflowEtapa,
) {
  return (
    mapaProgresso.get(etapa.id) ?? {
      etapaId: etapa.id,
      concluida: false,
      observacao: null,
      concluidaPor: null,
      concluidaAt: null,
      etapaVersao: etapa.versao,
    }
  );
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function ordenarHistorico(historico: WorkflowHistoricoItem[]) {
  return [...historico].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function ExecucaoDetalhe({
  execucao,
  isGestao,
  carregando = false,
  onAtualizarEtapa,
  onConcluir,
  onCancelar,
  onReabrir,
  onEnviarAnexo,
  onRemoverAnexo,
}: ExecucaoDetalheProps) {
  const [dialogCancelamentoAberto, setDialogCancelamentoAberto] =
    useState(false);
  const [dialogReaberturaAberto, setDialogReaberturaAberto] = useState(false);
  const [erroInteracao, setErroInteracao] = useState<string | null>(null);
  const mapaProgresso = useMemo(
    () => progressoPorEtapa(execucao.progresso),
    [execucao.progresso],
  );
  const historicoOrdenado = useMemo(
    () => ordenarHistorico(execucao.historico),
    [execucao.historico],
  );

  const totalEtapas = execucao.modelo.fases.reduce(
    (total, fase) => total + fase.etapas.length,
    0,
  );
  const etapasConcluidas = execucao.progresso.filter(
    (item) => item.concluida,
  ).length;
  const possuiEtapaPendente = etapasConcluidas < totalEtapas;
  const podeEditarChecklist = execucao.status === "EM_ANDAMENTO";
  const progresso = Math.max(0, Math.min(100, execucao.progressoPercentual));

  async function executarInteracao(acao: () => void | Promise<void>) {
    try {
      setErroInteracao(null);
      await acao();
    } catch (error) {
      setErroInteracao(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a alteração.",
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  execucao.status === "CANCELADA" ? "outline" : "secondary"
                }
              >
                {STATUS_LABEL[execucao.status]}
              </Badge>
              <span className="text-sm text-slate-500">
                Modelo: {execucao.modelo.nome}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-950">
              {execucao.titulo}
            </h1>
            <p className="text-sm text-slate-600">
              Fase atual: {execucao.faseAtual ?? "Sem fase ativa"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {execucao.status === "EM_ANDAMENTO" ? (
              <>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={carregando || possuiEtapaPendente}
                  onClick={() =>
                    void executarInteracao(() => onConcluir(execucao.id))
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Concluir workflow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={carregando}
                  onClick={() => setDialogCancelamentoAberto(true)}
                >
                  <Ban className="h-4 w-4" />
                  Cancelar
                </Button>
              </>
            ) : null}

            {isGestao && execucao.status === "CONCLUIDA" ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={carregando}
                onClick={() => setDialogReaberturaAberto(true)}
              >
                <RotateCcw className="h-4 w-4" />
                Reabrir
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {etapasConcluidas} de {totalEtapas} etapas concluídas
            </span>
            <span>{progresso}%</span>
          </div>
          <Progress value={progresso} />
        </div>
      </div>

      {execucao.modeloAtualizado ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{AVISO_MODELO_ATUALIZADO}</span>
        </div>
      ) : null}

      {erroInteracao ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erroInteracao}
        </div>
      ) : null}

      <Tabs defaultValue="orientacoes" className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="orientacoes">Orientacoes</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
          <TabsTrigger value="historico">Historico</TabsTrigger>
        </TabsList>

        <TabsContent value="orientacoes" className="pt-4">
          {execucao.modelo.orientacoes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Nenhuma orientação cadastrada.
            </div>
          ) : (
            <div className="grid gap-3">
              {execucao.modelo.orientacoes.map((orientacao) => (
                <Card key={orientacao.id} className="rounded-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-slate-950">
                      {orientacao.titulo}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {orientacao.conteudo}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="checklist" className="pt-4">
          <div className="grid gap-4">
            {execucao.modelo.fases.map((fase) => (
              <Card key={fase.id} className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-950">
                    {fase.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fase.etapas.map((etapa) => {
                    const progressoEtapa = obterProgresso(mapaProgresso, etapa);

                    return (
                      <div
                        key={etapa.id}
                        className="space-y-3 rounded-lg border border-slate-200 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`etapa-${etapa.id}`}
                            checked={progressoEtapa.concluida}
                            disabled={!podeEditarChecklist || carregando}
                            onCheckedChange={() =>
                              void executarInteracao(() =>
                                onAtualizarEtapa(execucao.id, etapa.id, {
                                  concluida: !progressoEtapa.concluida,
                                }),
                              )
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <label
                              htmlFor={`etapa-${etapa.id}`}
                              className="font-medium text-slate-900"
                            >
                              {etapa.titulo}
                            </label>
                            {etapa.instrucao ? (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                {etapa.instrucao}
                              </p>
                            ) : null}
                            {progressoEtapa.concluidaAt ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Concluída em{" "}
                                {formatarData(progressoEtapa.concluidaAt)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2 pl-7">
                          <label
                            htmlFor={`observacao-${etapa.id}`}
                            className="text-sm font-medium text-slate-700"
                          >
                            Observação
                          </label>
                          <Textarea
                            id={`observacao-${etapa.id}`}
                            defaultValue={progressoEtapa.observacao ?? ""}
                            placeholder="Registre uma observação sobre esta etapa."
                            disabled={!podeEditarChecklist || carregando}
                            onBlur={(event) => {
                              const observacaoNormalizada =
                                event.currentTarget.value.trim();
                              const observacaoAtual =
                                progressoEtapa.observacao ?? "";

                              if (observacaoNormalizada === observacaoAtual) {
                                return;
                              }

                              void executarInteracao(() =>
                                onAtualizarEtapa(execucao.id, etapa.id, {
                                  observacao: observacaoNormalizada || null,
                                }),
                              );
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="anexos" className="pt-4">
          <AnexosExecucao
            anexos={execucao.anexos}
            carregando={carregando}
            onEnviar={async (formData) => {
              if (!onEnviarAnexo) return;
              await onEnviarAnexo(formData);
            }}
            onRemover={async (anexoId) => {
              if (!onRemoverAnexo) return;
              await onRemoverAnexo(anexoId);
            }}
          />
        </TabsContent>

        <TabsContent value="historico" className="pt-4">
          {historicoOrdenado.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Nenhum evento registrado.
            </div>
          ) : (
            <div className="grid gap-3">
              {historicoOrdenado.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-semibold text-slate-900">
                          {item.tipo}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">
                        {item.descricao}
                      </p>
                      {item.motivo ? (
                        <p className="text-sm text-slate-600">
                          Motivo: {item.motivo}
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        Autor: {item.autorNome ?? "usuário não identificado"}
                      </p>
                    </div>
                    <time className="text-xs text-slate-500">
                      {formatarData(item.createdAt)}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CancelarExecucaoDialog
        open={dialogCancelamentoAberto}
        titulo="Cancelar execução"
        descricao="Informe o motivo para cancelar este workflow."
        rotuloConfirmacao="Cancelar execução"
        carregando={carregando}
        onOpenChange={setDialogCancelamentoAberto}
        onConfirmar={async (motivo) => {
          await onCancelar(execucao.id, motivo);
          setDialogCancelamentoAberto(false);
        }}
      />

      <CancelarExecucaoDialog
        open={dialogReaberturaAberto}
        titulo="Reabrir execução"
        descricao="Informe o motivo para reabrir este workflow."
        rotuloConfirmacao="Reabrir execução"
        carregando={carregando}
        onOpenChange={setDialogReaberturaAberto}
        onConfirmar={async (motivo) => {
          await onReabrir(execucao.id, motivo);
          setDialogReaberturaAberto(false);
        }}
      />
    </div>
  );
}
