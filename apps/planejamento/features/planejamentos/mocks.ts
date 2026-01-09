import {
  QUINZENAS_2026,
  getCurrentQuinzena2026,
  getDeadlineStatus as getDeadlineStatusFromConfig,
  isInVacationPeriod,
  type QuinzenaConfig,
} from "@essencia/shared/config/quinzenas";
import { DeadlineStatus, Quinzena, QuinzenaStatus } from "./types";

/**
 * Converte Date para string no formato YYYY-MM-DD
 */
function toDateString(date: Date): string {
  return date.toISOString().split("T")[0] as string;
}

/**
 * Calcula o status da quinzena baseado na regra de negócio:
 * - 1ª Quinzena: sempre desbloqueada
 * - Demais quinzenas: desbloqueadas quando a anterior for concluída (data passou)
 *
 * @param config - Configuração da quinzena
 * @param today - Data atual
 * @param previousCompleted - Se a quinzena anterior foi concluída
 */
function calculateQuinzenaStatus(
  config: QuinzenaConfig,
  today: Date,
  previousCompleted: boolean,
): QuinzenaStatus {
  const dateStr = toDateString(today);

  // Se a data atual já passou do fim da quinzena, está completa
  if (dateStr > config.endDate) {
    return "completed";
  }

  // A primeira quinzena (Q01) está sempre desbloqueada
  if (config.number === 1) {
    return "unlocked";
  }

  // Demais quinzenas: desbloqueadas se a anterior foi concluída
  if (previousCompleted) {
    return "unlocked";
  }

  // Caso contrário, está bloqueada
  return "locked";
}

/**
 * Converte uma QuinzenaConfig do shared para o tipo Quinzena do frontend.
 * Calcula status e deadlineStatus dinamicamente baseado na data atual.
 */
function convertToQuinzena(
  config: QuinzenaConfig,
  today: Date,
  previousCompleted: boolean,
): Quinzena {
  const status = calculateQuinzenaStatus(config, today, previousCompleted);
  const deadlineStatus =
    status === "unlocked"
      ? (getDeadlineStatusFromConfig(config, today) as DeadlineStatus)
      : "normal";

  return {
    id: config.id,
    number: config.number,
    startDate: new Date(config.startDate + "T12:00:00"),
    endDate: new Date(config.endDate + "T12:00:00"),
    deadline: new Date(config.deadline + "T23:59:59"),
    status,
    deadlineStatus,
  };
}

/**
 * Gera quinzenas baseadas no calendário escolar 2026.
 * Retorna todas as 21 quinzenas do ano letivo com status calculado dinamicamente.
 *
 * Regra de desbloqueio:
 * - 1ª Quinzena: sempre desbloqueada
 * - Demais quinzenas: desbloqueadas quando a anterior for concluída (data passou)
 *
 * Calendário Escolar 2026:
 * - 1º Semestre: 02/02/2026 a 30/06/2026 (Q01-Q11)
 * - Férias de Julho: 01/07/2026 a 31/07/2026 (sem quinzenas)
 * - 2º Semestre: 03/08/2026 a 18/12/2026 (Q12-Q21)
 */
export function generateMockQuinzenas(): Quinzena[] {
  const today = new Date();
  const dateStr = toDateString(today);
  const quinzenas: Quinzena[] = [];

  // Se estamos em férias, retorna as quinzenas do 2º semestre primeiro
  if (isInVacationPeriod(today)) {
    const quinzenas2Sem = QUINZENAS_2026.filter((q) => q.semester === 2);
    const quinzenas1Sem = QUINZENAS_2026.filter((q) => q.semester === 1);
    const orderedQuinzenas = [...quinzenas2Sem, ...quinzenas1Sem];

    let previousCompleted = true; // Durante férias, Q11 já foi concluída
    for (const q of orderedQuinzenas) {
      const quinzena = convertToQuinzena(q, today, previousCompleted);
      quinzenas.push(quinzena);
      previousCompleted = quinzena.status === "completed";
    }
    return quinzenas;
  }

  // Retorna todas as quinzenas na ordem natural
  let previousCompleted = false;
  for (const q of QUINZENAS_2026) {
    // A primeira quinzena não precisa de anterior concluída
    const quinzena = convertToQuinzena(
      q,
      today,
      q.number === 1 || previousCompleted,
    );
    quinzenas.push(quinzena);
    previousCompleted = quinzena.status === "completed";
  }

  return quinzenas;
}

/**
 * Verifica se estamos no período de férias escolares (julho 2026).
 */
export { isInVacationPeriod };

/**
 * Obtém a quinzena atual do ano letivo 2026.
 * Retorna null se estiver em férias ou fora do período letivo.
 */
export function getCurrentQuinzenaId(): string | null {
  const today = new Date();

  if (isInVacationPeriod(today)) {
    return null;
  }

  const current = getCurrentQuinzena2026(today);
  return current?.id || null;
}

export function getDeadlineColor(
  status: DeadlineStatus,
  isLocked: boolean,
): string {
  if (isLocked) return "bg-gray-100 border-gray-200 text-gray-400"; // Generic locked style

  switch (status) {
    case "late":
      return "bg-red-50 border-red-200 text-red-700"; // Vermelho
    case "urgent":
      return "bg-yellow-50 border-yellow-200 text-yellow-700"; // Amarelo
    case "warning":
      // User said: "Verde = Faltam 3 dias". Warning usually implies yellow/orange, but user wants Green for 3 days.
      // Let's align naming to intent: 3 days is "Good" (Green)? Or "Attention"?
      // User: "Verde = Faltam 3 dias". "Azul = Faltam 5 dias".
      // Logic: >5 (Blue), <=5 & >3 (Blue?), <=3 & >1 (Green?), <=1 (Yellow), <0 (Red).
      // Let's adjust helper below.
      return "bg-green-50 border-green-200 text-green-700"; // Verde
    case "normal":
      return "bg-blue-50 border-blue-200 text-blue-700"; // Azul
    default:
      return "bg-gray-50 border-gray-200 text-gray-700";
  }
}
