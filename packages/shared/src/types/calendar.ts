import type { CalendarEventType } from "../schemas/calendar";

// Configuracao visual de cada tipo de evento
export interface EventTypeConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const eventTypeConfig: Record<CalendarEventType, EventTypeConfig> = {
  // 🔵 Azul - Início/Término do semestre
  INICIO_SEMESTRE: {
    label: "Início de Semestre",
    color: "blue",
    bgColor: "bg-blue-500",
    textColor: "text-white",
    borderColor: "border-blue-600",
  },
  TERMINO_SEMESTRE: {
    label: "Término de Semestre",
    color: "blue",
    bgColor: "bg-blue-500",
    textColor: "text-white",
    borderColor: "border-blue-600",
  },
  // 🟣 Roxo - Feriados e Recessos
  FERIADO: {
    label: "Feriado",
    color: "purple",
    bgColor: "bg-purple-500",
    textColor: "text-white",
    borderColor: "border-purple-600",
  },
  RECESSO: {
    label: "Recesso",
    color: "purple",
    bgColor: "bg-purple-500",
    textColor: "text-white",
    borderColor: "border-purple-600",
  },
  // 🟡 Amarelo - Férias e recesso dos professores
  FERIAS_PROFESSORES: {
    label: "Férias dos Professores",
    color: "yellow",
    bgColor: "bg-yellow-400",
    textColor: "text-yellow-900",
    borderColor: "border-yellow-500",
  },
  // 🟠 Laranja - Sábados Letivos
  SABADO_LETIVO: {
    label: "Sábado Letivo",
    color: "orange",
    bgColor: "bg-orange-500",
    textColor: "text-white",
    borderColor: "border-orange-600",
  },
  // 🔷 Azul Escuro - Semana de Provas
  SEMANA_PROVAS: {
    label: "Semana de Provas",
    color: "indigo",
    bgColor: "bg-indigo-700",
    textColor: "text-white",
    borderColor: "border-indigo-800",
  },
  // ⬜ Branco - Dia Letivo (sem marcação especial)
  DIA_LETIVO: {
    label: "Dia Letivo",
    color: "slate",
    bgColor: "bg-white",
    textColor: "text-slate-700",
    borderColor: "border-slate-200",
  },
  // 🟢 Verde - Dia Escolar (planejamento/reuniões)
  REUNIAO_PEDAGOGICA: {
    label: "Dia Escolar",
    color: "green",
    bgColor: "bg-green-500",
    textColor: "text-white",
    borderColor: "border-green-600",
  },
  // Rosa - Evento Especial
  EVENTO_ESPECIAL: {
    label: "Evento Especial",
    color: "pink",
    bgColor: "bg-pink-500",
    textColor: "text-white",
    borderColor: "border-pink-600",
  },
};

// Estatisticas mensais
export interface MonthlyStats {
  month: number;
  name: string;
  schoolDays: number;
  totalDays: number;
}

// Dados de referencia 2026
export const monthlyStats2026: MonthlyStats[] = [
  { month: 1, name: "Janeiro", schoolDays: 0, totalDays: 31 },
  { month: 2, name: "Fevereiro", schoolDays: 17, totalDays: 28 },
  { month: 3, name: "Março", schoolDays: 22, totalDays: 31 },
  { month: 4, name: "Abril", schoolDays: 18, totalDays: 30 },
  { month: 5, name: "Maio", schoolDays: 21, totalDays: 31 },
  { month: 6, name: "Junho", schoolDays: 21, totalDays: 30 },
  { month: 7, name: "Julho", schoolDays: 11, totalDays: 31 },
  { month: 8, name: "Agosto", schoolDays: 21, totalDays: 31 },
  { month: 9, name: "Setembro", schoolDays: 21, totalDays: 30 },
  { month: 10, name: "Outubro", schoolDays: 17, totalDays: 31 },
  { month: 11, name: "Novembro", schoolDays: 20, totalDays: 30 },
  { month: 12, name: "Dezembro", schoolDays: 11, totalDays: 31 },
];

export const TOTAL_SCHOOL_DAYS_2026 = 200;
