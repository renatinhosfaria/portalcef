export const FUSO_HORARIO = "America/Sao_Paulo";
const DIAS_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;

export function dataValida(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function partesNoFuso(value: Date): { weekday: number; day: number; month: number; year: number; hour: number; minute: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    weekday: "short", day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: false, timeZone: FUSO_HORARIO,
  }).formatToParts(value);
  const numero = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value ?? 0);
  const weekday = new Date(Date.UTC(numero("year"), numero("month") - 1, numero("day"))).getUTCDay();
  return { weekday, day: numero("day"), month: numero("month"), year: numero("year"), hour: numero("hour") % 24, minute: numero("minute") };
}

export function hora(value: Date): string {
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
