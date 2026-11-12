import type { ConvidadosPorAluna } from "@essencia/shared/types";

function base(eventId: string): string { return `/eventos-admin/api/eventos/admin/${eventId}/alunas`; }

async function resposta<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || (body && typeof body === "object" && "success" in body && body.success === false)) {
    const mensagem = body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error ? String(body.error.message) : "Não foi possível atualizar as alunas convidadas.";
    throw new Error(mensagem);
  }
  return body && typeof body === "object" && "data" in body ? (body as { data: T }).data : body as T;
}

export async function listarAlunas(eventId: string): Promise<ConvidadosPorAluna> {
  return resposta<ConvidadosPorAluna>(await fetch(base(eventId), { credentials: "include" }));
}

export async function juntarAlunas(eventId: string, input: { destino: string; origens: string[] }): Promise<ConvidadosPorAluna> {
  return resposta<ConvidadosPorAluna>(await fetch(`${base(eventId)}/juntar`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export async function separarAluna(eventId: string, chave: string): Promise<ConvidadosPorAluna> {
  return resposta<ConvidadosPorAluna>(await fetch(`${base(eventId)}/separar`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ chave }) }));
}
