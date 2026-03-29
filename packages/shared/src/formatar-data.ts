/**
 * Utilitário centralizado de formatação de datas e horários.
 *
 * Todas as funções garantem o fuso horário America/Sao_Paulo
 * e o locale pt-BR, independente do timezone do navegador.
 */

const FUSO_HORARIO = "America/Sao_Paulo";
const LOCALE = "pt-BR";

type DataInput = string | Date;

function toDate(data: DataInput): Date {
  return typeof data === "string" ? new Date(data) : data;
}

/** dd/MM/yyyy (ex: "15/03/2026") */
export function formatarData(data: DataInput): string {
  return toDate(data).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: FUSO_HORARIO,
  });
}

/** dd/MM/yyyy, HH:mm (ex: "15/03/2026, 14:30") */
export function formatarDataHora(data: DataInput): string {
  return toDate(data).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_HORARIO,
  });
}

/** dd/MM (ex: "15/03") */
export function formatarDataCurta(data: DataInput): string {
  return toDate(data).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    timeZone: FUSO_HORARIO,
  });
}

/** dd/MM, HH:mm (ex: "15/03, 14:30") */
export function formatarDataHoraCurta(data: DataInput): string {
  return toDate(data).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_HORARIO,
  });
}

/** dd de MMMM de yyyy (ex: "15 de março de 2026") */
export function formatarDataLonga(data: DataInput): string {
  return toDate(data).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: FUSO_HORARIO,
  });
}

/** dd de MMMM de yyyy, HH:mm (ex: "15 de março de 2026, 14:30") */
export function formatarDataHoraLonga(data: DataInput): string {
  return toDate(data).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_HORARIO,
  });
}

/** dd de MMMM (ex: "15 de março") */
export function formatarDiaMes(data: DataInput): string {
  return toDate(data).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "long",
    timeZone: FUSO_HORARIO,
  });
}

/** MMMM de yyyy (ex: "março de 2026") */
export function formatarMesAno(data: DataInput): string {
  return toDate(data).toLocaleDateString(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: FUSO_HORARIO,
  });
}

/** weekday, dd de MMMM (ex: "quarta-feira, 15 de março") */
export function formatarDataDiaSemana(data: DataInput): string {
  return toDate(data).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: FUSO_HORARIO,
  });
}

/** HH:mm (ex: "14:30") */
export function formatarHora(data: DataInput): string {
  return toDate(data).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_HORARIO,
  });
}

/** Retorna o número do dia no fuso de São Paulo (ex: 15) */
export function obterDia(data: DataInput): number {
  const partes = new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    timeZone: FUSO_HORARIO,
  }).formatToParts(toDate(data));
  const dia = partes.find((p) => p.type === "day");
  return Number(dia?.value ?? toDate(data).getDate());
}

/** yyyy-MM-dd no fuso de São Paulo (para inputs HTML date) */
export function formatarDataISO(data: DataInput): string {
  const d = toDate(data);
  const partes = new Intl.DateTimeFormat(LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: FUSO_HORARIO,
  }).formatToParts(d);

  const ano = partes.find((p) => p.type === "year")?.value;
  const mes = partes.find((p) => p.type === "month")?.value;
  const dia = partes.find((p) => p.type === "day")?.value;
  return `${ano}-${mes}-${dia}`;
}

/** Constante exportada para uso direto quando necessário */
export const FUSO_SAO_PAULO = FUSO_HORARIO;
