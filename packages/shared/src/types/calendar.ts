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
  INICIO_SEMESTRE: {
    label: "Início de Semestre",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    borderColor: "border-blue-300",
  },
  TERMINO_SEMESTRE: {
    label: "Término de Semestre",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    borderColor: "border-blue-300",
  },
  FERIADO: {
    label: "Feriado",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    borderColor: "border-red-300",
  },
  RECESSO: {
    label: "Recesso",
    color: "orange",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
    borderColor: "border-orange-300",
  },
  FERIAS_PROFESSORES: {
    label: "Férias dos Professores",
    color: "gray",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    borderColor: "border-gray-300",
  },
  SABADO_LETIVO: {
    label: "Sábado Letivo",
    color: "yellow",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    borderColor: "border-yellow-300",
  },
  SEMANA_PROVAS: {
    label: "Semana de Provas",
    color: "purple",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    borderColor: "border-purple-300",
  },
  DIA_LETIVO: {
    label: "Dia Letivo",
    color: "slate",
    bgColor: "bg-white",
    textColor: "text-slate-700",
    borderColor: "border-slate-200",
  },
  REUNIAO_PEDAGOGICA: {
    label: "Reunião Pedagógica",
    color: "teal",
    bgColor: "bg-teal-100",
    textColor: "text-teal-700",
    borderColor: "border-teal-300",
  },
  EVENTO_ESPECIAL: {
    label: "Evento Especial",
    color: "pink",
    bgColor: "bg-pink-100",
    textColor: "text-pink-700",
    borderColor: "border-pink-300",
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
