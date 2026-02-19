"use client";

import { Button } from "@essencia/ui/components/button";
import { Plus } from "lucide-react";
import { useState } from "react";

import { DashboardContent } from "./dashboard-content";
import { TarefaForm } from "./tarefa-form";

export function TarefasPageContent() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      <div className="container mx-auto py-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Tarefas</h1>
              <p className="text-muted-foreground">
                Gerencie e acompanhe suas tarefas
              </p>
            </div>
            <Button
              onClick={() => setIsFormOpen(true)}
              className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold rounded-xl shadow-lg shadow-[#A3D154]/20 gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Criar Tarefa
            </Button>
          </div>
          <DashboardContent />
        </div>
      </div>

      <TarefaForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </>
  );
}
