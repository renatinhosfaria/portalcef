import { RevisaoRelatorioContent } from "./revisao-content";

interface Props {
  params: Promise<{ relatorioId: string }>;
}

export default async function RevisaoRelatorioPage({ params }: Props) {
  const { relatorioId } = await params;
  return <RevisaoRelatorioContent relatorioId={relatorioId} />;
}
