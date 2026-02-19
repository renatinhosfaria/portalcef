"use client";

import { StatsCard } from "@essencia/ui/components/stats-card";
import { Clock, Shield, UserCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

export function DashboardStats() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeNow: 0,
    administrators: 0,
    sessions24h: 0,
  });

  useEffect(() => {
    const abortController = new AbortController();
    let timerId: NodeJS.Timeout | null = null;

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats/dashboard", {
          signal: abortController.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.success && json.data) {
          setStats(json.data);
        }
      } catch (e) {
        // Ignore abort errors
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("Failed to fetch stats", e);
      }
    };

    // Initial fetch
    fetchStats();

    // Poll only if tab is visible (using Page Visibility API)
    const startPolling = () => {
      if (timerId) clearInterval(timerId);
      // Increased interval to 60s to reduce load
      timerId = setInterval(fetchStats, 60000);
    };

    const stopPolling = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchStats(); // Fetch immediately when tab becomes visible
        startPolling();
      }
    };

    // Start polling if page is visible
    if (!document.hidden) {
      startPolling();
    }

    // Listen to visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      abortController.abort();
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatsCard
        title="Total Usuários"
        value={stats.totalUsers}
        trend="+12"
        trendUp={true}
        icon={Users}
        color="text-[#A3D154]"
        bg="bg-[#A3D154]/10"
      />
      <StatsCard
        title="Ativos Agora"
        value={stats.activeNow}
        trend="Estável"
        trendUp={true}
        icon={UserCheck}
        color="text-emerald-500"
        bg="bg-emerald-500/10"
      />
      <StatsCard
        title="Administradores"
        value={stats.administrators}
        icon={Shield}
        color="text-indigo-500"
        bg="bg-indigo-500/10"
      />
      <StatsCard
        title="Sessões (24h)"
        value={stats.sessions24h}
        trend="+5%"
        trendUp={true}
        icon={Clock}
        color="text-orange-500"
        bg="bg-orange-500/10"
      />
    </div>
  );
}
