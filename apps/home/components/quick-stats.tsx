"use client";

import { Card } from "@essencia/ui/components/card";
import { TrendingUp, Users } from "lucide-react";

export function QuickStats() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="p-4 bg-emerald-500 text-white border-none shadow-lg shadow-emerald-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <Users className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Alunos
            </span>
          </div>
          <div className="text-2xl font-black">1,245</div>
          <div className="text-xs opacity-75 mt-1">Total Ativos</div>
        </div>
        <Users className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 rotate-12 group-hover:scale-110 transition-transform" />
      </Card>

      <Card className="p-4 bg-white border-slate-200 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Frequência
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800">96.8%</div>
          <div className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
            +2.4% <span className="text-slate-400 font-normal">vs. ontem</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
