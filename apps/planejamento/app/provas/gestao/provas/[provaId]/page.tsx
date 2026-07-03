import type { Metadata } from "next";

import { ProvaGestaoContent } from "./prova-gestao-content";

export const metadata: Metadata = {
  title: "Prova | Gestão",
  description: "Detalhe da prova para impressão e acompanhamento pela gestão",
};

interface PageProps {
  params: Promise<{
    provaId: string;
  }>;
}

export default async function ProvaGestaoPage({ params }: PageProps) {
  const { provaId } = await params;

  return <ProvaGestaoContent provaId={provaId} />;
}
