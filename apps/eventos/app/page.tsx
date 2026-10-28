"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function EventosPage() {
  const [status, setStatus] = useState("Carregando eventos disponíveis para sua unidade…");
  useEffect(() => { fetch("/eventos/api/eventos/admin/eventos", { credentials: "include" }).then((r) => r.ok ? r.json() : Promise.reject()).then((data) => setStatus(Array.isArray(data) && data.length ? `${data.length} eventos encontrados.` : "Nenhum evento encontrado.")).catch(() => setStatus("Não foi possível carregar os eventos.")); }, []);
  return (
    <section aria-labelledby="eventos-dashboard-title" className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-medium text-slate-500">Portal CEF · Eventos</p><h1 id="eventos-dashboard-title" className="text-3xl font-semibold text-slate-900">Administração de eventos</h1><p className="mt-2 text-slate-600">Crie, revise e acompanhe vários eventos públicos da escola.</p></div>
        <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/eventos/novo">Novo evento</Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-8"><h2 className="text-lg font-semibold">Seus eventos</h2><p className="mt-2 text-sm text-slate-600">{status}</p><Link className="mt-4 inline-block text-sm font-medium text-slate-900 underline" href="/eventos">Abrir lista de eventos</Link></div>
    </section>
  );
}
