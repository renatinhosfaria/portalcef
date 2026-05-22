import { RelatorioContent } from "./relatorio-content";

interface Props {
  params: Promise<{ semanaId: string }>;
  searchParams: Promise<{ turmaId?: string }>;
}

export default async function RelatorioPage({ params, searchParams }: Props) {
  const { semanaId } = await params;
  const { turmaId } = await searchParams;
  return <RelatorioContent semanaId={semanaId} turmaId={turmaId ?? null} />;
}
