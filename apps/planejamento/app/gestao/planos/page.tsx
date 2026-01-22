import type { Metadata } from "next";

import { PlanosContent } from "./planos-content";

export const metadata: Metadata = {
  title: "Planos de Aula | Gestão",
  description: "Listagem de planos de aula com filtros e paginação",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    quinzena?: string;
    segmento?: string;
    professora?: string;
    page?: string;
  }>;
}

export default async function PlanosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <PlanosContent
      initialStatus={params.status || "todos"}
      initialQuinzena={params.quinzena}
      initialSegmento={params.segmento}
      initialProfessora={params.professora}
      initialPage={params.page ? parseInt(params.page, 10) : 1}
    />
  );
}
