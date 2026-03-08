"use client";

import { api } from "@essencia/shared/fetchers/client";
import {
  Card,
  CardContent,
} from "@essencia/ui/components/card";
import { LayoutDashboard, Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export function TurmasContent() {
  const router = useRouter();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [turmasData, stagesData] = await Promise.all([
          api.get<Turma[]>("/plannings/turmas"),
          api.get<Stage[]>("/stages"),
        ]);

        const turmasList = Array.isArray(turmasData) ? turmasData : [];
        const stagesList = Array.isArray(stagesData) ? stagesData : [];

        // Se só tem 1 turma, redireciona direto
        if (turmasList.length === 1) {
          router.replace(`/planejamentos?turmaId=${turmasList[0]!.id}`);
          return;
        }

        // Se não tem turma, redireciona para planejamentos (mostra empty state)
        if (turmasList.length === 0) {
          router.replace("/planejamentos");
          return;
        }

        setTurmas(turmasList);
        setStages(stagesList);
      } catch (err) {
        console.error("Erro ao buscar turmas:", err);
        setError(err instanceof Error ? err.message : "Erro ao buscar turmas");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [router]);

  function getStageName(stageId: string): string {
    const stage = stages.find((s) => s.id === stageId);
    return stage?.name || "";
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando turmas...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Minhas Turmas</h1>
        </div>
        <p className="text-muted-foreground">
          Selecione uma turma para gerenciar seus planos de aula.
        </p>
      </div>

      {/* Grid de Turmas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {turmas.map((turma) => (
          <Card
            key={turma.id}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => router.push(`/planejamentos?turmaId=${turma.id}`)}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{turma.name}</h2>
                {getStageName(turma.stageId) && (
                  <p className="text-sm text-muted-foreground">
                    {getStageName(turma.stageId)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
