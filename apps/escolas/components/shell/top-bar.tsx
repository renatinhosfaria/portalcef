"use client";

import { Button } from "@essencia/ui/components/button";
import { Menu, ShieldAlert } from "lucide-react";

import { useTenant } from "../providers/tenant-provider";

export function TopBar({ onAbrirMenu }: { onAbrirMenu?: () => void }) {
  const tenant = useTenant();
  const nome = tenant.name?.trim() || tenant.email || "Administrador";
  const iniciais = nome
    .split(/\s+/)
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between px-4 sm:px-8 bg-white/50 backdrop-blur-md border-b border-white/20">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onAbrirMenu}
        aria-label="Abrir menu"
      >
        <Menu aria-hidden="true" className="w-6 h-6 text-slate-600" />
      </Button>
      <div className="flex-1" />
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200/60">
          <ShieldAlert aria-hidden="true" className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            Acesso Master
          </span>
        </div>
        <div className="flex items-center gap-3 pl-3 sm:pl-6 border-l border-slate-200">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-800">{nome}</p>
            <p className="text-xs text-slate-500 font-medium">
              {tenant.role || "Administrador"}
            </p>
          </div>
          <div
            aria-label={`Perfil de ${nome}`}
            className="w-10 h-10 rounded-full bg-slate-800 border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-xs"
          >
            {iniciais}
          </div>
        </div>
      </div>
    </header>
  );
}
