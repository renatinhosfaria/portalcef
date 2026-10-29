import type { ReactNode } from "react";
import { WorkspaceShell, type WorkspaceReadiness } from "@/features/eventos/workspace-shell";

type Params = Promise<{ id: string }>;

const readinessBase: WorkspaceReadiness = {
  status: "RASCUNHO",
  progress: 0,
  items: [],
};

export default async function EventoWorkspaceLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { id } = await params;
  return <WorkspaceShell eventId={id} readiness={readinessBase} saveState="idle">{children}</WorkspaceShell>;
}
