/**
 * Pagina da Analista - Revisao de Prova
 */

import type { Metadata } from "next";

import { RevisaoProvaContent } from "./revisao-content";

interface PageProps {
  params: Promise<{
    provaId: string;
  }>;
}

export const metadata: Metadata = {
  title: "Revisao de Prova | Essência",
  description: "Pagina de revisao e analise de prova.",
};

export default async function RevisaoProvaPage({ params }: PageProps) {
  const { provaId } = await params;

  return <RevisaoProvaContent provaId={provaId} />;
}
