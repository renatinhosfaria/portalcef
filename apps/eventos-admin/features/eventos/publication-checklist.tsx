"use client";

export type PublicationItem = { key: string; label: string; state: "BLOQUEADOR" | "AVISO" | "OK"; href?: string; message?: string };
export type PublicationError = { status?: number; code?: string; message?: string };

export function canPublish(items: PublicationItem[]) {
  return items.length > 0 && items.every((item) => item.state !== "BLOQUEADOR");
}

export function formatPublicationError(error: PublicationError) {
  return { status: error.status ?? 400, code: error.code ?? "PUBLICATION_ERROR", message: error.message ?? "Não foi possível publicar o evento." };
}

export function PublicationChecklist({ items, onPublish, publishing, status, error }: { items: PublicationItem[]; onPublish: () => void; publishing?: boolean; status?: string; error?: PublicationError | null }) {
  const ready = canPublish(items);
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="checklist-publicacao">
    <div><h1 id="checklist-publicacao" className="text-xl font-semibold">Revisar e publicar</h1><p className="text-sm text-slate-600">A API valida novamente todos os requisitos no momento da publicação.</p></div>
    {status === "PUBLICADO" && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-800">Evento publicado.</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error.message ?? "Não foi possível publicar o evento."}</p>}
    <ul className="space-y-2">{items.map((item) => <li key={item.key} className="flex items-start justify-between gap-4 rounded border p-3"><div><p className="font-medium">{item.label}</p>{item.message && <p className="text-sm text-slate-600">{item.message}</p>}</div><span className={item.state === "BLOQUEADOR" ? "text-red-700" : item.state === "AVISO" ? "text-amber-700" : "text-emerald-700"}>{item.state}</span></li>)}</ul>
    <button type="button" disabled={!ready || publishing || status === "PUBLICADO"} onClick={onPublish} className="rounded bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50">{publishing ? "Publicando…" : status === "PUBLICADO" ? "Publicado" : "Publicar evento"}</button>
  </section>;
}
