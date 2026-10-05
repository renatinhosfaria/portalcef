import { clientFetch } from "@essencia/shared/fetchers/client";

export interface DashboardStats {
  totalUsers: number;
  activeNow: number;
  administrators: number;
  sessions24h: number;
}

export function getDashboardStats(): Promise<DashboardStats> {
  return clientFetch<DashboardStats>("/stats/dashboard");
}
