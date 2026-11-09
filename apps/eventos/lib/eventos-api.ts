import type { FinalizarPedidoInput, MeusIngressosInput, PagamentoEmbutidoInput, ReservaPublicaInput } from "@essencia/shared/schemas";
import type {
  ConsultaPedidoPublica,
  FinalizacaoPublicaResult,
  MeusIngressosResult,
  PagamentoEmbutidoResult,
  PedidoComIngressos,
  PoliticaPublica,
  PublicEventCard,
  PublicEventDetail,
  PublicEventSession,
  PublicMap,
  ReservaPublicaResult,
} from "@essencia/shared/types";

export type ReservaAssentosInput = Omit<ReservaPublicaInput, "idempotencyKey"> & Partial<Pick<ReservaPublicaInput, "idempotencyKey">>;
export type FinalizarPedidoPublicoInput = Omit<FinalizarPedidoInput, "idempotencyKey"> & Partial<Pick<FinalizarPedidoInput, "idempotencyKey">>;
export type PagamentoEmbutidoInputApp = Omit<PagamentoEmbutidoInput, "idempotencyKey"> & Partial<Pick<PagamentoEmbutidoInput, "idempotencyKey">>;

export class EventosApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  selection?: ReservaPublicaInput["seats"];

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "EventosApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const publicOrderState: { reservationId?: string; orderNumber?: string } = {};
const stableIdempotencyKeys = new Map<string, string>();

export function obterPedidoEmMemoria() {
  return { ...publicOrderState };
}

export function gerarChaveIdempotenciaPublica(prefixo: string) {
  const randomUuid = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefixo}-${randomUuid}`;
}

function chavePersistida(input: string | undefined, prefixo: string, identity: string) {
  if (input?.trim()) return input.trim();
  const key = `${prefixo}:${identity}`;
  const current = stableIdempotencyKeys.get(key);
  if (current) return current;
  const generated = gerarChaveIdempotenciaPublica(prefixo);
  stableIdempotencyKeys.set(key, generated);
  return generated;
}

function persistirPedidoNaUrl(result: { orderNumber: string; reservationId?: string }) {
  if (typeof window === "undefined" || !window.location?.href || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  url.searchParams.set("orderNumber", result.orderNumber);
  if (result.reservationId) url.searchParams.set("reservationId", result.reservationId);
  window.history.replaceState({}, "", url);
}

export async function buscarApiPublica(path: string, init: RequestInit = {}): Promise<Response> {
  const base = typeof window === "undefined" ? (process.env.API_INTERNAL_URL ?? "http://api:3001").replace(/\/$/, "") : "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${base}/api${normalized}`, {
    ...init,
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) {
    let details: { code?: string; message?: string } | undefined;
    try {
      details = (await response.clone().json()) as { code?: string; message?: string };
    } catch {
      details = undefined;
    }
    throw new EventosApiError(details?.message || `Falha ao consultar API pública (${response.status})`, response.status, details?.code, details);
  }
  return response;
}

const json = <T,>(path: string, init?: RequestInit) => buscarApiPublica(path, init).then((response) => response.json() as Promise<T>);

export const listarEventosPublicos = (init?: RequestInit) => json<PublicEventCard[]>("/eventos/public", init);
export const obterEventoPublico = (slug: string, init?: RequestInit) => json<PublicEventDetail>(`/eventos/public/${encodeURIComponent(slug)}`, init);
export const listarSessoesPublicas = (slug: string, init?: RequestInit) => json<PublicEventSession[]>(`/eventos/public/${encodeURIComponent(slug)}/sessoes`, init);
export const listarPoliticasPublicas = (slug: string, init?: RequestInit) => json<PoliticaPublica[]>(`/eventos/public/${encodeURIComponent(slug)}/politicas`, init);
export const obterMapaSessao = (sessionId: string, init?: RequestInit) => json<PublicMap>(`/eventos/public/sessoes/${encodeURIComponent(sessionId)}/map`, init);

