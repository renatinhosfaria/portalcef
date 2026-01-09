"use client";

import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  School,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useTenant } from "@essencia/shared/providers/tenant";

type ActivePage = "home" | "usuarios" | "escolas" | "turmas" | "planejamento" | "calendario";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
}

function SidebarItem({ icon: Icon, label, href, active }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 px-4 py-4 rounded-2xl w-full transition-all duration-200 group relative overflow-hidden text-left",
        active
          ? "text-[#A3D154] font-bold bg-[#A3D154]/10"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
      )}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#A3D154] rounded-r-full" />
      )}
      <Icon className="w-5 h-5 relative z-10" />
      <span className="hidden lg:block relative z-10">{label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const { role, name, schoolId, unitId, email } = useTenant();
  const [activePage, setActivePage] = useState<ActivePage>("usuarios");

  // Build a portable payload so other apps can hydrate tenant context
  // Memoized to avoid recalculating on every render
  const tenantPayload = useMemo(
    () =>
      encodeURIComponent(
        JSON.stringify({ schoolId, unitId, role, name, email }),
      ),
    [schoolId, unitId, role, name, email],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const port = window.location.port;
      if (port === "3000") {
        setActivePage("home");
      } else if (port === "3004") {
        setActivePage("usuarios");
      } else if (port === "3005") {
        setActivePage("escolas");
      } else if (port === "3006") {
        setActivePage("turmas");
      } else if (port === "3007") {
        setActivePage("planejamento");
      } else if (port === "3002") {
        setActivePage("calendario");
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      // Tenta invalidar sessão no backend via proxy do app atual
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      console.warn("Logout API call failed, continuing with local cleanup");
    } finally {
      localStorage.removeItem("tenant");
      window.location.href = "http://localhost:3003";
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center py-8 border-r border-slate-200/60 bg-white/80 backdrop-blur-xl sm:flex lg:w-72 transition-all duration-500 ease-in-out">
      <div className="flex items-center gap-3 px-6 mb-12 w-full">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#A3D154] shadow-lg shadow-[#A3D154]/20">
          <span className="text-white font-bold text-xl">E</span>
          <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse" />
        </div>
        <span className="hidden lg:block text-2xl font-bold tracking-tight text-slate-800">
          Portal CEF
        </span>
      </div>

      <nav className="flex flex-col gap-2 w-full px-4">
        <SidebarItem
          icon={LayoutDashboard}
          label="Visão Geral"
          href={`http://localhost:3000?data=${tenantPayload}`}
          active={activePage === "home"}
        />
        <SidebarItem
          icon={Users}
          label="Usuários"
          href={`http://localhost:3004?data=${tenantPayload}`}
          active={activePage === "usuarios"}
        />
        {role === "master" && (
          <SidebarItem
            icon={School}
            label="Gestão Escolar"
            href={`http://localhost:3005?data=${tenantPayload}`}
            active={activePage === "escolas"}
          />
        )}
        <SidebarItem
          icon={GraduationCap}
          label="Turmas"
          href={`http://localhost:3006?data=${tenantPayload}`}
          active={activePage === "turmas"}
        />
        <SidebarItem
          icon={BookOpen}
          label="Planejamento"
          href={`http://localhost:3007?data=${tenantPayload}`}
          active={activePage === "planejamento"}
        />
        <SidebarItem
          icon={Calendar}
          label="Calendário"
          href={`http://localhost:3002?data=${tenantPayload}`}
          active={activePage === "calendario"}
        />
      </nav>

      <div className="mt-auto flex flex-col gap-4 w-full px-6">
        <div className="flex flex-col gap-1 hidden lg:flex">
          <p className="text-sm font-bold text-slate-800">
            {name || "Usuário"}
          </p>
          <p className="text-xs text-slate-500 font-medium capitalize">
            {role.replace("_", " ")}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl py-6"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden lg:block font-medium">Sair da Conta</span>
        </Button>
      </div>
    </aside>
  );
}
