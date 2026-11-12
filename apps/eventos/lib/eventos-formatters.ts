import type { PublicEventCard, PublicEventSession, PublicEventTicketType } from "@essencia/shared/types";
import { FUSO_HORARIO, dataValida, hora, partesNoFuso } from "@essencia/shared/eventos/datas";

export { formatarDataHoraExtenso } from "@essencia/shared/eventos/datas";

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

export function formatarDataCurta(inicio: Date | string): string {
  const data = dataValida(inicio);
  if (!data) return "Data a confirmar";
  const partes = partesNoFuso(data);
  return `${DIAS_CURTOS[partes.weekday]}, ${partes.day} ${MESES_CURTOS[partes.month - 1]} · ${hora(data)}`;
}

export function formatarMoeda(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\u00a0/g, " ");
}

export function rotuloCurto(seat: { rowLabel: string; seatNumber: string }): string {
  return `${seat.rowLabel}${seat.seatNumber}`;
}

export function formatarPrecoPublico(cents: number | null): string {
  if (cents == null) return "Consulte";
  return formatarMoeda(cents);
}

export function precoPrincipalPublico(tipos: Pick<PublicEventTicketType, "name" | "priceCents">[]): number | null {
  const padroes = tipos.filter((tipo) => !tipo.name.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes("meia"));
  const precos = (padroes.length ? padroes : tipos).map((tipo) => tipo.priceCents);
  return precos.length ? Math.min(...precos) : null;
}

export function formatarDataPublica(value: Date | string | null, options: Intl.DateTimeFormatOptions = {}): string {
  if (value == null) return "Data a confirmar";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", ...options, timeZone: FUSO_HORARIO }).format(date);
}

export function rotuloDisponibilidade(value: PublicEventCard["availability"] | PublicEventSession["availability"]): string {
  return value === "available" ? "Disponível" : value === "sold_out" ? "Esgotado" : "Indisponível";
}
