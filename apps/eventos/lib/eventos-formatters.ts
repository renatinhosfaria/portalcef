import type { PublicEventCard, PublicEventSession } from "@essencia/shared/types";

export function formatarPrecoPublico(cents: number | null): string {
  if (cents == null) return "Consulte";
  return `A partir de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\u00a0/g, " ")}`;
}

export function formatarDataPublica(value: Date | string | null, options: Intl.DateTimeFormatOptions = {}): string {
  if (value == null) return "Data a confirmar";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", ...options, timeZone: "America/Sao_Paulo" }).format(date);
}

export function rotuloDisponibilidade(value: PublicEventCard["availability"] | PublicEventSession["availability"]): string {
  return value === "available" ? "Disponível" : value === "sold_out" ? "Esgotado" : "Indisponível";
}
