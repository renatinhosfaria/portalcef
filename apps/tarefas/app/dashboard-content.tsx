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
import {
  TarefasFiltros,
  type FiltrosAtivos,
} from "@/features/tarefas-list/components/tarefas-filtros";
import { TarefasPaginacao } from "@/features/tarefas-list/components/tarefas-paginacao";
import { useTarefas } from "@/features/tarefas-list/hooks/use-tarefas";

type TipoFiltro = "atribuidas" | "criadas" | "todas";

export function DashboardContent() {
  const [tipo, setTipo] = useState<TipoFiltro>("todas");
  const [filtros, setFiltros] = useState<FiltrosAtivos>({});
  const [page, setPage] = useState(1);

  const { tarefas, stats, paginacao, isLoading, concluir } = useTarefas({
    tipo,
    page,
    limit: 20,
    ...filtros,
  });

  const handleFiltrosChange = (novosFiltros: FiltrosAtivos) => {
    setFiltros(novosFiltros);
    setPage(1);
  };

  const handleTipoChange = (novoTipo: TipoFiltro) => {
    setTipo(novoTipo);
    setPage(1);
  };

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
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={tipo === "todas" ? "default" : "outline"}
            size="sm"
            onClick={() => handleTipoChange("todas")}
          >
            Todas
          </Button>
          <Button
            variant={tipo === "atribuidas" ? "default" : "outline"}
            size="sm"
            onClick={() => handleTipoChange("atribuidas")}
          >
            Minhas Tarefas
          </Button>
          <Button
            variant={tipo === "criadas" ? "default" : "outline"}
            size="sm"
            onClick={() => handleTipoChange("criadas")}
          >
            Criadas por Mim
          </Button>
          <div className="ml-auto">
            <TarefasFiltros filtros={filtros} onChange={handleFiltrosChange} />
          </div>
        </div>
      </div>

      {/* Grid de Tarefas */}
      <TarefasGrid tarefas={tarefas} onConcluir={concluir} />

      {/* Paginação */}
      {paginacao && (
        <TarefasPaginacao
          paginaAtual={paginacao.page}
          totalPaginas={paginacao.totalPages}
          total={paginacao.total}
          limit={paginacao.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
