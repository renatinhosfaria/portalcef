"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { assertRespostaApi, construirPayloadIngresso, ingressosProntosParaSalvar, type IngressoValue } from "@/features/eventos/etapas-contratos";
import { OfertaEditor } from "@/features/eventos/oferta-editor";
import { construirPayloadOferta, ofertaInicial, ofertaProntaParaSalvar, type OfertaValue } from "@/features/eventos/ofertas-contratos";
import { useEventoAutosave } from "@/features/eventos/use-evento-autosave";

export default function IngressosPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<IngressoValue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [oferta, setOferta] = useState<OfertaValue>(ofertaInicial);
  const [ofertasArquivadas, setOfertasArquivadas] = useState<OfertaValue[]>([]);
  const [ofertaDirty, setOfertaDirty] = useState(false);
  const changeRevision = useRef(0);
  const ofertaRevision = useRef(0);

  useEffect(() => {
    fetch(`/eventos-admin/api/eventos/admin/${id}/ingressos`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((rows) => setItems(rows))
      .catch(() => setError("Não foi possível carregar os ingressos."));
  }, [id]);

  useEffect(() => {
    fetch(`/eventos-admin/api/eventos/admin/${id}/ofertas`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: unknown) => {
        const data = body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body;
        const rows = Array.isArray(data) ? data as OfertaValue[] : [];
        const active = rows.find((row) => row.active);
        setOferta(active ?? ofertaInicial);
        setOfertasArquivadas(rows.filter((row) => !row.active));
      })
      .catch(() => setError("Não foi possível carregar as ofertas."));
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
    dirty: ofertaDirty && ofertaProntaParaSalvar(oferta),
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
        <OfertaEditor initialValue={oferta} disabled={ofertaAutosave.state === "saving"} onChange={(next) => {
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
          {ofertaDirty && !ofertaProntaParaSalvar(oferta) ? "Revise a oferta antes de salvar." : ofertaAutosave.state === "saving" ? "Salvando oferta…" : ofertaAutosave.state === "saved" ? "ofertas salvas automaticamente" : ofertaAutosave.state === "conflict" ? "Conflito de edição da oferta; recarregue para revisar." : ofertaAutosave.state === "error" ? "Não foi possível salvar a oferta." : ""}
        </p>
      </section>
    </section>
  );
}
