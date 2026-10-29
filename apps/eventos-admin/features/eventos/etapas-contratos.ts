export const TIPOS_POLITICA = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"] as const;

export function slugSugerido(title: string) {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type InformacoesValue = { title: string; slug: string; summary?: string; description: string; imageUrl?: string; category?: string; contactEmail: string; contactPhone?: string; cancellationPolicy: string };
export function construirPayloadInformacoes(value: InformacoesValue) {
  return { title: value.title, slug: value.slug, summary: value.summary?.trim() || null, description: value.description, imageUrl: value.imageUrl?.trim() || null, category: value.category?.trim() || null, contactEmail: value.contactEmail, contactPhone: value.contactPhone?.trim() || null, cancellationPolicy: value.cancellationPolicy };
}

export type SessaoValue = { id?: string; startsAt: string; endsAt: string; capacity: number; salesStartsAt: string; salesEndsAt: string; inheritLocation: boolean; inheritMap: boolean; locationId?: string | null; mapId?: string | null };
export function construirPayloadSessao(value: SessaoValue) {
  return { startsAt: value.startsAt, endsAt: value.endsAt, capacity: Number(value.capacity), salesStartsAt: value.salesStartsAt || null, salesEndsAt: value.salesEndsAt || null, locationId: value.inheritLocation ? null : (value.locationId || null), mapId: value.inheritMap ? null : (value.mapId || null) };
}

export function mesclarSessaoSalva(local: SessaoValue, saved: { id?: string }) { return { ...local, ...(saved.id ? { id: saved.id } : {}) }; }
export function persistirSessaoSalva(items: SessaoValue[], index: number, saved: { id?: string }) { return items.map((item, itemIndex) => itemIndex === index ? mesclarSessaoSalva(item, saved) : item); }

export function assertRespostaApi(response: { ok: boolean; status: number; body: unknown }) {
  const body = response.body as { success?: boolean; error?: { code?: string; message?: string } };
  if (!response.ok || body.success === false) { const error = Object.assign(new Error(body.error?.message ?? "Falha ao salvar"), { status: response.status === 200 && body.error?.code === "VERSION_CONFLICT" ? 409 : response.status, code: body.error?.code }); throw error; }
  return body;
}

export type IngressoValue = { id?: string; name: string; priceCents: number; description?: string; eligibility?: string | null; salesLot?: string | null; rules?: Record<string, unknown> | null; maxPerOrder?: number | null };
export function ingressosProntosParaSalvar(values: IngressoValue[]) {
  return values.length > 0 && values.every((value) => value.name.trim().length > 0 && Number.isInteger(value.priceCents) && value.priceCents >= 0 && (value.maxPerOrder == null || (Number.isInteger(value.maxPerOrder) && value.maxPerOrder > 0)));
}
export function construirPayloadIngresso(value: IngressoValue) { return { name: value.name.trim(), priceCents: Math.round(Number(value.priceCents)), ...(value.description ? { description: value.description } : {}), ...(value.eligibility ? { eligibility: value.eligibility } : {}), ...(value.salesLot ? { salesLot: value.salesLot } : {}), ...(value.rules ? { rules: value.rules } : {}), ...(value.maxPerOrder ? { maxPerOrder: value.maxPerOrder } : {}) }; }

export type PoliticaValue = { type: string; content: string; version?: number };
export function construirPayloadPoliticas(values: PoliticaValue[]) {
  const byType = new Map(values.map((value) => [value.type, { type: value.type, content: value.content.trim(), ...(value.version ? { version: value.version } : {}) }]));
  if (TIPOS_POLITICA.some((type) => !byType.get(type))) throw new Error("Ative as cinco políticas obrigatórias");
  return TIPOS_POLITICA.map((type) => byType.get(type)!);
}
