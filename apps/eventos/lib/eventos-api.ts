import type { PublicEventCard, PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";

export async function buscarApiPublica(path: string, init: RequestInit = {}): Promise<Response> {
  const base = typeof window === "undefined" ? (process.env.API_INTERNAL_URL ?? "http://api:3001") : "/api";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${base}${normalized}`, { ...init, cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error(`Falha ao consultar API pública (${response.status})`);
  return response;
}
const json = <T,>(path: string) => buscarApiPublica(path).then((response) => response.json() as Promise<T>);
export const listarEventosPublicos = () => json<PublicEventCard[]>("/eventos/public");
export const obterEventoPublico = (slug: string) => json<PublicEventDetail>(`/eventos/public/${encodeURIComponent(slug)}`);
export const listarSessoesPublicas = (slug: string) => json<PublicEventSession[]>(`/eventos/public/${encodeURIComponent(slug)}/sessoes`);
export const obterMapaSessao = (sessionId: string) => json<PublicMap>(`/eventos/public/sessoes/${encodeURIComponent(sessionId)}/map`);
