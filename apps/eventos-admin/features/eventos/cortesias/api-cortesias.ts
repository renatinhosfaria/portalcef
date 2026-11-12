import type { EmitirCortesiasInput } from "@essencia/shared/schemas";
import type { CortesiaResumo, ConflitoAssentoCortesia, MapaAdminSessao, PedidoComIngressos } from "@essencia/shared/types";
import { ErroApiMapa, respostaApi } from "../conferencia/api-mapas";

const JSON_HEADERS = { "content-type": "application/json" };

function baseEvento(eventId: string): string {
  return `/eventos-admin/api/eventos/admin/${eventId}`;
}

function credenciais(): RequestInit {
  return { credentials: "include" };
}

async function buscar<T>(url: string, init?: RequestInit): Promise<T> {
  return respostaApi<T>(await fetch(url, { ...credenciais(), ...init }));
}

export function listarCortesias(eventId: string): Promise<CortesiaResumo[]> {
  return buscar(`${baseEvento(eventId)}/cortesias`);
}

export function obterMapaAdmin(eventId: string, sessionId: string): Promise<MapaAdminSessao> {
  return buscar(`${baseEvento(eventId)}/sessoes/${encodeURIComponent(sessionId)}/mapa-admin`);
}

export function emitirCortesias(eventId: string, input: EmitirCortesiasInput): Promise<CortesiaResumo[]> {
  return buscar(`${baseEvento(eventId)}/cortesias`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
}

export function obterVoucher(eventId: string, orderId: string): Promise<PedidoComIngressos> {
  return buscar(`${baseEvento(eventId)}/cortesias/${encodeURIComponent(orderId)}/voucher`);
}

export function cancelarCortesia(eventId: string, orderId: string, motivo: string): Promise<CortesiaResumo> {
  return buscar(`${baseEvento(eventId)}/cortesias/${encodeURIComponent(orderId)}/cancelar`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ motivo }),
  });
}

export function conflitosDoErro(erro: unknown): ConflitoAssentoCortesia[] {
  if (!erro || typeof erro !== "object") return [];
  type EstruturaErro = { code?: unknown; details?: unknown; error?: unknown; response?: { data?: unknown } };
  const candidato = erro as EstruturaErro;
  const resposta = candidato.response?.data;
  const origem = resposta && typeof resposta === "object" ? (resposta as EstruturaErro) : candidato;
  const erroApi = origem.error && typeof origem.error === "object" ? (origem.error as EstruturaErro) : origem;
  if ((erroApi.code ?? origem.code) !== "ASSENTOS_INDISPONIVEIS") return [];
  const detalhes = erroApi.details ?? origem.details;
  if (!detalhes || typeof detalhes !== "object") return [];
  const conflitos = (detalhes as { conflitos?: unknown }).conflitos;
  return Array.isArray(conflitos) ? (conflitos as ConflitoAssentoCortesia[]) : [];
}

export { ErroApiMapa };
