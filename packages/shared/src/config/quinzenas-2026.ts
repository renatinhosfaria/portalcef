/**
 * Configuração das Quinzenas do Ano Letivo 2026
 *
 * Baseado no Calendário Escolar 2026:
 * - 1º Semestre: 02/02/2026 a 30/06/2026
 * - Férias de Julho: 01/07/2026 a 31/07/2026
 * - 2º Semestre: 03/08/2026 a 18/12/2026
 *
 * Cada quinzena tem 14 dias CORRIDOS (não úteis).
 * O deadline de entrega é 5 dias ÚTEIS antes do início da quinzena.
 */

export interface QuinzenaConfig {
  id: string; // Ex: "2026-Q01"
  number: number; // 1 a 21
  label: string; // Ex: "1ª Quinzena"
  startDate: string; // ISO date: "2026-02-02"
  endDate: string; // ISO date: "2026-02-15"
  deadline: string; // ISO date: Data limite de entrega (5 dias úteis antes do início)
  semester: 1 | 2; // Semestre
}

/**
 * Quinzenas do Ano Letivo 2026
 *
 * 1º Semestre: 02/02 a 30/06 = 149 dias = 11 quinzenas
 * 2º Semestre: 03/08 a 18/12 = 138 dias = 10 quinzenas
 * Total: 21 quinzenas
 *
 * Deadline: 5 dias úteis ANTES do início de cada quinzena
 * - Q01: 02/02 início → deadline 26/01 (5 dias úteis antes)
 * - Q02: 16/02 início → deadline 09/02 (5 dias úteis antes)
 * - etc.
 */