async function enviarJson<T>(path: string, body: Record<string, unknown>, idempotencyKey: string): Promise<T> {
  const response = await buscarApiPublica(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

export async function reservarAssentos(input: ReservaAssentosInput): Promise<ReservaPublicaResult> {
  const idempotencyKey = input.idempotencyKey?.trim() || gerarChaveIdempotenciaPublica("reserva");
  const { buyer, ...inputSemBuyer } = input;
  const body = buyer === undefined ? { ...inputSemBuyer, idempotencyKey } : { ...inputSemBuyer, buyer, idempotencyKey };
  try {
    const result = await enviarJson<ReservaPublicaResult>("/eventos/public/reservas", body, idempotencyKey);
    publicOrderState.reservationId = result.reservationId;
    publicOrderState.orderNumber = result.orderNumber;
    persistirPedidoNaUrl(result);
    return result;
  } catch (error) {
    if (error instanceof EventosApiError && error.status === 409) {
      error.selection = input.seats;
      if (error.code === "SEAT_UNAVAILABLE") error.message = "Um dos assentos selecionados ficou indisponível. Escolha novamente.";
    }
    throw error;
  }
}

export async function finalizarPedido(orderNumber: string, input: FinalizarPedidoPublicoInput): Promise<FinalizacaoPublicaResult> {
  const idempotencyKey = chavePersistida(input.idempotencyKey, "finalizacao", orderNumber);
  const result = await enviarJson<FinalizacaoPublicaResult>(`/eventos/public/pedidos/${encodeURIComponent(orderNumber)}/finalizar`, { ...input, idempotencyKey }, idempotencyKey);
  publicOrderState.orderNumber = result.pedido.orderNumber;
  return result;
}

export async function iniciarPagamento(orderNumber: string, input: PagamentoEmbutidoInputApp): Promise<PagamentoEmbutidoResult> {
  const idempotencyKey = chavePersistida(input.idempotencyKey, "pagamento", orderNumber);
  const result = await enviarJson<PagamentoEmbutidoResult>(`/eventos/public/pedidos/${encodeURIComponent(orderNumber)}/checkout`, { ...input, idempotencyKey }, idempotencyKey);
  if (!result.clientSecret?.trim()) throw new EventosApiError("A API não retornou um clientSecret de pagamento válido.", 502, "CHECKOUT_CLIENT_SECRET_INVALID");
  publicOrderState.orderNumber = result.orderNumber || orderNumber;
  return result;
}

export async function liberarPedido(orderNumber: string): Promise<void> {
  await buscarApiPublica(`/eventos/public/pedidos/${encodeURIComponent(orderNumber)}/liberar`, { method: "POST" });
}

export async function obterIngressos(orderNumber: string, acesso: string, init?: RequestInit): Promise<PedidoComIngressos> {
  return json<PedidoComIngressos>(`/eventos/public/pedidos/${encodeURIComponent(orderNumber)}/ingressos?acesso=${encodeURIComponent(acesso)}`, init);
}

export async function buscarMeusIngressos(input: MeusIngressosInput): Promise<MeusIngressosResult> {
  const response = await buscarApiPublica("/eventos/public/meus-ingressos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await response.json()) as MeusIngressosResult;
}

export async function consultarPedido(orderNumber: string, init?: RequestInit): Promise<ConsultaPedidoPublica> {
  const normalized = orderNumber.trim();
  if (!normalized) throw new EventosApiError("Informe o número do pedido.", 400, "ORDER_NUMBER_REQUIRED");
  return json<ConsultaPedidoPublica>(`/eventos/public/pedidos/${encodeURIComponent(normalized)}`, init);
}

export function origemPublicaEventos() {
  const configured = process.env.NEXT_PUBLIC_EVENTOS_PUBLIC_URL || "https://eventos.portalcef.com.br";
  return (typeof window !== "undefined" && window.location.origin.includes("eventos.portalcef.com.br") ? window.location.origin : configured).replace(/\/$/, "");
}
