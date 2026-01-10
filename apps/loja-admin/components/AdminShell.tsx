"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";
import {
  BarChart3,
  ClipboardList,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Warehouse,
  Menu,
  Search,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

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

function AdminSidebar() {
  const pathname = usePathname();
  const { role, name, schoolId, unitId, email } = useTenant();

  const tenantPayload = useMemo(
    () =>
      encodeURIComponent(
        JSON.stringify({ schoolId, unitId, role, name, email }),
      ),
    [schoolId, unitId, role, name, email],
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      console.warn("Logout API call failed");
    } finally {
      localStorage.removeItem("tenant");
      window.location.href = "http://localhost:3003";
    }
  };

  const handleBackToPortal = () => {
    window.location.href = `http://localhost:3000?data=${tenantPayload}`;
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center py-8 border-r border-slate-200/60 bg-white/80 backdrop-blur-xl sm:flex lg:w-72 transition-all duration-500 ease-in-out">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 mb-8 w-full">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#A3D154] shadow-lg shadow-[#A3D154]/20">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <div className="hidden lg:block">
          <span className="text-xl font-bold tracking-tight text-slate-800">
            Loja Admin
          </span>
          <p className="text-xs text-slate-500">Gestão de Uniformes</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 w-full px-4 flex-1">
        <SidebarItem
          icon={BarChart3}
          label="Dashboard"
          href="/"
          active={pathname === "/"}
        />
        <SidebarItem
          icon={ClipboardList}
          label="Pedidos"
          href="/pedidos"
          active={pathname.startsWith("/pedidos")}
        />
        <SidebarItem
          icon={ShoppingCart}
          label="Venda Presencial"
          href="/venda-presencial"
          active={pathname.startsWith("/venda-presencial")}
        />
        <SidebarItem
          icon={Package}
          label="Produtos"
          href="/produtos"
          active={pathname.startsWith("/produtos")}
        />
        <SidebarItem
          icon={Warehouse}
          label="Estoque"
          href="/estoque"
          active={pathname.startsWith("/estoque")}
        />
        <SidebarItem
          icon={Sparkles}
          label="Interesse"
          href="/interesse"
          active={pathname.startsWith("/interesse")}
        />
        <SidebarItem
          icon={Settings}
          label="Configurações"
          href="/configuracoes"
          active={pathname.startsWith("/configuracoes")}
        />
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-3 w-full px-4 pt-4 border-t border-slate-200/60">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl py-3"
          onClick={handleBackToPortal}
        >
          <span className="text-lg">←</span>
          <span className="hidden lg:block text-sm">Voltar ao Portal</span>
        </Button>
        
        <div className="hidden lg:flex flex-col gap-1 px-2">
          <p className="text-sm font-bold text-slate-800 truncate">
            {name || "Usuário"}
          </p>
          <p className="text-xs text-slate-500 font-medium capitalize truncate">
            {role?.replace("_", " ") || ""}
          </p>
        </div>
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl py-3"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden lg:block font-medium text-sm">Sair</span>
        </Button>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between px-8 bg-white/50 backdrop-blur-md border-b border-white/20">
      <div className="flex items-center gap-4 lg:hidden">
        <Button variant="ghost" size="icon">
          <Menu className="w-6 h-6 text-slate-600" />
        </Button>
      </div>

      <div className="flex-1 max-w-xl hidden md:block">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#A3D154] transition-colors" />
          <input
            type="text"
            placeholder="Buscar pedidos, produtos..."
            className="w-full h-11 pl-12 pr-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:bg-white focus:border-[#A3D154]/50 focus:ring-4 focus:ring-[#A3D154]/10 outline-none transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="Logo da escola"
            width={120}
            height={48}
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>
    </header>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#A3D154]/20">
      <AdminSidebar />
      <div className="flex-1 sm:pl-20 lg:pl-72 flex flex-col min-h-screen relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-[#A3D154]/20 to-[#A3D154]/5 rounded-full blur-3xl pointer-events-none opacity-60"></div>
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-orange-400/5 rounded-full blur-3xl pointer-events-none"></div>

        <TopBar />

        <main className="flex-1 p-8 lg:p-12 space-y-8 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
