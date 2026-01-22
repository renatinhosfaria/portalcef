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
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { useTenant } from "@essencia/shared/providers/tenant";

type ActivePage = "home" | "usuarios" | "escolas" | "turmas" | "planejamento" | "calendario" | "loja-admin";

// Regras de acesso por módulo
const MODULE_ACCESS_RULES = {
  home: "ALL", // Todos os usuários
  usuarios: ["master", "diretora_geral", "gerente_unidade", "gerente_financeiro"],
  escolas: ["master"],
  turmas: ["master", "diretora_geral", "gerente_unidade", "gerente_financeiro"],
  planejamento: "ALL", // Todos os perfis pedagógicos
  calendario: "ALL", // Todos os usuários
  lojaAdmin: ["master", "diretora_geral", "gerente_unidade", "gerente_financeiro", "auxiliar_administrativo"],
} as const;

type ModuleKey = keyof typeof MODULE_ACCESS_RULES;

/**
 * Verifica se o usuário tem acesso a um módulo específico
 * @param userRole - Role do usuário atual
 * @param moduleKey - Chave do módulo a verificar
 * @returns true se o usuário tem acesso ao módulo
 */
function hasModuleAccess(userRole: string, moduleKey: ModuleKey): boolean {
  const allowedRoles = MODULE_ACCESS_RULES[moduleKey];

  // Se for "ALL", todos têm acesso
  if (allowedRoles === "ALL") return true;

  // Verificar se o role do usuário está na lista
  return (allowedRoles as readonly string[]).includes(userRole);
}

function getActivePageFromPath(pathname: string): ActivePage | null {
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath === "" || normalizedPath === "/") return "home";
  if (normalizedPath.startsWith("/usuarios")) return "usuarios";
  if (normalizedPath.startsWith("/escolas")) return "escolas";
  if (normalizedPath.startsWith("/turmas")) return "turmas";
  if (normalizedPath.startsWith("/planejamento")) return "planejamento";
  if (normalizedPath.startsWith("/calendario")) return "calendario";
  if (normalizedPath.startsWith("/loja-admin")) return "loja-admin";

  return null;
}

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
}

function SidebarItem({ icon: Icon, label, href, active }: SidebarItemProps) {
  return (
    <a
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
    </a>
  );
}

export function AppSidebar() {
  const { role, name, schoolId, unitId, email } = useTenant();
  const pathname = usePathname();
  const [activePage, setActivePage] = useState<ActivePage | null>(null);

  // Build a portable payload so other apps can hydrate tenant context
  // Memoized to avoid recalculating on every render
  const tenantPayload = useMemo(
    () =>
      encodeURIComponent(
        JSON.stringify({ schoolId, unitId, role, name, email }),
      ),
    [schoolId, unitId, role, name, email],
  );

  // Configuração de itens do menu
  const menuItems = useMemo(() => [
    {
      key: "home" as ModuleKey,
      icon: LayoutDashboard,
      label: "Visão Geral",
      href: `https://www.portalcef.com.br/?data=${tenantPayload}`,
      activePage: "home" as ActivePage,
    },
    {
      key: "usuarios" as ModuleKey,
      icon: Users,
      label: "Usuários",
      href: `https://www.portalcef.com.br/usuarios?data=${tenantPayload}`,
      activePage: "usuarios" as ActivePage,
    },
    {
      key: "escolas" as ModuleKey,
      icon: School,
      label: "Gestão Escolar",
      href: `https://www.portalcef.com.br/escolas?data=${tenantPayload}`,
      activePage: "escolas" as ActivePage,
    },
    {
      key: "turmas" as ModuleKey,
      icon: GraduationCap,
      label: "Turmas",
      href: `https://www.portalcef.com.br/turmas?data=${tenantPayload}`,
      activePage: "turmas" as ActivePage,
    },
    {
      key: "planejamento" as ModuleKey,
      icon: BookOpen,
      label: "Planejamento",
      href: `https://www.portalcef.com.br/planejamento?data=${tenantPayload}`,
      activePage: "planejamento" as ActivePage,
    },
    {
      key: "calendario" as ModuleKey,
      icon: Calendar,
      label: "Calendário",
      href: `https://www.portalcef.com.br/calendario?data=${tenantPayload}`,
      activePage: "calendario" as ActivePage,
    },
    {
      key: "lojaAdmin" as ModuleKey,
      icon: ShoppingBag,
      label: "Loja",
      href: `https://www.portalcef.com.br/loja-admin?data=${tenantPayload}`,
      activePage: "loja-admin" as ActivePage,
    },
  ], [tenantPayload]);

  // Filtrar itens do menu baseado nas permissões do usuário
  const visibleMenuItems = useMemo(() => {
    if (!role) return [];

    return menuItems.filter(item => hasModuleAccess(role, item.key));
  }, [role, menuItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname || pathname || "";
    const activeFromPath = getActivePageFromPath(currentPath);
    if (activeFromPath) {
      setActivePage(activeFromPath);
      return;
    }

    const port = window.location.port;
    if (port === "3000") return setActivePage("home");
    if (port === "3004") return setActivePage("usuarios");
    if (port === "3005") return setActivePage("escolas");
    if (port === "3006") return setActivePage("turmas");
    if (port === "3007") return setActivePage("planejamento");
    if (port === "3008") return setActivePage("calendario");
    if (port === "3011") return setActivePage("loja-admin");

    setActivePage(null);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      // Tenta invalidar sessão no backend via proxy do app atual
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      console.warn("Logout API call failed, continuing with local cleanup");
    } finally {
      localStorage.removeItem("tenant");
      window.location.href = "https://www.portalcef.com.br/login";
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
        {visibleMenuItems.map((item) => (
          <SidebarItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={activePage === item.activePage}
          />
        ))}
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
