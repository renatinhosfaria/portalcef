import { TarefaNotificacaoProvider } from "@/features/notificacoes/tarefa-notificacao-provider";

import { TarefasPageContent } from "./tarefas-page-content";

export default function TarefasPage() {
  return (
    <TarefaNotificacaoProvider>
      <TarefasPageContent />
    </TarefaNotificacaoProvider>
  );
}
