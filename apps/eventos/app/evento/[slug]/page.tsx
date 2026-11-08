import { notFound } from "next/navigation";
import { DetalheEvento } from "../../../components/detalhe-evento";
import { EventosApiError } from "../../../lib/eventos-api";
import { listarPoliticasPublicasServidor, listarSessoesPublicasServidor, obterEventoPublicoServidor } from "../../../lib/eventos-api-servidor";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const [event, sessions, politicas] = await Promise.all([
      obterEventoPublicoServidor(slug),
      listarSessoesPublicasServidor(slug),
      listarPoliticasPublicasServidor(slug),
    ]);
    return <DetalheEvento event={event} sessions={sessions} politicas={politicas} />;
  } catch (error) {
    if (error instanceof EventosApiError && error.status === 404) notFound();
    throw error;
  }
}
