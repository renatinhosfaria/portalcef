import type { OperacaoProposta, PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";

export type StatusVersaoMapa = "EM_REVISAO" | "CONFIRMADO" | "ARQUIVADO";
export interface VersaoMapaResumo {
  id: string;
  version: number;
  status: StatusVersaoMapa;
  originalFileName: string | null;
  createdAt: string;
  confirmedAt: string | null;
  atual: boolean;
  lugares: number;
  sessoes: Array<{ id: string; startsAt: string }>;
  editavel: boolean;
}
export interface TravaMapa { tipo: string; mensagem: string | null }

export class ErroApiMapa extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

/** Lê a resposta da API; aceita rotas com envelope `success` e rotas antigas sem ele. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function respostaApi<T = any>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const erro = new ErroApiMapa(body.error?.message ?? body.error?.code ?? "Falha na operação do mapa");
    erro.code = body.error?.code;
    erro.details = body.error?.details;
    throw erro;
  }
  return (body.data ?? body) as T;
}

export const baseEvento = (eventoId: string) => `/eventos-admin/api/eventos/admin/${eventoId}`;
export const urlOriginal = (eventoId: string, mapId: string) => `${baseEvento(eventoId)}/mapas/${mapId}/original`;

const JSON_HEADERS = { "content-type": "application/json" };

export async function listarMapas(eventoId: string): Promise<{ versoes: VersaoMapaResumo[]; trava: TravaMapa }> {
  return respostaApi(await fetch(`${baseEvento(eventoId)}/mapas`));
}

export async function editarVersao(eventoId: string, mapId: string): Promise<{ mapId: string }> {
  return respostaApi(await fetch(`${baseEvento(eventoId)}/mapas/${mapId}/editar`, { method: "POST", headers: JSON_HEADERS }));
}

export async function excluirVersao(eventoId: string, mapId: string): Promise<{ excluida: true; sessionIds: string[] }> {
  return respostaApi(await fetch(`${baseEvento(eventoId)}/mapas/${mapId}`, { method: "DELETE" }));
}

export async function importarPlanta(eventoId: string, arquivo: File, pagina?: number): Promise<{ mapId: string }> {
  const formulario = new FormData();
  formulario.append("file", arquivo);
  const consulta = pagina === undefined ? "" : `?pagina=${pagina}`;
  return respostaApi(await fetch(`${baseEvento(eventoId)}/mapas/import${consulta}`, { method: "POST", body: formulario }));
}

export async function carregarRevisao(eventoId: string, mapId: string): Promise<{ map: { id: string; status: string }; proposta: PropostaMapa | null }> {
  return respostaApi(await fetch(`${baseEvento(eventoId)}/mapas/${mapId}/revisao`));
}

export async function enviarOperacoes(eventoId: string, mapId: string, revisaoBase: number, operacoes: OperacaoProposta[]): Promise<PropostaMapa> {
  return respostaApi(
    await fetch(`${baseEvento(eventoId)}/mapas/${mapId}/proposta`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ revisaoBase, operacoes }),
    }),
  );
}

export async function publicarMapa(eventoId: string, mapId: string, revisaoBase: number, motivo?: string): Promise<{ sessionIds: string[]; capacidade: number | null; arquivadas: string[] }> {
  return respostaApi(
    await fetch(`${baseEvento(eventoId)}/mapas/${mapId}/publicar`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ revisaoBase, motivo }),
    }),
  );
}
