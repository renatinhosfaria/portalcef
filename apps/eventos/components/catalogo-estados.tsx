import React from "react";

export function CatalogoEstados({ kind, onRetry, loading = false }: { kind: "empty" | "error"; onRetry?: () => void; loading?: boolean }): React.JSX.Element {
  if (kind === "error") {
    return <div role="alert" className="rounded-2xl border border-[var(--line)] bg-[var(--aviso-fundo)] p-6 text-[var(--aviso-texto)]"><p className="font-semibold">Não foi possível carregar os eventos.</p><p className="mt-2 text-sm">Tente novamente em alguns instantes.</p>{onRetry && <button type="button" onClick={onRetry} disabled={loading} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--acao)] px-4 py-2 font-semibold text-white disabled:opacity-60">{loading ? "Tentando novamente…" : "Tentar novamente"}</button>}</div>;
  }
  return <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-card)] p-10 text-center"><p className="font-display text-2xl font-semibold">Nenhum evento disponível</p><p className="mt-2 text-[var(--ink-muted)]">Volte em breve para conferir a próxima programação.</p></div>;
}
