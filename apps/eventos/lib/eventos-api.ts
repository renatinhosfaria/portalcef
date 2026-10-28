import type { CheckoutPublicoInput, FinalizarPedidoInput, ReservaPublicaInput } from "@essencia/shared/schemas";
import type {
  ConsultaPedidoPublica,
  PedidoPublicoResult,
  PoliticaPublica,
  PublicEventCard,
  PublicEventDetail,
  PublicEventSession,
  PublicMap,
  ReservaPublicaResult,
} from "@essencia/shared/types";

export type ReservaAssentosInput = Omit<ReservaPublicaInput, "idempotencyKey"> & Partial<Pick<ReservaPublicaInput, "idempotencyKey">>;
export type FinalizarPedidoPublicoInput = Omit<FinalizarPedidoInput, "idempotencyKey"> & Partial<Pick<FinalizarPedidoInput, "idempotencyKey">>;
export type CheckoutPublicoInputApp = Omit<CheckoutPublicoInput, "idempotencyKey"> & Partial<Pick<CheckoutPublicoInput, "idempotencyKey">>;

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

const json = <T,>(path: string) => buscarApiPublica(path).then((response) => response.json() as Promise<T>);

export const listarEventosPublicos = () => json<PublicEventCard[]>("/eventos/public");
export const obterEventoPublico = (slug: string) => json<PublicEventDetail>(`/eventos/public/${encodeURIComponent(slug)}`);
export const listarSessoesPublicas = (slug: string) => json<PublicEventSession[]>(`/eventos/public/${encodeURIComponent(slug)}/sessoes`);
export const listarPoliticasPublicas = (slug: string) => json<PoliticaPublica[]>(`/eventos/public/${encodeURIComponent(slug)}/politicas`);
export const obterMapaSessao = (sessionId: string) => json<PublicMap>(`/eventos/public/sessoes/${encodeURIComponent(sessionId)}/map`);

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
  const body = { ...input, idempotencyKey };
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

export async function finalizarPedido(orderNumber: string, input: FinalizarPedidoPublicoInput): Promise<PedidoPublicoResult> {
  const idempotencyKey = chavePersistida(input.idempotencyKey, "finalizacao", orderNumber);
  const result = await enviarJson<PedidoPublicoResult>(`/eventos/public/pedidos/${encodeURIComponent(orderNumber)}/finalizar`, { ...input, idempotencyKey }, idempotencyKey);
  publicOrderState.orderNumber = result.orderNumber;
  return result;
}

export async function iniciarCheckout(orderNumber: string, input: CheckoutPublicoInputApp): Promise<{ checkoutUrl: string }> {
  const idempotencyKey = chavePersistida(input.idempotencyKey, "checkout", orderNumber);
  const result = await enviarJson<{ checkoutUrl: string; expiresAt?: string | Date; orderNumber?: string }>(`/eventos/public/pedidos/${encodeURIComponent(orderNumber)}/checkout`, { ...input, idempotencyKey }, idempotencyKey);
  if (!result.checkoutUrl || !/^https:\/\//i.test(result.checkoutUrl)) throw new EventosApiError("A API não retornou uma URL de checkout válida.", 502, "CHECKOUT_URL_INVALID");
  publicOrderState.orderNumber = result.orderNumber || orderNumber;
  return { checkoutUrl: result.checkoutUrl };
}

export async function consultarPedido(orderNumber: string): Promise<ConsultaPedidoPublica> {
  const normalized = orderNumber.trim();
  if (!normalized) throw new EventosApiError("Informe o número do pedido.", 400, "ORDER_NUMBER_REQUIRED");
  return json<ConsultaPedidoPublica>(`/eventos/public/pedidos/${encodeURIComponent(normalized)}`);
}

export function origemPublicaEventos() {
  const configured = process.env.NEXT_PUBLIC_EVENTOS_PUBLIC_URL || "https://eventos.portalcef.com.br";
  return (typeof window !== "undefined" && window.location.origin.includes("eventos.portalcef.com.br") ? window.location.origin : configured).replace(/\/$/, "");
}
