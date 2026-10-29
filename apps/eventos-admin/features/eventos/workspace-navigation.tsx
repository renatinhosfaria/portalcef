import React from "react";
import Link from "next/link";

export type WorkspaceStepState = "NAO_INICIADO" | "EM_ANDAMENTO" | "OK" | "BLOQUEADOR" | "AVISO";
export type WorkspaceNavigationItem = {
  key: string;
  label: string;
  href: string;
  state: WorkspaceStepState;
  blocked?: boolean;
};

const stateLabels: Record<WorkspaceStepState, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_ANDAMENTO: "Em andamento",
  OK: "Pronto",
  BLOQUEADOR: "Pendente",
  AVISO: "Aviso",
};

export function WorkspaceNavigation({ eventId: _eventId, items, activeKey = "informacoes" }: { eventId: string; items: WorkspaceNavigationItem[]; activeKey?: string }) {
  return (
    <nav aria-label="Etapas do evento" className="rounded-2xl border border-[#dbe5d8] bg-white p-3 shadow-sm">
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5e7563]">Workspace do evento</p>
      <ol className="space-y-1">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#3d7c4a] ${active ? "bg-[#eaf3e8] font-semibold text-[#245432]" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <span>{item.label}</span>
                <span className={`shrink-0 text-xs ${item.blocked || item.state === "BLOQUEADOR" ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                  {stateLabels[item.state]}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
