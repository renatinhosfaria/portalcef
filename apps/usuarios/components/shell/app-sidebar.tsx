"use client";

import { Button } from "@essencia/ui/components/button";
import { LayoutDashboard, LogOut, School, Users } from "lucide-react";

import { useTenant } from "@essencia/shared/providers/tenant";

import { SidebarItem } from "./sidebar-item";

export function AppSidebar() {
  const { role } = useTenant();

  // Determine if user has access to certain menus (Example logic)
  // Lower number = Higher role
  // master (0), diretora (1) -> Full Access
  const canSeeSettings = role === "master" || role === "diretora_geral";

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center py-8 border-r border-slate-200/60 bg-white/80 backdrop-blur-xl sm:flex lg:w-72 transition-all duration-500 ease-in-out">
      <div className="flex items-center gap-3 px-6 mb-12 w-full">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#A3D154] shadow-lg shadow-[#A3D154]/20">
          <span className="text-white font-bold text-xl">E</span>
          <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse" />
        </div>
        <span className="hidden lg:block text-2xl font-bold tracking-tight text-slate-800">
          Essência
        </span>
      </div>

      <nav className="flex flex-col gap-2 w-full px-4">
        {/* Point back to Home App */}
        <SidebarItem
          icon={LayoutDashboard}
          label="Visão Geral"
          href="http://localhost:3006" // Home App Port
          active={false}
        />
        <SidebarItem
          icon={Users}
          label="Usuários"
          href="/" // Current App Root
          active={true} // Always active since we are in Usuarios module
        />
        {role === "master" && (
          <SidebarItem
            icon={School} // usage of imported School icon
            label="Gestão Escolar"
            href="http://localhost:3005"
            active={false}
          />
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-4 w-full px-6">
        <div className="flex flex-col gap-1 hidden lg:flex">
          <p className="text-sm font-bold text-slate-800">Renato S.</p>
          <p className="text-xs text-slate-500 font-medium capitalize">
            {role.replace("_", " ")}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl py-6"
          onClick={() => {
            localStorage.removeItem("tenant");
            window.location.href = "http://localhost:3003"; // Login
          }}
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden lg:block font-medium">Sair da Conta</span>
        </Button>
      </div>
    </aside>
  );
}
