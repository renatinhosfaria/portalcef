"use client";

import { AlertTriangle, Info, Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  type: "info" | "warning" | "urgent";
  message: string;
  date: string;
}

const mockAnnouncements: Announcement[] = [
  {
    id: "1",
    type: "urgent",
    message: "Manutenção programada do sistema: Sábado (10/06) das 22h às 00h.",
    date: "Hoje",
  },
  {
    id: "2",
    type: "info",
    message: "O período de rematrículas para 2024 já está aberto.",
    date: "Ontem",
  },
];

export function AnnouncementBanner() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Megaphone className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">
          Mural de Avisos
        </h3>
      </div>

      <div className="space-y-2">
        {mockAnnouncements.map((item) => {
          const isUrgent = item.type === "urgent";
          const isWarning = item.type === "warning";

          return (
            <div
              key={item.id}
              className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                isUrgent
                  ? "bg-rose-50 border-rose-100 text-rose-900"
                  : isWarning
                    ? "bg-amber-50 border-amber-100 text-amber-900"
                    : "bg-blue-50 border-blue-100 text-blue-900"
              }`}
            >
              {isUrgent ? (
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              ) : (
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium leading-tight">
                  {item.message}
                </p>
                <p className="text-xs opacity-60 mt-1 font-semibold">
                  {item.date}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
