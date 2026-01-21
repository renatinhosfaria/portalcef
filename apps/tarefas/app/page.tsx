import { DashboardContent } from "./dashboard-content";

export default function TarefasPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe suas tarefas
          </p>
        </div>
        <DashboardContent />
      </div>
    </div>
  );
}
