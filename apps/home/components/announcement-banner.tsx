"use client";

import { Megaphone } from "lucide-react";

export function AnnouncementBanner() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Megaphone className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">
          Mural de Avisos
        </h3>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        Nenhum aviso publicado.
      </div>
    </div>
  );
}
