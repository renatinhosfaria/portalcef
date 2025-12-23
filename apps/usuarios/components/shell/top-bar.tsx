"use client";

import { Button } from "@essencia/ui/components/button";
import { Bell, Menu, Search } from "lucide-react";

import { useTenant } from "@essencia/shared/providers/tenant";

export function TopBar() {
  const { role } = useTenant();

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
            placeholder="Buscar usuários..."
            className="w-full h-11 pl-12 pr-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:bg-white focus:border-[#A3D154]/50 focus:ring-4 focus:ring-[#A3D154]/10 outline-none transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
      </div>
    </header>
  );
}
