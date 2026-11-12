import { PainelAlunas } from "@/features/eventos/alunas/painel-alunas";

type Params = Promise<{ id: string }>;

export default async function AlunasPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PainelAlunas eventId={id} />;
}
