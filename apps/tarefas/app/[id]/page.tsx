import { TarefaDetalheContent } from "./tarefa-detalhe-content";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TarefaDetalhePage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <TarefaDetalheContent id={id} />
    </div>
  );
}
