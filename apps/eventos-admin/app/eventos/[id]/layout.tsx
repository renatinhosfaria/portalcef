import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { serverFetch } from "@essencia/shared/fetchers/server";
import { WorkspaceShell, type WorkspaceReadiness } from "@/features/eventos/workspace-shell";

type Params = Promise<{ id: string }>;

export default async function EventoWorkspaceLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { id } = await params;
  let readiness: WorkspaceReadiness = { status: "RASCUNHO", progress: 0, items: [] };
  try {
    readiness = await serverFetch<WorkspaceReadiness>(`/eventos/admin/${id}/prontidao`, { cookies: (await cookies()).toString() });
  } catch { /* a etapa continua navegável enquanto a API estiver indisponível */ }
  return <WorkspaceShell eventId={id} readiness={readiness} saveState="idle">{children}</WorkspaceShell>;
}
