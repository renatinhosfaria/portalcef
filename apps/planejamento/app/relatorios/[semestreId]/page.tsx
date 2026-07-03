import { RelatorioContent } from "./relatorio-content";

interface Props {
  params: Promise<{ semestreId: string }>;
  searchParams: Promise<{ turmaId?: string }>;
}

export default async function RelatorioPage({ params, searchParams }: Props) {
  const { semestreId } = await params;
  const { turmaId } = await searchParams;
  return <RelatorioContent semestreId={semestreId} turmaId={turmaId ?? null} />;
}
