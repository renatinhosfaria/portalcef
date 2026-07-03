"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import { Plus } from "lucide-react";

export default function WorkflowsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
          <p className="text-sm text-slate-600">
            Protocolos internos, execucoes, checklist e historico da unidade.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo workflow
        </Button>
      </div>

      <Tabs defaultValue="biblioteca" className="w-full">
        <TabsList>
          <TabsTrigger value="biblioteca">Workflows</TabsTrigger>
          <TabsTrigger value="andamento">Em andamento</TabsTrigger>
          <TabsTrigger value="concluidos">Concluidos</TabsTrigger>
        </TabsList>
        <TabsContent value="biblioteca" className="pt-4">
          Nenhum workflow encontrado.
        </TabsContent>
        <TabsContent value="andamento" className="pt-4">
          Nenhuma execucao em andamento.
        </TabsContent>
        <TabsContent value="concluidos" className="pt-4">
          Nenhuma execucao concluida.
        </TabsContent>
      </Tabs>
    </div>
  );
}
