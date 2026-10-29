import type { ReactNode } from "react";
import { WorkspaceShell, type WorkspaceReadiness } from "@/features/eventos/workspace-shell";

type Params = Promise<{ id: string }>;

export default async function EventoWorkspaceLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { id } = await params;
  let readiness: WorkspaceReadiness = { status: "RASCUNHO", progress: 0, items: [] };
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://api:3001"}/eventos/admin/${id}/prontidao`, { cache: "no-store", credentials: "include" });
    if (response.ok) readiness = await response.json();
  } catch { /* a etapa continua navegável enquanto a API estiver indisponível */ }
  return <WorkspaceShell eventId={id} readiness={readiness} saveState="idle">{children}</WorkspaceShell>;
}
