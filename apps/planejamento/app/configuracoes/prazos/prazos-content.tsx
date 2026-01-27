"use client";

/**
 * PrazosContent Component
 * Client component para configuracao de prazos de entrega
 * Task 4.7: Permite que a Coordenadora Geral defina prazos para cada quinzena
 *
 * TODO: Refatorar para usar períodos dinâmicos da API /plano-aula-periodo
 */

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
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDeadlines } from "../../../features/plano-aula";

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
 * Formata data ISO para exibicao no formato brasileiro
 */
function formatarData(dataIso: string): string {
  const data = new Date(dataIso + "T12:00:00");
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formata data ISO para exibicao curta (DD/MM)
 */
function formatarDataCurta(dataIso: string): string {
  const data = new Date(dataIso + "T12:00:00");
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Formata datetime ISO para input datetime-local
 */
function formatarParaInput(dataIso: string): string {
  // Se ja tem hora, retornar como esta
  if (dataIso.includes("T")) {
    return dataIso.slice(0, 16); // YYYY-MM-DDTHH:mm
  }
  // Caso contrario, adicionar hora 23:59
  return `${dataIso}T23:59`;
}

/**
 * Extrai data do datetime-local para ISO date
 */
function extrairDataIso(datetimeLocal: string): string {
  return datetimeLocal.split("T")[0] || datetimeLocal;
}

export function PrazosContent() {
  const {
    deadlines,
    loading: isLoadingDeadlines,
    error: deadlinesError,
    fetchDeadlines,
    setDeadline,
  } = useDeadlines();
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(() => {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth >= 7 ? 2 : 1;
  });

  // Estado para controlar edicao de prazos
  const [editStates, setEditStates] = useState<Record<string, PrazoEditState>>(
    {},
  );

  // Carregar prazos ao montar
  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  // Mapa de deadlines configurados por quinzenaId
  const deadlinesMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of deadlines) {
      map[d.quinzenaId] = d.deadline;
    }
    return map;
  }, [deadlines]);

  // TODO: Buscar períodos via API /plano-aula-periodo filtrados por semestre
  const quinzenasFiltradas = useMemo(() => {
    return []; // Vazio até implementar novo sistema
  }, [selectedSemester]);

  /**
   * Inicia edicao de um prazo
   */
  const iniciarEdicao = useCallback(
    (quinzenaId: string, deadlineAtual: string) => {
      setEditStates((prev) => ({
        ...prev,
        [quinzenaId]: {
          quinzenaId,
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
    (quinzenaId: string, novoValor: string) => {
      setEditStates((prev) => ({
        ...prev,
        [quinzenaId]: {
          ...prev[quinzenaId]!,
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
  const cancelarEdicao = useCallback((quinzenaId: string) => {
    setEditStates((prev) => {
      const newState = { ...prev };
      delete newState[quinzenaId];
      return newState;
    });
  }, []);

  /**
   * Salva o prazo editado
   */
  const salvarPrazo = useCallback(
    async (quinzenaId: string) => {
      const editState = editStates[quinzenaId];
      if (!editState) return;

      setEditStates((prev) => ({
        ...prev,
        [quinzenaId]: { ...prev[quinzenaId]!, isSaving: true, error: null },
      }));

      try {
        // Converter datetime-local para ISO string
        const deadlineIso = new Date(editState.deadline).toISOString();
        await setDeadline(quinzenaId, deadlineIso);

        setEditStates((prev) => ({
          ...prev,
          [quinzenaId]: {
            ...prev[quinzenaId]!,
            isSaving: false,
            success: true,
          },
        }));

        // Remover estado de edicao apos 2 segundos
        setTimeout(() => {
          cancelarEdicao(quinzenaId);
        }, 2000);
      } catch (err) {
        const mensagem =
          err instanceof Error ? err.message : "Erro ao salvar prazo";
        setEditStates((prev) => ({
          ...prev,
          [quinzenaId]: {
            ...prev[quinzenaId]!,
            isSaving: false,
            error: mensagem,
          },
        }));
      }
    },
    [editStates, setDeadline, cancelarEdicao],
  );

  /**
   * Obtem o prazo atual para uma quinzena (configurado ou padrao)
   */
  const obterPrazoAtual = useCallback(
    (quinzenaId: string, deadlinePadrao: string): string => {
      return deadlinesMap[quinzenaId] || deadlinePadrao;
    },
    [deadlinesMap],
  );

  /**
   * Verifica se um prazo foi personalizado
   */
  const isPrazoPersonalizado = useCallback(
    (quinzenaId: string): boolean => {
      return !!deadlinesMap[quinzenaId];
    },
    [deadlinesMap],
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
              Defina os prazos de entrega para cada quinzena
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
            ? "Fevereiro a Junho - 11 quinzenas"
            : "Agosto a Dezembro - 10 quinzenas"}
        </p>
      </div>

      {/* Erro ao carregar prazos */}
      {deadlinesError && (
        <Card className="border-destructive mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">
                  Erro ao carregar prazos configurados
                </p>
                <p className="text-sm">{deadlinesError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoadingDeadlines && (
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

      {/* Lista de Quinzenas */}
      {!isLoadingDeadlines && quinzenasFiltradas.length === 0 && (
        <Card className="border-yellow-400 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">
                  Sistema de períodos em migração
                </p>
                <p className="text-sm">
                  A configuração de prazos será implementada com o novo sistema de períodos dinâmicos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {!isLoadingDeadlines && quinzenasFiltradas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quinzenasFiltradas.map((quinzena) => {
            const prazoAtual = obterPrazoAtual(quinzena.id, quinzena.deadline);
            const isPersonalizado = isPrazoPersonalizado(quinzena.id);
            const editState = editStates[quinzena.id];
            const isEditing = !!editState;

            return (
              <Card key={quinzena.id} className="relative">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{quinzena.label}</span>
                    {isPersonalizado && !isEditing && (
                      <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-1 rounded">
                        Personalizado
                      </span>
                    )}
                    {editState?.success && (
                      <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Salvo
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Periodo da Quinzena */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatarDataCurta(quinzena.startDate)} a{" "}
                      {formatarDataCurta(quinzena.endDate)}
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
                        onClick={() => iniciarEdicao(quinzena.id, prazoAtual)}
                      >
                        Editar Prazo
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Novo prazo de entrega:
                        </label>
                        <Input
                          type="datetime-local"
                          value={editState.deadline}
                          onChange={(e) =>
                            atualizarEdicao(quinzena.id, e.target.value)
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
                          onClick={() => cancelarEdicao(quinzena.id)}
                          disabled={editState.isSaving}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => salvarPrazo(quinzena.id)}
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
                Por padrao, o prazo de entrega de cada quinzena e 5 dias uteis
                antes do inicio do periodo. Voce pode personalizar esse prazo
                para cada quinzena individualmente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
