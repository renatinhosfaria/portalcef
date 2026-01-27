import { Button } from "@essencia/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";

import { TarefaNotificacaoProvider } from "@/features/notificacoes/tarefa-notificacao-provider";

import { DashboardContent } from "./dashboard-content";

export default function TarefasPage() {
  return (
    <TarefaNotificacaoProvider>
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
              asChild
              className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold rounded-xl shadow-lg shadow-[#A3D154]/20 gap-2 w-full sm:w-auto"
            >
              <Link href="/criar">
                <Plus className="w-4 h-4" />
                Criar Tarefa
              </Link>
            </Button>
          </div>
          <DashboardContent />
        </div>
      </div>
    </TarefaNotificacaoProvider>
  );
}
