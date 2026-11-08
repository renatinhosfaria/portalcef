import type { PublicEventCard, PublicEventSession } from "@essencia/shared/types";

const FUSO_HORARIO = "America/Sao_Paulo";
const DIAS_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

function dataValida(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partesNoFuso(value: Date): { weekday: number; day: number; month: number; year: number; hour: number; minute: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    weekday: "short", day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: false, timeZone: FUSO_HORARIO,
  }).formatToParts(value);
  const numero = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value ?? 0);
  const weekday = new Date(Date.UTC(numero("year"), numero("month") - 1, numero("day"))).getUTCDay();
  return { weekday, day: numero("day"), month: numero("month"), year: numero("year"), hour: numero("hour") % 24, minute: numero("minute") };
}

function hora(value: Date): string {
  const { hour, minute } = partesNoFuso(value);
  return `${hour}h${minute === 0 ? "" : String(minute).padStart(2, "0")}`;
}

export function formatarDataHoraExtenso(inicio: Date | string, fim?: Date | string | null): string {
  const dataInicio = dataValida(inicio);
  if (!dataInicio) return "Data a confirmar";
  const partes = partesNoFuso(dataInicio);
  const dataFim = dataValida(fim);
  return `${DIAS_LONGOS[partes.weekday]}, ${partes.day} de ${MESES_LONGOS[partes.month - 1]} de ${partes.year} · ${hora(dataInicio)}${dataFim ? ` às ${hora(dataFim)}` : ""}`;
}

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
  return `A partir de ${formatarMoeda(cents)}`;
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
