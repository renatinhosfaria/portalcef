import { CriarTarefaForm } from "./criar-form";

export default function CriarTarefaPage() {
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Criar Tarefa</h1>
          <p className="text-muted-foreground">
            Crie uma nova tarefa e atribua para um responsável
          </p>
        </div>
        <CriarTarefaForm />
      </div>
    </div>
  );
}
