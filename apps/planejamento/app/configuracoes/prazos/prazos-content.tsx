"use client";

/**
 * PrazosContent Component
 * Client component para configuracao de prazos de entrega
 * Task 4.7: Permite que a Coordenadora Geral defina prazos para cada período
 */

import { formatarData, formatarDataCurta } from "@essencia/shared/formatar-data";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Input } from "@essencia/ui/components/input";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { cn } from "@essencia/ui/lib/utils";
import {
  Calendar,
  Check,
  Clock,
  Loader2,
  Save,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { usePeriodos } from "../../../features/periodos/hooks/use-periodos";
import { obterMensagemErro } from "../../../lib/mensagens-erro";

/**
 * Interface para estado de edicao de um prazo
 */
interface PrazoEditState {
  quinzenaId: string;
  deadline: string;
  isSaving: boolean;
  success: boolean;
  error: string | null;
}


/**
 * Formata data ISO para input date
 */
function formatarParaInput(dataIso: string): string {
  return extrairDataIso(dataIso);
}

/**
 * Extrai data do datetime-local para ISO date
 */
function extrairDataIso(datetimeLocal: string): string {
  return datetimeLocal.split("T")[0] || datetimeLocal;
}

export function PrazosContent() {
  const {
    periodos,
    isLoading: isLoadingPeriodos,
    error: periodosError,
    editarPeriodo,
    refetch,
  } = usePeriodos();
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(() => {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth >= 7 ? 2 : 1;
  });

  // Estado para controlar edicao de prazos
  const [editStates, setEditStates] = useState<Record<string, PrazoEditState>>(
    {},
  );

  interface PeriodoFiltrado {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    deadline: string;
  }
  const periodosFiltrados = useMemo<PeriodoFiltrado[]>(() => {
    return periodos
      .filter((periodo) => {
        const dataInicio = extrairDataIso(periodo.dataInicio);
        const mes = new Date(`${dataInicio}T00:00:00`).getMonth() + 1;
        return selectedSemester === 1 ? mes <= 6 : mes >= 7;
      })
      .map((periodo) => ({
        id: periodo.id,
        label: `${periodo.numero}o Plano de Aula - ${periodo.etapa}`,
        startDate: periodo.dataInicio,
        endDate: periodo.dataFim,
        deadline: periodo.dataMaximaEntrega,
      }));
  }, [periodos, selectedSemester]);

  /**
   * Inicia edicao de um prazo
   */
  const iniciarEdicao = useCallback(
    (periodoId: string, deadlineAtual: string) => {
      setEditStates((prev) => ({
        ...prev,
        [periodoId]: {
          quinzenaId: periodoId,
          deadline: formatarParaInput(deadlineAtual),
          isSaving: false,
          success: false,
          error: null,
        },
      }));
    },
    [],
  );

  /**
   * Atualiza valor do prazo em edicao
   */
  const atualizarEdicao = useCallback(
    (periodoId: string, novoValor: string) => {
      setEditStates((prev) => ({
        ...prev,
        [periodoId]: {
          ...prev[periodoId]!,
          deadline: novoValor,
          success: false,
          error: null,
        },
      }));
    },
    [],
  );

  /**
   * Cancela edicao de um prazo
   */
  const cancelarEdicao = useCallback((periodoId: string) => {
    setEditStates((prev) => {
      const newState = { ...prev };
      delete newState[periodoId];
      return newState;
    });
  }, []);

  /**
   * Salva o prazo editado
   */
  const salvarPrazo = useCallback(
    async (periodoId: string) => {
      const editState = editStates[periodoId];
      if (!editState) return;

      setEditStates((prev) => ({
        ...prev,
        [periodoId]: { ...prev[periodoId]!, isSaving: true, error: null },
      }));

      try {
        await editarPeriodo(periodoId, {
          dataMaximaEntrega: extrairDataIso(editState.deadline),
        });
        await refetch();

        setEditStates((prev) => ({
          ...prev,
          [periodoId]: {
            ...prev[periodoId]!,
            isSaving: false,
            success: true,
          },
        }));

        // Remover estado de edicao apos 2 segundos
        setTimeout(() => {
          cancelarEdicao(periodoId);
        }, 2000);
      } catch (err) {
        const mensagem = obterMensagemErro(
          err,
          "Não foi possível salvar o prazo. Tente novamente.",
        );
        setEditStates((prev) => ({
          ...prev,
          [periodoId]: {
            ...prev[periodoId]!,
            isSaving: false,
            error: mensagem,
          },
        }));
      }
    },
    [editStates, editarPeriodo, refetch, cancelarEdicao],
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarClock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Configuracao de Prazos
            </h1>
            <p className="text-muted-foreground">
              Defina os prazos de entrega para cada periodo
            </p>
          </div>
        </div>
      </div>

      {/* Tabs de Semestre */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setSelectedSemester(1)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              selectedSemester === 1
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            1o Semestre
          </button>
          <button
            onClick={() => setSelectedSemester(2)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              selectedSemester === 2
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            2o Semestre
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedSemester === 1
            ? "Fevereiro a Junho"
            : "Agosto a Dezembro"}
        </p>
      </div>

      {/* Erro ao carregar prazos */}
      {periodosError && (
        <Card className="border-destructive mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">
                  Erro ao carregar prazos configurados
                </p>
                <p className="text-sm">{periodosError.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoadingPeriodos && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lista de períodos */}
      {!isLoadingPeriodos && periodosFiltrados.length === 0 && (
        <Card className="border-yellow-400 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Nenhum periodo configurado</p>
                <p className="text-sm">
                  Cadastre periodos em Gestao de Planos de Aula para editar os
                  prazos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {!isLoadingPeriodos && periodosFiltrados.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {periodosFiltrados.map((periodo) => {
            const prazoAtual = periodo.deadline;
            const editState = editStates[periodo.id];
            const isEditing = !!editState;

            return (
              <Card key={periodo.id} className="relative">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{periodo.label}</span>
                    {editState?.success && (
                      <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Salvo
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Periodo */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatarDataCurta(periodo.startDate)} a{" "}
                      {formatarDataCurta(periodo.endDate)}
                    </span>
                  </div>

                  {/* Prazo Atual / Edicao */}
                  {!isEditing ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <span className="text-sm font-medium">Prazo: </span>
                          <span className="text-sm">
                            {formatarData(extrairDataIso(prazoAtual))}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => iniciarEdicao(periodo.id, prazoAtual)}
                      >
                        Editar Prazo
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor={`prazo-${periodo.id}`}
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Novo prazo de entrega:
                        </label>
                        <Input
                          id={`prazo-${periodo.id}`}
                          type="date"
                          value={editState.deadline}
                          onChange={(e) =>
                            atualizarEdicao(periodo.id, e.target.value)
                          }
                          disabled={editState.isSaving}
                          className="mt-1"
                        />
                      </div>

                      {/* Erro ao salvar */}
                      {editState.error && (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <span>{editState.error}</span>
                        </div>
                      )}

                      {/* Botoes de acao */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => cancelarEdicao(periodo.id)}
                          disabled={editState.isSaving}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => salvarPrazo(periodo.id)}
                          disabled={editState.isSaving || !editState.deadline}
                        >
                          {editState.isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info sobre prazos padrao */}
      <Card className="mt-8 bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Sobre os prazos padrao</h3>
              <p className="text-sm text-muted-foreground">
                Por padrao, o prazo de entrega e definido no cadastro de cada
                periodo. Voce pode personalizar esse prazo individualmente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