export const QUINZENAS_2026: QuinzenaConfig[] = [
  // ========== 1º SEMESTRE (02/02 a 30/06) ==========
  {
    id: "2026-Q01",
    number: 1,
    label: "1ª Quinzena",
    startDate: "2026-02-02",
    endDate: "2026-02-15",
    deadline: "2026-01-26", // 5 dias úteis antes de 02/02 (seg-sex: 26,27,28,29,30 jan)
    semester: 1,
  },
  {
    id: "2026-Q02",
    number: 2,
    label: "2ª Quinzena",
    startDate: "2026-02-16",
    endDate: "2026-03-01",
    deadline: "2026-02-09", // 5 dias úteis antes de 16/02 (seg-sex: 09,10,11,12,13 fev)
    semester: 1,
  },
  {
    id: "2026-Q03",
    number: 3,
    label: "3ª Quinzena",
    startDate: "2026-03-02",
    endDate: "2026-03-15",
    deadline: "2026-02-23", // 5 dias úteis antes de 02/03 (seg-sex: 23,24,25,26,27 fev)
    semester: 1,
  },
  {
    id: "2026-Q04",
    number: 4,
    label: "4ª Quinzena",
    startDate: "2026-03-16",
    endDate: "2026-03-29",
    deadline: "2026-03-09", // 5 dias úteis antes de 16/03 (seg-sex: 09,10,11,12,13 mar)
    semester: 1,
  },
  {
    id: "2026-Q05",
    number: 5,
    label: "5ª Quinzena",
    startDate: "2026-03-30",
    endDate: "2026-04-12",
    deadline: "2026-03-23", // 5 dias úteis antes de 30/03 (seg-sex: 23,24,25,26,27 mar)
    semester: 1,
  },
  {
    id: "2026-Q06",
    number: 6,
    label: "6ª Quinzena",
    startDate: "2026-04-13",
    endDate: "2026-04-26",
    deadline: "2026-04-06", // 5 dias úteis antes de 13/04 (seg-sex: 06,07,08,09,10 abr)
    semester: 1,
  },
  {
    id: "2026-Q07",
    number: 7,
    label: "7ª Quinzena",
    startDate: "2026-04-27",
    endDate: "2026-05-10",
    deadline: "2026-04-20", // 5 dias úteis antes de 27/04 (seg-sex: 20,21,22,23,24 abr)
    semester: 1,
  },
  {
    id: "2026-Q08",
    number: 8,
    label: "8ª Quinzena",
    startDate: "2026-05-11",
    endDate: "2026-05-24",
    deadline: "2026-05-04", // 5 dias úteis antes de 11/05 (seg-sex: 04,05,06,07,08 mai)
    semester: 1,
  },
  {
    id: "2026-Q09",
    number: 9,
    label: "9ª Quinzena",
    startDate: "2026-05-25",
    endDate: "2026-06-07",
    deadline: "2026-05-18", // 5 dias úteis antes de 25/05 (seg-sex: 18,19,20,21,22 mai)
    semester: 1,
  },
  {
    id: "2026-Q10",
    number: 10,
    label: "10ª Quinzena",
    startDate: "2026-06-08",
    endDate: "2026-06-21",
    deadline: "2026-06-01", // 5 dias úteis antes de 08/06 (seg-sex: 01,02,03,04,05 jun)
    semester: 1,
  },
  {
    id: "2026-Q11",
    number: 11,
    label: "11ª Quinzena",
    startDate: "2026-06-22",
    endDate: "2026-06-30", // Término do 1º semestre (9 dias)
    deadline: "2026-06-15", // 5 dias úteis antes de 22/06 (seg-sex: 15,16,17,18,19 jun)
    semester: 1,
  },

  // ========== FÉRIAS DE JULHO - SEM QUINZENAS ==========
  // 01/07 a 31/07/2026 - Não há quinzenas neste período

  // ========== 2º SEMESTRE (03/08 a 18/12) ==========
  {
    id: "2026-Q12",
    number: 12,
    label: "12ª Quinzena",
    startDate: "2026-08-03",
    endDate: "2026-08-16",
    deadline: "2026-07-27", // 5 dias úteis antes de 03/08 (seg-sex: 27,28,29,30,31 jul)
    semester: 2,
  },
  {
    id: "2026-Q13",
    number: 13,
    label: "13ª Quinzena",
    startDate: "2026-08-17",
    endDate: "2026-08-30",
    deadline: "2026-08-10", // 5 dias úteis antes de 17/08 (seg-sex: 10,11,12,13,14 ago)
    semester: 2,
  },
  {
    id: "2026-Q14",
    number: 14,
    label: "14ª Quinzena",
    startDate: "2026-08-31",
    endDate: "2026-09-13",
    deadline: "2026-08-24", // 5 dias úteis antes de 31/08 (seg-sex: 24,25,26,27,28 ago)
    semester: 2,
  },
  {
    id: "2026-Q15",
    number: 15,
    label: "15ª Quinzena",
    startDate: "2026-09-14",
    endDate: "2026-09-27",
    deadline: "2026-09-07", // 5 dias úteis antes de 14/09 (seg-sex: 07,08,09,10,11 set)
    semester: 2,
  },
  {
    id: "2026-Q16",
    number: 16,
    label: "16ª Quinzena",
    startDate: "2026-09-28",
    endDate: "2026-10-11",
    deadline: "2026-09-21", // 5 dias úteis antes de 28/09 (seg-sex: 21,22,23,24,25 set)
    semester: 2,
  },
  {
    id: "2026-Q17",
    number: 17,
    label: "17ª Quinzena",
    startDate: "2026-10-12",
    endDate: "2026-10-25",
    deadline: "2026-10-05", // 5 dias úteis antes de 12/10 (seg-sex: 05,06,07,08,09 out)
    semester: 2,
  },
  {
    id: "2026-Q18",
    number: 18,
    label: "18ª Quinzena",
    startDate: "2026-10-26",
    endDate: "2026-11-08",
    deadline: "2026-10-19", // 5 dias úteis antes de 26/10 (seg-sex: 19,20,21,22,23 out)
    semester: 2,
  },
  {
    id: "2026-Q19",
    number: 19,
    label: "19ª Quinzena",
    startDate: "2026-11-09",
    endDate: "2026-11-22",
    deadline: "2026-11-02", // 5 dias úteis antes de 09/11 (seg-sex: 02,03,04,05,06 nov)
    semester: 2,
  },
  {
    id: "2026-Q20",
    number: 20,
    label: "20ª Quinzena",
    startDate: "2026-11-23",
    endDate: "2026-12-06",
    deadline: "2026-11-16", // 5 dias úteis antes de 23/11 (seg-sex: 16,17,18,19,20 nov)
    semester: 2,
  },
  {
    id: "2026-Q21",
    number: 21,
    label: "21ª Quinzena",
    startDate: "2026-12-07",
    endDate: "2026-12-18", // Término do ano letivo (12 dias)
    deadline: "2026-11-30", // 5 dias úteis antes de 07/12 (seg-sex: 30 nov, 01,02,03,04 dez)
    semester: 2,
  },
];

