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
  const [pagina, setPagina] = useState(1);
  const selecionarTipo = (novoTipo: TipoFiltro) => {
    setTipo(novoTipo);
    setPagina(1);
  };

  const { tarefas, stats, pagination, isLoading, error, concluir } = useTarefas(
    {
      status: "PENDENTE",
      tipo,
      page: pagina,
    },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Não foi possível carregar as tarefas. Tente novamente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo das tarefas */}
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

      {/* Filtros */}
      <div className="flex items-center gap-2 border-b pb-4">
        <Button
          variant={tipo === "todas" ? "default" : "outline"}
          size="sm"
          onClick={() => selecionarTipo("todas")}
        >
          Todas
        </Button>
        <Button
          variant={tipo === "atribuidas" ? "default" : "outline"}
          size="sm"
          onClick={() => selecionarTipo("atribuidas")}
        >
          Minhas Tarefas
        </Button>
        <Button
          variant={tipo === "criadas" ? "default" : "outline"}
          size="sm"
          onClick={() => selecionarTipo("criadas")}
        >
          Criadas por Mim
        </Button>
      </div>

      {/* Grid de Tarefas */}
      <TarefasGrid tarefas={tarefas} onConcluir={concluir} />
      {pagination.totalPages > 1 && (
        <nav
          aria-label="Paginação de tarefas"
          className="flex items-center justify-between gap-4"
        >
          <Button
            variant="outline"
            disabled={pagina <= 1}
            onClick={() => setPagina((atual) => atual - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagina} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={pagina >= pagination.totalPages}
            onClick={() => setPagina((atual) => atual + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}
    </div>
  );
}
