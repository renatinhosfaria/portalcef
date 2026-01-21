"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { useState } from "react";

import { TarefasGrid } from "@/features/tarefas-list/components/tarefas-grid";
import { useTarefas } from "@/features/tarefas-list/hooks/use-tarefas";

type TipoFiltro = "atribuidas" | "criadas" | "todas";

export function DashboardContent() {
  const [tipo, setTipo] = useState<TipoFiltro>("todas");

  const { tarefas, stats, isLoading, concluir } = useTarefas({
    status: "PENDENTE",
    tipo,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendentes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.atrasadas}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.concluidas}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Próximas a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.proximasVencer}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros Section */}
      <div className="flex items-center gap-2 border-b pb-4">
        <Button
          variant={tipo === "todas" ? "default" : "outline"}
          size="sm"
          onClick={() => setTipo("todas")}
        >
          Todas
        </Button>
        <Button
          variant={tipo === "atribuidas" ? "default" : "outline"}
          size="sm"
          onClick={() => setTipo("atribuidas")}
        >
          Minhas Tarefas
        </Button>
        <Button
          variant={tipo === "criadas" ? "default" : "outline"}
          size="sm"
          onClick={() => setTipo("criadas")}
        >
          Criadas por Mim
        </Button>
      </div>

      {/* Grid de Tarefas */}
      <TarefasGrid tarefas={tarefas} onConcluir={concluir} />
    </div>
  );
}
