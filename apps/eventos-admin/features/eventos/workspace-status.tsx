import React from "react";
export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
export type WorkspaceEventStatus = "RASCUNHO" | "PUBLICADO" | "PAUSADO" | "CANCELADO";

const saveMessages: Record<SaveState, string> = {
  idle: "Alterações locais",
  saving: "Salvando…",
  saved: "Salvo agora",
  error: "Não foi possível salvar",
  conflict: "Conflito de versão — revise as alterações",
};

export function WorkspaceStatus({
  status,
  saveState,
  lastSavedAt,
}: {
  status: WorkspaceEventStatus;
  saveState: SaveState;
  lastSavedAt?: string | null;
}) {
  const saveMessage = saveMessages[saveState];
  const savedAt = lastSavedAt && saveState === "saved"
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSavedAt))
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Status do evento">
      <span className="rounded-full border border-[#b8c9b2] bg-[#eef5ec] px-3 py-1 font-semibold tracking-wide text-[#315d3a]">
        {status}
      </span>
      <span role="status" className={saveState === "error" || saveState === "conflict" ? "text-red-700" : "text-slate-600"}>
        {saveMessage}{savedAt ? ` · ${savedAt}` : ""}
      </span>
    </div>
  );
}
