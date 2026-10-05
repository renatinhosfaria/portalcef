import { clientFetch } from "@essencia/shared/fetchers/client";
import { formatarDataISO } from "@essencia/shared/formatar-data";
import type { CalendarEvent } from "@essencia/shared/schemas/calendar";

export interface DashboardStats {
  totalUsers: number;
  activeNow: number;
  administrators: number;
  sessions24h: number;
}

export function getDashboardStats(): Promise<DashboardStats> {
  return clientFetch<DashboardStats>("/stats/dashboard");
}

export async function getTodayCalendarEvents(
  unitId?: string,
): Promise<CalendarEvent[]> {
  const hoje = formatarDataISO(new Date());
  const [ano, mes] = hoje.split("-");
  const params = new URLSearchParams({
    year: ano ?? "",
    month: mes ?? "",
  });

  if (unitId) params.set("unitId", unitId);

  const eventos = await clientFetch<CalendarEvent[]>(
    `/calendar/events?${params.toString()}`,
  );

  return eventos.filter((evento) => {
    const inicio = formatarDataISO(evento.startDate);
    const fim = formatarDataISO(evento.endDate);
    return inicio <= hoje && fim >= hoje;
  });
}
