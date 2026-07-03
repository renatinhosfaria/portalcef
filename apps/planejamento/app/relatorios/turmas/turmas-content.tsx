"use client";

import { api } from "@essencia/shared/fetchers/client";
import { Badge } from "@essencia/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { CalendarDays, LayoutDashboard, Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { SemestreRelatorio } from "../../../features/relatorio";
import { obterMensagemErro } from "../../../lib/mensagens-erro";

interface Turma {
  id: string;
  name: string;
  code: string;
  stageId: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface TurmaRelatorio {
  turma: Turma;
  etapa: Stage;
  semestres: SemestreRelatorio[];
}

const ETAPAS_RELATORIO = new Set(["BERCARIO", "INFANTIL"]);

export function TurmasRelatorioContent() {
  const router = useRouter();
  const [itens, setItens] = useState<TurmaRelatorio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      try {
        setIsLoading(true);
        setError(null);

        const [turmasData, stagesData] = await Promise.all([
          api.get<Turma[]>("/plannings/turmas"),
          api.get<Stage[]>("/stages"),
        ]);

        const stages = Array.isArray(stagesData) ? stagesData : [];
        const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
        const turmas = (Array.isArray(turmasData) ? turmasData : []).filter(
          (turma) => {
            const etapa = stageMap.get(turma.stageId);
            return etapa ? ETAPAS_RELATORIO.has(etapa.code) : false;
          },
        );

        const turmasComSemestres = await Promise.all(
          turmas.map(async (turma) => {
            const etapa = stageMap.get(turma.stageId);
            const semestres = await api
              .get<SemestreRelatorio[]>(`/semestre-relatorio/turma/${turma.id}`)
              .catch(() => []);

            return etapa
              ? {
                  turma,
                  etapa,
                  semestres: Array.isArray(semestres) ? semestres : [],
                }
              : null;
          }),
        );

        const filtradas = turmasComSemestres.filter(
          (item): item is TurmaRelatorio => item !== null,
        );

        if (!ativo) return;

        if (filtradas.length === 1 && filtradas[0]!.semestres.length === 1) {
          const unico = filtradas[0]!;
          router.replace(
            `/relatorios/${unico.semestres[0]!.id}?turmaId=${unico.turma.id}`,
          );
          return;
        }

        setItens(filtradas);
      } catch (err) {
        if (!ativo) return;
        setError(
          obterMensagemErro(
            err,
            "Não foi possível carregar as turmas de relatórios. Tente novamente.",
          ),
        );
      } finally {
        if (ativo) setIsLoading(false);
      }
    }

    void carregarDados();

    return () => {
      ativo = false;
    };
  }, [router]);

  const totalSemestres = useMemo(
    () => itens.reduce((total, item) => total + item.semestres.length, 0),
    [itens],
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Carregando turmas...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Relatórios Semestrais
            </h1>
            <p className="text-muted-foreground">
              Selecione uma turma e um semestre para enviar o relatório.
            </p>
          </div>
        </div>
      </div>

      {itens.length === 0 || totalSemestres === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/60" />
            <h2 className="mb-2 text-lg font-semibold">
              Nenhum semestre disponível
            </h2>
            <p className="max-w-md text-muted-foreground">
              Não há semestres de relatório configurados para suas turmas de
              Berçário ou Infantil.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {itens.map(({ turma, etapa, semestres }) => (
            <Card key={turma.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="rounded-lg bg-primary/10 p-2">
                      <Users className="h-5 w-5 text-primary" />
                    </span>
                    <span>
                      <span className="block">{turma.name}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {turma.code}
                      </span>
                    </span>
                  </span>
                  <Badge variant="secondary">{etapa.name}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {semestres.map((semestre) => (
                    <button
                      key={semestre.id}
                      type="button"
                      className="rounded-md border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                      onClick={() =>
                        router.push(
                          `/relatorios/${semestre.id}?turmaId=${turma.id}`,
                        )
                      }
                    >
                      <span className="block text-sm font-medium">
                        Semestre {semestre.semestre}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {semestre.descricao || "Relatório semestral"}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
