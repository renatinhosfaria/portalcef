import React from "react";

export function CatalogoEstados({ kind, onRetry, loading = false }: { kind: "empty" | "error"; onRetry?: () => void; loading?: boolean }): React.JSX.Element {
  if (kind === "error") {
    return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p>Não foi possível carregar os eventos.</p>{onRetry && <button type="button" onClick={onRetry} disabled={loading} className="mt-4 rounded-full bg-red-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{loading ? "Tentando novamente…" : "Tentar novamente"}</button>}</div>;
  }
  return <p className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center text-[var(--ink-muted)]">Nenhum evento disponível no momento.</p>;
}
