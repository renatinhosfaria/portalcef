import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{
    quinzenaId: string;
  }>;
}

/**
 * Redirect para a nova pagina de plano de aula
 * A rota antiga /planejamentos/[quinzenaId] agora redireciona para /plano-aula/[quinzenaId]
 */
export default async function RedirectPage({ params }: PageProps) {
  const { quinzenaId } = await params;
  redirect(`/plano-aula/${quinzenaId}`);
}
