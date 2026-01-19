/**
 * Pagina da Analista - Revisao de Plano de Aula
 * Task 4.3: Criar pagina onde a analista revisa e aprova/devolve um plano
 */

import type { Metadata } from "next";

import { RevisaoContent } from "./revisao-content";

interface PageProps {
  params: Promise<{
    planoId: string;
  }>;
}

export const metadata: Metadata = {
  title: "Revisao de Plano de Aula | Essencia",
  description: "Pagina de revisao e analise de plano de aula.",
};

export default async function RevisaoPlanoPage({ params }: PageProps) {
  const { planoId } = await params;

  return <RevisaoContent planoId={planoId} />;
}
