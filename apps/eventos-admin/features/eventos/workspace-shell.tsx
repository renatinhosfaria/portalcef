import React from "react";
import type { ReactNode } from "react";
import { WorkspaceNavigation, type WorkspaceNavigationItem, type WorkspaceStepState } from "./workspace-navigation";
import { WorkspaceStatus, type SaveState, type WorkspaceEventStatus } from "./workspace-status";

export type WorkspaceReadinessItem = {
  key: string;
  label: string;
  state: "OK" | "BLOQUEADOR" | "AVISO" | "NAO_INICIADO" | "EM_ANDAMENTO";
  href?: string;
  message?: string;
};

export type WorkspaceReadiness = {
  status: WorkspaceEventStatus;
  progress?: number;
  items: WorkspaceReadinessItem[];
};

const etapas: Array<{ key: string; label: string; path: string }> = [
  { key: "informacoes", label: "Informações", path: "informacoes" },
  { key: "sessoes", label: "Sessões e local", path: "sessoes" },
  { key: "mapa", label: "Mapa e lugares", path: "mapa" },
  { key: "ingressos", label: "Ingressos", path: "ingressos" },
  { key: "politicas", label: "Políticas", path: "politicas" },
  { key: "revisar", label: "Revisar e publicar", path: "revisar" },
];

export function WorkspaceShell({ eventId, children, readiness, lastSavedAt, saveState }: { eventId: string; children: ReactNode; readiness: WorkspaceReadiness; lastSavedAt?: string | null; saveState: SaveState }) {
  const items: WorkspaceNavigationItem[] = etapas.map((etapa) => {
    const readinessItem = readiness.items.find((item) => item.key === etapa.key);
    return {
      key: etapa.key,
      label: etapa.label,
      href: readinessItem?.href ?? `/eventos/${eventId}/${etapa.path}`,
      state: (readinessItem?.state ?? "NAO_INICIADO") as WorkspaceStepState,
      blocked: readinessItem?.state === "BLOQUEADOR",
    };
  });
  const pending = readiness.items.find((item) => item.state === "BLOQUEADOR" && item.message);

  return (
    <div className="workspace-shell space-y-6">
      <header className="rounded-2xl border border-[#dbe5d8] bg-[#f8fbf7] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#3d7c4a]">Portal CEF · Eventos</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Workspace do evento</h1>
            <p className="mt-1 text-sm text-slate-600">Organize as etapas, acompanhe pendências e publique com segurança.</p>
          </div>
          <WorkspaceStatus status={readiness.status} saveState={saveState} lastSavedAt={lastSavedAt} />
        </div>
        {pending ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            <a className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d7c4a]" href={pending.href ?? `/eventos/${eventId}/revisar`}>
              {pending.message}
            </a>
          </p>
        ) : null}
      </header>
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <WorkspaceNavigation eventId={eventId} items={items} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
