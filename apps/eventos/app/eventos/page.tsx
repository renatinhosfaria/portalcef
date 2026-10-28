"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function EventosListPage() {
  const [events, setEvents] = useState<Array<{id:string; title:string; status?:string}>>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(() => { fetch("/eventos/api/eventos/admin", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()).then(d => setEvents(Array.isArray(d) ? d : d.items ?? [])).catch(() => setError("Não foi possível carregar os eventos.")).finally(() => setLoading(false)); }, []);
  return <section className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">Eventos</h1><p className="text-sm text-slate-600">Todos os eventos da sua unidade e tenant.</p></div><Link href="/eventos/novo" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">Novo evento</Link></div><div className="rounded-xl border border-slate-200 bg-white p-8">{loading ? <p>Carregando eventos…</p> : error ? <p role="alert" className="text-red-700">{error}</p> : events.length ? <ul className="space-y-2">{events.map(e => <li key={e.id}><Link className="font-medium underline" href={`/eventos/${e.id}`}>{e.title}</Link>{e.status && <span className="ml-2 text-sm text-slate-500">{e.status}</span>}</li>)}</ul> : <p className="text-slate-600">Nenhum evento carregado ainda.</p>}</div></section>;
}
