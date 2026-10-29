"use client";

import { useEffect, useState } from "react";
import { PublicationChecklist, formatPublicationError, type PublicationError, type PublicationItem } from "@/features/eventos/publication-checklist";

type Readiness = { status: string; items: PublicationItem[] };

export default function EventoDetailPage({ params }: { params: { id: string } }) {
  const [readiness, setReadiness] = useState<Readiness>({ status: "RASCUNHO", items: [] });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<PublicationError | null>(null);
  useEffect(() => { let active = true; void fetch(`/eventos-admin/api/eventos/admin/${params.id}/prontidao`, { credentials: "include" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw Object.assign(new Error(body.error?.message), { status: response.status, code: body.error?.code }); const data = body.data ?? body; if (active) setReadiness({ status: data.status, items: data.items ?? [] }); }).catch((reason) => { if (active) setError(formatPublicationError(reason)); }); return () => { active = false; }; }, [params.id]);
  async function publish() { setPublishing(true); setError(null); try { const response = await fetch(`/eventos-admin/api/eventos/admin/${params.id}/publicar`, { method: "POST", credentials: "include" }); const body = await response.json().catch(() => ({})); if (!response.ok || body.success === false) throw formatPublicationError({ status: response.status, code: body.error?.code, message: body.error?.message }); setReadiness((current) => ({ ...current, status: "PUBLICADO" })); } catch (reason) { setError(formatPublicationError(reason as PublicationError)); const refresh = await fetch(`/eventos-admin/api/eventos/admin/${params.id}/prontidao`, { credentials: "include" }).catch(() => null); if (refresh?.ok) { const body = await refresh.json(); const data = body.data ?? body; setReadiness({ status: data.status, items: data.items ?? [] }); } } finally { setPublishing(false); } }
  return <PublicationChecklist items={readiness.items} status={readiness.status} error={error} publishing={publishing} onPublish={publish} />;
}
