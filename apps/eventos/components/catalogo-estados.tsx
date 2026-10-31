import React from "react";

export function CatalogoEstados({ kind }: { kind: "empty" | "error" }): React.JSX.Element {
  if (kind === "error") {
    return <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">Não foi possível carregar os eventos. Tente novamente mais tarde.</p>;
  }
  return <p className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center text-[var(--ink-muted)]">Nenhum evento disponível no momento.</p>;
}
