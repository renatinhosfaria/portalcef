import type { Metadata } from "next";

import { ProvasGestaoContent } from "./provas-content";

export const metadata: Metadata = {
  title: "Provas | Gestão",
  description: "Listagem de provas com filtros e paginação",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    ciclo?: string;
    segmento?: string;
    professora?: string;
    page?: string;
  }>;
}

export default async function ProvasGestaoPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <ProvasGestaoContent
      initialStatus={params.status || "todos"}
      initialCiclo={params.ciclo}
      initialSegmento={params.segmento}
      initialProfessora={params.professora}
      initialPage={params.page ? parseInt(params.page, 10) : 1}
    />
  );
}
