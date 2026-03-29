"use client";

import { Button } from "@essencia/ui/components/button";
import { Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { AppSidebar, type AppSidebarProps } from "./app-sidebar";

const SIDEBAR_KEY = "sidebar-collapsed";

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem(SIDEBAR_KEY, String(!prev));
      return !prev;
    });
  };

  const collapse = () => {
    setCollapsed(true);
    localStorage.setItem(SIDEBAR_KEY, "true");
  };

  return { collapsed, toggle, collapse };
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
            placeholder="Buscar..."
            className="w-full h-11 pl-12 pr-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:bg-white focus:border-[#A3D154]/50 focus:ring-4 focus:ring-[#A3D154]/10 outline-none transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center">
          <img
            src="/logo.png"
            alt="Logo da escola"
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>
    </header>
  );
}

export interface ShellProps {
  children: React.ReactNode;
  /** Props para customizar a sidebar (ex: tarefasBadge) */
  sidebarProps?: AppSidebarProps;
}

export { SIDEBAR_KEY };

export function Shell({ children, sidebarProps }: ShellProps) {
  const { collapsed, toggle, collapse } = useSidebarCollapsed();

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#A3D154]/20">
      <AppSidebar {...sidebarProps} collapsed={collapsed} onToggle={toggle} onCollapse={collapse} />
      <div className={`flex-1 flex flex-col min-h-screen relative overflow-hidden transition-all duration-300 ease-in-out sm:pl-20 ${collapsed ? "" : "lg:pl-72"}`}>
        {/* Abstract Background Elements */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-[#A3D154]/20 to-[#A3D154]/5 rounded-full blur-3xl pointer-events-none opacity-60"></div>
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-orange-400/5 rounded-full blur-3xl pointer-events-none"></div>

        <TopBar />

        <main className="flex-1 p-8 lg:p-12 space-y-12 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
