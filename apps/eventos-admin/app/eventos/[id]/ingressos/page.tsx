"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { assertRespostaApi, construirPayloadIngresso, ingressosProntosParaSalvar, type IngressoValue } from "@/features/eventos/etapas-contratos";
import { useEventoAutosave } from "@/features/eventos/use-evento-autosave";
import { CupomEditor } from "@/features/eventos/cupom-editor";
import { construirPayloadCupom, codigosCupomDuplicados, cupomInicial, cupomProntoParaSalvar, normalizarDataCupom, type CupomValue } from "@/features/eventos/cupons-contratos";

const normalizarCupons = (value: unknown): CupomValue[] => Array.isArray(value)
  ? (value as CupomValue[]).map((item) => ({ ...item, startsAt: normalizarDataCupom(item.startsAt), endsAt: normalizarDataCupom(item.endsAt) }))
  : [];

export default function IngressosPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<IngressoValue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const changeRevision = useRef(0);
  const [cupons, setCupons] = useState<CupomValue[]>([]);
  const [cuponsDirty, setCuponsDirty] = useState(false);
  const [cuponsLoading, setCuponsLoading] = useState(true);
  const [cuponsError, setCuponsError] = useState("");
  const [cuponsDeleteError, setCuponsDeleteError] = useState("");
  const cuponsRevision = useRef(0);

  useEffect(() => {
    fetch(`/eventos-admin/api/eventos/admin/${id}/ingressos`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((rows) => setItems(rows))
      .catch(() => setError("Não foi possível carregar os ingressos."));
  }, [id]);

  useEffect(() => {
    setCuponsLoading(true);
    fetch(`/eventos-admin/api/eventos/admin/${id}/cupons`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: unknown) => { const data = body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body; setCupons(normalizarCupons(data)); })
      .catch(() => setCuponsError("Não foi possível carregar os cupons."))
      .finally(() => setCuponsLoading(false));
  }, [id]);


  const autosave = useEventoAutosave({
    eventId: id,
    value: items,
    dirty: dirty && ingressosProntosParaSalvar(items),
    serialize: (values) => values.map(construirPayloadIngresso),
    save: async (payload, eventId) => {
      const revision = changeRevision.current;
      const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}/ingressos`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      assertRespostaApi({ ok: response.ok, status: response.status, body });
      queueMicrotask(() => {
        if (changeRevision.current === revision) {
          setItems((body.data ?? body) as IngressoValue[]);
          setDirty(false);
        }
      });
    },
    onSaved: () => router.refresh(),
    debounceMs: 700,
  });


  const cuponsAutosave = useEventoAutosave({
    eventId: id, value: cupons, dirty: !cuponsLoading && !cuponsError && cuponsDirty && cupomProntoParaSalvar(cupons) && codigosCupomDuplicados(cupons).length === 0, serialize: (value) => value.map(construirPayloadCupom),
    save: async (payload, eventId) => { const revision = cuponsRevision.current; const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}/cupons`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({})); assertRespostaApi({ ok: response.ok, status: response.status, body }); const data = body.data ?? body; queueMicrotask(() => { if (cuponsRevision.current === revision) { setCupons(normalizarCupons(data)); setCuponsDirty(false); } }); },
    onSaved: () => router.refresh(), debounceMs: 700,
  });

  const update = (index: number, value: Partial<IngressoValue>) => {
    changeRevision.current += 1;
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
    setDirty(true);
  };

  const remove = async (index: number) => {
    const item = items[index];
    if (!item || !window.confirm(`Excluir o ingresso "${item.name || "sem nome"}"?`)) return;

    changeRevision.current += 1;
    if (!item.id) {
      setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
      setDirty(true);
      return;
    }

    try {
      const response = await fetch(`/eventos-admin/api/eventos/admin/${id}/ingressos/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      assertRespostaApi({ ok: response.ok, status: response.status, body });
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setError("");
      router.refresh();
    } catch (removalError) {
      setError(removalError instanceof Error ? removalError.message : "Não foi possível excluir o ingresso.");
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Ingressos</h2>
        <p className="text-sm text-slate-600">Defina preço em centavos e as regras de cada tipo.</p>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button type="button" className="rounded border px-3 py-2" onClick={() => {
        changeRevision.current += 1;
        setItems((current) => [...current, { name: "", priceCents: 0, lugaresPorPacote: 1 }]);
        setDirty(true);
      }}>Adicionar ingresso</button>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id ?? index} className="rounded-xl border bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">{item.name || "Novo ingresso"}</span>
              <button
                type="button"
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                aria-label={`Excluir ingresso ${item.name || "sem nome"}`}
                onClick={() => void remove(index)}
              >
                Excluir ingresso
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input aria-label="Nome do ingresso" value={item.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Nome" />
              <input aria-label="Preço em centavos" type="number" min="0" value={item.priceCents} onChange={(event) => update(index, { priceCents: Number(event.target.value) })} />
              <input aria-label="Lugares por pacote" type="number" min="1" step="1" value={item.lugaresPorPacote ?? 1} onChange={(event) => update(index, { lugaresPorPacote: Number(event.target.value) })} />
              {(item.lugaresPorPacote ?? 1) > 1 && <p className="text-sm text-slate-600">Preço total do pacote</p>}
              {(!Number.isInteger(item.lugaresPorPacote ?? 1) || (item.lugaresPorPacote ?? 1) < 1) && <p role="alert" className="text-sm text-red-700">Informe uma quantidade inteira de lugares maior que zero.</p>}
              {item.maxPerOrder != null && item.maxPerOrder < (item.lugaresPorPacote ?? 1) && <p role="status" className="text-sm text-amber-700">O limite configurado não permite comprar um pacote completo.</p>}
              <input aria-label="Elegibilidade" value={item.eligibility ?? ""} onChange={(event) => update(index, { eligibility: event.target.value })} placeholder="Elegibilidade" />
              <input aria-label="Lote de venda" value={item.salesLot ?? ""} onChange={(event) => update(index, { salesLot: event.target.value })} placeholder="Lote de venda" />
              <input aria-label="Regras" value={item.rules?.descricao ? String(item.rules.descricao) : ""} onChange={(event) => update(index, { rules: { ...(item.rules ?? {}), descricao: event.target.value } })} placeholder="Regras" />
              <input aria-label="Limite de lugares deste tipo por pedido (opcional)" type="number" min="1" value={item.maxPerOrder ?? ""} onChange={(event) => update(index, { maxPerOrder: event.target.value ? Number(event.target.value) : null })} placeholder="Limite" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500" role="status">{autosave.state === "saving" ? "Salvando…" : autosave.state === "saved" ? "Ingressos salvos automaticamente" : ""}</p>
      <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="cupons-heading">
        <div><h2 id="cupons-heading" className="text-xl font-semibold">Cupons de desconto</h2><p className="text-sm text-slate-600">Cadastre vários cupons, limites e vigência. Alterações são versionadas automaticamente.</p></div>
        {cuponsLoading && <p role="status">Carregando cupons…</p>}{cuponsError && <p role="alert" className="text-red-700">{cuponsError}</p>}{cuponsDeleteError && <p role="alert" className="text-red-700">{cuponsDeleteError}</p>}
        {!cuponsLoading && cupons.map((cupom, index) => <CupomEditor key={cupom.id ?? `novo-${index}`} value={cupom} disabled={Boolean(cuponsError) || cuponsAutosave.state === "saving"} onChange={(next) => { cuponsRevision.current += 1; setCupons(current => current.map((item, itemIndex) => itemIndex === index ? next : item)); setCuponsDirty(true); }} onDelete={async () => { cuponsRevision.current += 1; cuponsAutosave.invalidate(); const remaining = cupons.filter((_, itemIndex) => itemIndex !== index); if (!cupom.id) { setCupons(remaining); setCuponsDirty(remaining.length > 0); return; } try { const response = await fetch(`/eventos-admin/api/eventos/admin/${id}/cupons/${cupom.id}`, { method: "DELETE", credentials: "include" }); const body = await response.json(); assertRespostaApi({ ok: response.ok, status: response.status, body }); setCuponsDeleteError(""); setCupons(remaining); setCuponsDirty(remaining.length > 0); router.refresh(); } catch (deleteError) { setCuponsDeleteError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o cupom."); setCuponsDirty(false); queueMicrotask(() => setCuponsDirty(true)); } }} />)}
        <button type="button" className="rounded border px-3 py-2" disabled={cuponsLoading || Boolean(cuponsError)} onClick={() => { cuponsRevision.current += 1; setCupons(current => [...current, { ...cupomInicial }]); setCuponsDirty(true); }}>Adicionar cupom</button>
        {!cuponsLoading && <p role="status" className="text-sm text-slate-500">{cuponsDirty && !cupomProntoParaSalvar(cupons) ? "Revise os cupons antes de salvar." : cuponsAutosave.state === "saving" ? "Salvando cupons…" : cuponsAutosave.state === "saved" ? "Cupons salvos automaticamente" : cuponsAutosave.state === "conflict" ? "Conflito de versão dos cupons; recarregue para revisar." : ""}</p>}
        {codigosCupomDuplicados(cupons).length > 0 && <p role="alert" className="text-red-700">Código de cupom duplicado: {codigosCupomDuplicados(cupons).join(", ")}</p>}
      </section>
    </section>
  );
}