/**
 * Converte Date para string no formato YYYY-MM-DD
 */
function toDateString(date: Date): string {
  return date.toISOString().split("T")[0] as string;
}

/**
 * Obtém a quinzena atual baseada na data de hoje
 */
export function getCurrentQuinzena2026(
  date: Date = new Date(),
): QuinzenaConfig | null {
  const dateStr = toDateString(date);

  return (
    QUINZENAS_2026.find(
      (q) => dateStr >= q.startDate && dateStr <= q.endDate,
    ) || null
  );
}

/**
 * Obtém a quinzena pelo ID
 */
export function getQuinzenaById(id: string): QuinzenaConfig | null {
  return QUINZENAS_2026.find((q) => q.id === id) || null;
}

/**
 * Verifica se uma data está no período de férias (julho)
 */
export function isInVacationPeriod(date: Date = new Date()): boolean {
  const dateStr = toDateString(date);
  return dateStr >= "2026-07-01" && dateStr <= "2026-07-31";
}

/**
 * Verifica se uma data está antes do início do ano letivo
 */
export function isBeforeSchoolYear(date: Date = new Date()): boolean {
  const dateStr = toDateString(date);
  return dateStr < "2026-02-02";
}

/**
 * Verifica se uma data está após o término do ano letivo
 */
export function isAfterSchoolYear(date: Date = new Date()): boolean {
  const dateStr = toDateString(date);
  return dateStr > "2026-12-18";
}

/**
 * Obtém todas as quinzenas de um semestre específico
 */
export function getQuinzenasBySemester(semester: 1 | 2): QuinzenaConfig[] {
  return QUINZENAS_2026.filter((q) => q.semester === semester);
}

/**
 * Calcula o status de uma quinzena baseado na data atual
 */
export type QuinzenaStatus = "locked" | "unlocked" | "completed" | "vacation";

export function getQuinzenaStatus(
  quinzena: QuinzenaConfig,
  currentDate: Date = new Date(),
): QuinzenaStatus {
  const dateStr = toDateString(currentDate);

  // Se está antes da quinzena
  if (dateStr < quinzena.startDate) {
    return "locked";
  }

  // Se está durante a quinzena
  if (dateStr >= quinzena.startDate && dateStr <= quinzena.endDate) {
    return "unlocked";
  }

  // Se já passou
  return "completed";
}

/**
 * Calcula o status do deadline
 */
export type DeadlineStatus = "normal" | "warning" | "urgent" | "late";

export function getDeadlineStatus(
  quinzena: QuinzenaConfig,
  currentDate: Date = new Date(),
): DeadlineStatus {
  const deadline = new Date(quinzena.deadline + "T23:59:59");
  const diffTime = deadline.getTime() - currentDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "late"; // Vermelho - atrasado
  if (diffDays <= 1) return "urgent"; // Amarelo - urgente
  if (diffDays <= 3) return "warning"; // Verde - atenção
  return "normal"; // Azul - normal
}

/**
 * Formata as datas da quinzena para exibição
 */
export function formatQuinzenaDateRange(quinzena: QuinzenaConfig): string {
  const start = new Date(quinzena.startDate + "T12:00:00");
  const end = new Date(quinzena.endDate + "T12:00:00");

  const formatDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return `${formatDate(start)} a ${formatDate(end)}`;
}

/**
 * Formata o deadline para exibição
 */
export function formatDeadline(quinzena: QuinzenaConfig): string {
  const deadline = new Date(quinzena.deadline + "T12:00:00");
  return deadline.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Obtém a próxima quinzena a partir de uma data
 */
export function getNextQuinzena(
  date: Date = new Date(),
): QuinzenaConfig | null {
  const dateStr = toDateString(date);

  // Se estamos em férias, retorna a primeira quinzena do 2º semestre
  if (isInVacationPeriod(date)) {
    return QUINZENAS_2026.find((q) => q.semester === 2) || null;
  }

  return QUINZENAS_2026.find((q) => dateStr < q.startDate) || null;
}

/**
 * Obtém as próximas N quinzenas a partir de uma data
 */
export function getUpcomingQuinzenas(
  count: number = 4,
  date: Date = new Date(),
): QuinzenaConfig[] {
  const dateStr = toDateString(date);

  // Filtra quinzenas que ainda não terminaram
  const upcoming = QUINZENAS_2026.filter((q) => dateStr <= q.endDate);

  return upcoming.slice(0, count);
}
