"use client";

import { Button } from "@essencia/ui/components/button";
import { Menu, Search, ShieldAlert } from "lucide-react";

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between px-8 bg-white/50 backdrop-blur-md border-b border-white/20">
      <div className="flex items-center gap-4 lg:hidden">
        <Button variant="ghost" size="icon">
          <Menu className="w-6 h-6 text-slate-600" />
        </Button>
      </div>

      <div className="flex-1 max-w-xl hidden md:block">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
          <input
            type="text"
            placeholder="Buscar escolas, unidades ou códigos..."
            className="w-full h-11 pl-12 pr-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:bg-white focus:border-slate-900/20 focus:ring-4 focus:ring-slate-900/5 outline-none transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200/60">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            Acesso Master
          </span>
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-800">Administrador</p>
            <p className="text-xs text-slate-500 font-medium">Controle Total</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-white shadow-md overflow-hidden p-0.5">
            {/* Master Avatar Placeholder */}
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
              MST
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
