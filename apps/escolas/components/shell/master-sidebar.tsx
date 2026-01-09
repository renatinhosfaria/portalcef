"use client";

import { Button } from "@essencia/ui/components/button";
import { LayoutDashboard, LayoutGrid, LogOut, School } from "lucide-react";

import { SidebarItem } from "./sidebar-item";

export function MasterSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center py-8 border-r border-slate-200/60 bg-white/80 backdrop-blur-xl sm:flex lg:w-72 transition-all duration-500 ease-in-out">
      <div className="flex items-center gap-3 px-6 mb-12 w-full">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 shadow-lg shadow-slate-900/20">
          <span className="text-[#A3D154] font-bold text-xl">M</span>
          <div className="absolute inset-0 bg-white/10 rounded-xl animate-pulse" />
        </div>
        <span className="hidden lg:block text-2xl font-bold tracking-tight text-slate-900">
          Portal CEF
        </span>
      </div>

      <nav className="flex flex-col gap-2 w-full px-4">
        {/* External Link to Home */}
        <SidebarItem
          icon={LayoutGrid}
          label="Voltar aos Apps"
          href="http://localhost:3006"
          active={false}
        />

        <div className="my-2 border-t border-slate-100" />

        <SidebarItem icon={LayoutDashboard} label="Visão Geral" href="/" />
        <SidebarItem icon={School} label="Escolas & Unidades" href="/schools" />
      </nav>

      <div className="mt-auto flex flex-col gap-4 w-full px-6">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl py-6"
          onClick={() => {
            localStorage.removeItem("tenant");
            window.location.href = "http://localhost:3003";
          }}
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden lg:block font-medium">Sair do Master</span>
        </Button>
      </div>
    </aside>
  );
}
