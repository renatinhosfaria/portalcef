"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { Button } from "@essencia/ui/components/button";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  School,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AnnouncementBanner } from "../components/announcement-banner";
import { CalendarWidget } from "../components/calendar-widget";
import { QuickStats } from "../components/quick-stats";
import { SystemFeed } from "../components/system-feed";

export default function Home() {
  const { name } = useTenant();
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Bom dia");
    } else if (hour >= 12 && hour < 18) {
      setGreeting("Boa tarde");
    } else {
      setGreeting("Boa noite");
    }
  }, []);

  return (
    <div className="min-h-screen pb-10">
      {/* Header / Hero */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {greeting}, {name ? name.split(" ")[0] : "Visitante"} 👋
        </h1>
        <p className="text-slate-500 font-medium">
          Aqui está o resumo das atividades da sua instituição hoje.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Content Area (Left/Center) */}
        <main className="lg:col-span-8 space-y-8">
          {/* Quick Stats Row */}
          <section>
            <QuickStats />
          </section>

          {/* Activity Feed Section */}
          <section>
            <SystemFeed />
          </section>
        </main>

        {/* Sidebar (Right) */}
        <aside className="lg:col-span-4 space-y-6 sticky top-8">
          {/* Announcements */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <AnnouncementBanner />
          </section>

          {/* Calendar Widget */}
          <section>
            <CalendarWidget />
          </section>

          {/* Module Quick Links */}
          <section className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Acesso Rápido</h3>
              <LayoutDashboard className="w-5 h-5 opacity-50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ModuleLink
                href="http://localhost:3007"
                label="Planejamento"
                icon={BookOpen}
                color="text-emerald-400"
              />
              <ModuleLink
                href="http://localhost:3005"
                label="Escolas"
                icon={School}
                color="text-blue-400"
              />
              <ModuleLink
                href="http://localhost:3006"
                label="Turmas"
                icon={GraduationCap}
                color="text-violet-400"
              />
              <ModuleLink
                href="http://localhost:3004"
                label="Usuários"
                icon={Users}
                color="text-orange-400"
              />
              <ModuleLink
                href="http://localhost:3002"
                label="Calendário"
                icon={Calendar}
                color="text-rose-400"
              />
            </div>

            <Button
              variant="outline"
              className="w-full mt-4 bg-white/10 border-white/10 text-white hover:bg-white/20 hover:text-white border-0 justify-between"
            >
              Ver todos os módulos
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ModuleLink({
  href,
  label,
  icon: Icon,
  color,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 bg-white/5 rounded-xl p-3 hover:bg-white/15 transition-colors group"
    >
      <Icon
        className={`w-6 h-6 ${color} group-hover:scale-110 transition-transform`}
      />
      <span className="text-xs font-semibold opacity-80">{label}</span>
    </Link>
  );
}
