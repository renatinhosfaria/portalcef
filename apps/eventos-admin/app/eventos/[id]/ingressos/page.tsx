"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { assertRespostaApi, construirPayloadIngresso, ingressosProntosParaSalvar, type IngressoValue } from "@/features/eventos/etapas-contratos";
import { OfertaEditor } from "@/features/eventos/oferta-editor";
import { construirPayloadOferta, ofertaInicial, ofertaProntaParaSalvar, type OfertaValue } from "@/features/eventos/ofertas-contratos";
import { useEventoAutosave } from "@/features/eventos/use-evento-autosave";
import { CupomEditor } from "@/features/eventos/cupom-editor";
import { construirPayloadCupom, codigosCupomDuplicados, cupomInicial, cupomProntoParaSalvar, normalizarDataCupom, type CupomValue } from "@/features/eventos/cupons-contratos";

export default function IngressosPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<IngressoValue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [oferta, setOferta] = useState<OfertaValue>(ofertaInicial);
  const [ofertasArquivadas, setOfertasArquivadas] = useState<OfertaValue[]>([]);
  const [ofertaDirty, setOfertaDirty] = useState(false);
  const [ofertaLoading, setOfertaLoading] = useState(true);
  const [ofertaLoaded, setOfertaLoaded] = useState(false);
  const [ofertaError, setOfertaError] = useState("");
  const changeRevision = useRef(0);
  const ofertaRevision = useRef(0);
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
      .then((body: unknown) => { const data = body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body; setCupons(Array.isArray(data) ? (data as CupomValue[]).map((item) => ({ ...item, startsAt: normalizarDataCupom(item.startsAt), endsAt: normalizarDataCupom(item.endsAt) })) : []); })
      .catch(() => setCuponsError("Não foi possível carregar os cupons."))
      .finally(() => setCuponsLoading(false));
  }, [id]);

  useEffect(() => {
    setOfertaLoading(true);
    setOfertaLoaded(false);
    setOfertaError("");
    fetch(`/eventos-admin/api/eventos/admin/${id}/ofertas`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: unknown) => {
        const data = body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body;
        const rows = Array.isArray(data) ? data as OfertaValue[] : [];
        const active = rows.find((row) => row.active);
        setOferta(active ?? ofertaInicial);
        setOfertasArquivadas(rows.filter((row) => !row.active));
        setOfertaLoaded(true);
      })
      .catch(() => setOfertaError("Não foi possível carregar as ofertas."))
      .finally(() => setOfertaLoading(false));
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

  const ofertaAutosave = useEventoAutosave({
    eventId: id,
    value: oferta,
    dirty: ofertaLoaded && !ofertaError && ofertaDirty && ofertaProntaParaSalvar(oferta),
    serialize: (value) => [construirPayloadOferta(value)],
    save: async (payload, eventId) => {
      const revision = ofertaRevision.current;
      const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}/ofertas`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      assertRespostaApi({ ok: response.ok, status: response.status, body });
      const data = body.data ?? body;
      const saved = (Array.isArray(data) ? data[0] : data) as OfertaValue | undefined;
      if (!saved) throw new Error("A API não retornou a oferta salva.");
      queueMicrotask(() => {
        if (ofertaRevision.current === revision) {
          setOfertasArquivadas((current) => [
            ...(oferta.id ? [{ ...oferta, active: false }] : []),
            ...current.filter((item) => item.id !== saved.id),
          ]);
          setOferta(saved);
          setOfertaDirty(false);
        }
      });
    },
    onSaved: () => router.refresh(),
    debounceMs: 700,
  });

  const cuponsAutosave = useEventoAutosave({
    eventId: id, value: cupons, dirty: !cuponsLoading && !cuponsError && cuponsDirty && cupomProntoParaSalvar(cupons) && codigosCupomDuplicados(cupons).length === 0, serialize: (value) => value.map(construirPayloadCupom),
    save: async (payload, eventId) => { const revision = cuponsRevision.current; const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}/cupons`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({})); assertRespostaApi({ ok: response.ok, status: response.status, body }); const data = body.data ?? body; queueMicrotask(() => { if (cuponsRevision.current === revision) { setCupons(Array.isArray(data) ? data as CupomValue[] : []); setCuponsDirty(false); } }); },
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
        setItems((current) => [...current, { name: "", priceCents: 0 }]);
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
              <input aria-label="Elegibilidade" value={item.eligibility ?? ""} onChange={(event) => update(index, { eligibility: event.target.value })} placeholder="Elegibilidade" />
              <input aria-label="Lote de venda" value={item.salesLot ?? ""} onChange={(event) => update(index, { salesLot: event.target.value })} placeholder="Lote de venda" />
              <input aria-label="Regras" value={item.rules?.descricao ? String(item.rules.descricao) : ""} onChange={(event) => update(index, { rules: { ...(item.rules ?? {}), descricao: event.target.value } })} placeholder="Regras" />
              <input aria-label="Limite por pedido" type="number" min="1" value={item.maxPerOrder ?? ""} onChange={(event) => update(index, { maxPerOrder: event.target.value ? Number(event.target.value) : null })} placeholder="Limite" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500" role="status">{autosave.state === "saving" ? "Salvando…" : autosave.state === "saved" ? "Ingressos salvos automaticamente" : ""}</p>
      <section className="space-y-4 border-t border-slate-200 pt-5" aria-labelledby="ofertas-heading">
        <div>
          <h2 id="ofertas-heading" className="text-xl font-semibold">Descontos e ofertas</h2>
          <p className="text-sm text-slate-600">Configure uma única oferta ativa para pedidos com vários lugares. A API versiona cada salvamento.</p>
        </div>
        {ofertaLoading && <p className="text-sm text-slate-600" role="status">Carregando oferta…</p>}
        {ofertaError && <p className="text-sm text-red-700" role="alert">{ofertaError}</p>}
        <OfertaEditor initialValue={oferta} disabled={ofertaLoading || Boolean(ofertaError) || ofertaAutosave.state === "saving"} onChange={(next) => {
          if (!ofertaLoaded || ofertaError) return;
          ofertaRevision.current += 1;
          setOferta(next);
          setOfertaDirty(true);
        }} />
        {ofertasArquivadas.length > 0 && (
          <div className="space-y-2" aria-label="Ofertas arquivadas">
            <h3 className="text-sm font-medium text-slate-700">Histórico</h3>
            {ofertasArquivadas.map((item) => (
              <p key={`${item.id ?? "arquivada"}-${item.version ?? 0}`} className="text-sm text-slate-500">Oferta arquivada · {item.name} · versão {item.version ?? "—"}</p>
            ))}
          </div>
        )}
        <p className="text-sm text-slate-500" role="status">
          {ofertaLoading ? "Carregando oferta…" : ofertaError ? "A oferta está bloqueada até o carregamento ser concluído." : ofertaDirty && !ofertaProntaParaSalvar(oferta) ? "Revise a oferta antes de salvar." : ofertaAutosave.state === "saving" ? "Salvando oferta…" : ofertaAutosave.state === "saved" ? "ofertas salvas automaticamente" : ofertaAutosave.state === "conflict" ? "Conflito de edição da oferta; recarregue para revisar." : ofertaAutosave.state === "error" ? "Não foi possível salvar a oferta." : ""}
        </p>
      </section>
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
