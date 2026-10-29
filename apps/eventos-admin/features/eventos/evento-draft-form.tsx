"use client";

import { useState } from "react";
import type { EventoResumo } from "@essencia/shared/types";

type Navigate = (href: string) => void;
export async function createDraft(title: string): Promise<EventoResumo> {
  const response = await fetch("/eventos-admin/api/eventos/admin/rascunhos", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title.trim() }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.error?.message ?? "Não foi possível criar o rascunho.");
  return (body.data ?? body) as EventoResumo;
}

export async function saveDraft(eventId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.error?.message ?? "Não foi possível salvar o rascunho.");
  return body.data ?? body;
}

export function EventoDraftForm({ navigate = (href) => { window.location.assign(href); } }: { navigate?: Navigate }) {
  const [title, setTitle] = useState("");
  const [created, setCreated] = useState<EventoResumo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    const validTitle = title.trim();
    if (!validTitle || loading || created) return;
    setLoading(true); setError("");
    try {
      const draft = await createDraft(validTitle);
      setCreated(draft);
      navigate(`/eventos/${draft.id}/informacoes`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o rascunho.");
    } finally { setLoading(false); }
  }
  return <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6">
    <label className="block text-sm font-medium" htmlFor="evento-titulo">Título</label>
    <input id="evento-titulo" aria-label="Título" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título do evento" className="w-full rounded border p-2" disabled={loading || Boolean(created)} />
    {created ? <p className="text-sm text-slate-600">Slug criado: <strong>{created.slug}</strong></p> : null}
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    <button type="button" onClick={() => void submit()} disabled={!title.trim() || loading || Boolean(created)} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{loading ? "Criando…" : "Continuar"}</button>
  </div>;
}
