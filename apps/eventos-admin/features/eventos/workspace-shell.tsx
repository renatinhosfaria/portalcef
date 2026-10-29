import React from "react";
import type { ReactNode } from "react";
import Link from "next/link";
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

const readinessGroups: Record<string, string> = {
  informacoes: "informacoes", TEXTOS_OBRIGATORIOS: "informacoes", SLUG_VALIDO: "informacoes",
  sessoes: "sessoes", SESSAO_OBRIGATORIA: "sessoes", LOCAL_SESSAO: "sessoes",
  mapa: "mapa", MAPA_CONFIRMADO: "mapa", INVENTARIO_VENDAVEL: "mapa",
  ingressos: "ingressos", INGRESSO_VALIDO: "ingressos",
  politicas: "politicas", POLITICAS_OBRIGATORIAS: "politicas",
};

export function normalizarReadiness(eventId: string, source: WorkspaceReadinessItem[]): WorkspaceReadinessItem[] {
  const etapas: Array<[string, string, string]> = [
    ["informacoes", "Informações", "informacoes"], ["sessoes", "Sessões e local", "sessoes"],
    ["mapa", "Mapa e lugares", "mapa"], ["ingressos", "Ingressos", "ingressos"],
    ["politicas", "Políticas", "politicas"],
  ];
  const resultado: WorkspaceReadinessItem[] = etapas.map(([key, label, path]) => {
    const items = source.filter((item) => (readinessGroups[item.key] ?? item.key) === key);
    const state = items.some((item) => item.state === "BLOQUEADOR") ? "BLOQUEADOR" : items.some((item) => item.state === "AVISO") ? "AVISO" : items.length > 0 && items.every((item) => item.state === "OK") ? "OK" : items.length > 0 ? "EM_ANDAMENTO" : "NAO_INICIADO";
    const detail = items.find((item) => item.state === "BLOQUEADOR") ?? items[0];
    return { key, label, state, href: detail?.href ?? `/eventos/${eventId}/${path}`, message: detail?.message };
  });
  const bloqueadores = source.filter((item) => item.state === "BLOQUEADOR");
  resultado.push({ key: "revisar", label: "Revisar e publicar", state: bloqueadores.length ? "BLOQUEADOR" : source.length && source.every((item) => item.state === "OK") ? "OK" : "NAO_INICIADO", href: `/eventos/${eventId}/revisar`, message: bloqueadores[0]?.message });
  return resultado;
}

export function WorkspaceShell({ eventId, children, readiness, lastSavedAt, saveState }: { eventId: string; children: ReactNode; readiness: WorkspaceReadiness; lastSavedAt?: string | null; saveState: SaveState }) {
  const normalized = normalizarReadiness(eventId, readiness.items);
  const items: WorkspaceNavigationItem[] = normalized.map((item) => ({ key: item.key, label: item.label, href: item.href ?? `/eventos/${eventId}/${item.key}`, state: item.state as WorkspaceStepState, blocked: item.state === "BLOQUEADOR" }));
  const pending = normalized.find((item) => item.state === "BLOQUEADOR" && item.message);

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
            <Link className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d7c4a]" href={pending.href ?? `/eventos/${eventId}/revisar`}>
              {pending.message}
            </Link>
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
