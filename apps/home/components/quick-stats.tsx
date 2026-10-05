"use client";

import { Card } from "@essencia/ui/components/card";
import { Clock, Shield, UserCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getDashboardStats, type DashboardStats } from "../lib/home-api";

const ESTADO_INICIAL: DashboardStats = {
  totalUsers: 0,
  activeNow: 0,
  administrators: 0,
  sessions24h: 0,
};

const FORMATADOR_NUMERO = new Intl.NumberFormat("pt-BR");

const CAMPOS = [
  { key: "totalUsers", label: "Usuários", icon: Users, color: "text-emerald-600" },
  { key: "activeNow", label: "Ativos agora", icon: UserCheck, color: "text-blue-600" },
  { key: "administrators", label: "Administradores", icon: Shield, color: "text-violet-600" },
  { key: "sessions24h", label: "Sessões (24h)", icon: Clock, color: "text-orange-600" },
] as const satisfies ReadonlyArray<{
  key: keyof DashboardStats;
  label: string;
  icon: typeof Users;
  color: string;
}>;

export function QuickStats() {
  const [stats, setStats] = useState<DashboardStats>(ESTADO_INICIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setError(false);

    try {
      setStats(await getDashboardStats());
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status">
        <span className="sr-only">Carregando estatísticas...</span>
        {CAMPOS.map(({ key }) => (
          <Card key={key} className="h-28 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-800"
        role="alert"
      >
        <span>Não foi possível carregar as estatísticas.</span>
        <button
          type="button"
          className="font-semibold underline underline-offset-2"
          onClick={() => void carregar()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CAMPOS.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="relative overflow-hidden border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-800">
            {FORMATADOR_NUMERO.format(stats[key])}
          </div>
        </Card>
      ))}
    </div>
  );
}
