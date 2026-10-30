"use client";

import React, { useState } from "react";
import {
  construirPayloadLocal,
  construirPayloadPadrao,
  criarErroApi,
  normalizarLocalResposta,
  validarLocal,
  type EventoLocalDraft,
  type EventoLocalOption,
  type RespostaApiErro,
} from "./event-location-contracts";

export type { EventoLocalDraft, EventoLocalOption } from "./event-location-contracts";

export type EventLocationManagerProps = {
  eventId: string;
  initialItems: EventoLocalOption[];
  initialDefaultLocationId: string | null;
  initialUpdatedAt: string | null;
  onChanged(): void;
};

type AcaoEmAndamento = "local" | "padrao" | null;

const vazio: EventoLocalDraft = {
  name: "",
  address: "",
  room: null,
  instructions: null,
  accessibility: null,
};

function respostaData(value: unknown): unknown {
  const envelope = value as { success?: unknown; data?: unknown } | null;
  if (!envelope || envelope.success !== true) throw new Error("Resposta da API inválida.");
  return envelope.data;
}

async function chamarApi(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || (body as { success?: unknown }).success !== true) {
    throw criarErroApi(response.status, body);
  }
  return body;
}

function mensagemErro(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Não foi possível salvar o local. Seus dados continuam no formulário.";
}

function eConflito(error: unknown): boolean {
  const candidate = error as RespostaApiErro | null;
  return candidate?.status === 409 || candidate?.code === "VERSION_CONFLICT";
}

function draftDoLocal(item: EventoLocalOption): EventoLocalDraft {
  return {
    name: item.name,
    address: item.address,
    room: item.room,
    instructions: item.instructions,
    accessibility: item.accessibility,
  };
}

export function EventLocationManager({
  eventId,
  initialItems,
  initialDefaultLocationId,
  initialUpdatedAt,
  onChanged,
}: EventLocationManagerProps) {
  const initialDefault = initialDefaultLocationId ?? initialItems.find((item) => item.isDefault)?.id ?? null;
  const [items, setItems] = useState<EventoLocalOption[]>(() => initialItems.map((item) => ({ ...item, isDefault: item.id === initialDefault })));
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(initialDefault);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [draft, setDraft] = useState<EventoLocalDraft>(vazio);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(initialItems.length === 0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"name" | "address", string>>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState<AcaoEmAndamento>(null);

  const abrirNovo = () => {
    setEditingId(null);
    setDraft(vazio);
    setErrors({});
    setErrorMessage("");
    setConflict(false);
    setAdvancedOpen(false);
    setFormOpen(true);
  };

  const abrirEdicao = (item: EventoLocalOption) => {
    setEditingId(item.id);
    setDraft(draftDoLocal(item));
    setErrors({});
    setErrorMessage("");
    setConflict(false);
    setAdvancedOpen(false);
    setFormOpen(true);
  };

  const fecharFormulario = () => {
    if (busy) return;
    setFormOpen(false);
    setEditingId(null);
    setErrors({});
    setErrorMessage("");
    setConflict(false);
  };

  const salvarLocal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validarLocal(draft);
    setErrors(validation.errors);
    setErrorMessage("");
    setConflict(false);
    if (!validation.ok) return;
    setBusy("local");
    try {
      const payload = { ...construirPayloadLocal(draft), ...(editingId && updatedAt ? { expectedUpdatedAt: updatedAt } : {}) };
      const body = await chamarApi(
        `/eventos-admin/api/eventos/admin/${eventId}/locais${editingId ? `/${editingId}` : ""}`,
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      const data = respostaData(body);
      const item = normalizarLocalResposta(data, defaultLocationId);
      if (editingId) {
        setItems((current) => current.map((value) => (value.id === editingId ? { ...item, isDefault: value.id === defaultLocationId } : value)));
      } else {
        setItems((current) => [...current, { ...item, isDefault: false }]);
      }
      setFormOpen(false);
      setEditingId(null);
      setDraft(vazio);
      setErrors({});
      setErrorMessage("");
      setConflict(false);
      // A API de local devolve a versão da linha, não a versão do evento.
      // O próximo salvamento sem versão deixa o servidor emitir a versão atual.
      setUpdatedAt(null);
      onChanged();
    } catch (error) {
      setConflict(eConflito(error));
      setErrorMessage(mensagemErro(error));
    } finally {
      setBusy(null);
    }
  };

  const definirPadrao = async (locationId: string | null) => {
    if (busy || locationId === defaultLocationId) return;
    setBusy("padrao");
    setErrorMessage("");
    setConflict(false);
    try {
      const body = await chamarApi(`/eventos-admin/api/eventos/admin/${eventId}/local-padrao`, {
        method: "PATCH",
        body: JSON.stringify(construirPayloadPadrao(locationId, updatedAt)),
      });
      const data = respostaData(body) as { defaultLocationId?: unknown; updatedAt?: unknown };
      const nextDefault = typeof data.defaultLocationId === "string" ? data.defaultLocationId : null;
      setDefaultLocationId(nextDefault);
      setItems((current) => current.map((item) => ({ ...item, isDefault: item.id === nextDefault })));
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
      onChanged();
    } catch (error) {
      setConflict(eConflito(error));
      setErrorMessage(mensagemErro(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="gerenciador-locais-titulo" className="space-y-4 rounded-2xl border border-[#dbe5d8] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="gerenciador-locais-titulo" className="text-xl font-semibold text-slate-950">Locais do evento</h2>
          <p className="mt-1 text-sm text-slate-600">Cadastre os lugares disponíveis e escolha qual será usado por padrão.</p>
        </div>
        <button type="button" onClick={abrirNovo} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Adicionar local</button>
      </div>

      {busy && <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{busy === "padrao" ? "Atualizando local padrão…" : "Salvando local…"}</p>}
      {errorMessage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><p>{errorMessage}</p>{conflict && <p className="mt-1 font-medium">O evento mudou em outra janela. Revise os dados e tente salvar novamente.</p>}</div>}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="font-medium text-slate-800">Nenhum local cadastrado</p>
          <p className="mt-1 text-sm text-slate-600">Adicione um local para configurar as sessões do evento.</p>
        </div>
      ) : (
        <ul aria-label="Locais cadastrados" className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950">{item.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.address}</p>
                  {item.room && <p className="mt-1 text-sm text-slate-500">{item.room}</p>}
                </div>
                <span className={item.id === defaultLocationId ? "rounded-full bg-[#e5f1e2] px-2.5 py-1 text-xs font-semibold text-[#2f633d]" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"}>
                  {item.id === defaultLocationId ? "Padrão" : "Disponível"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => abrirEdicao(item)} disabled={Boolean(busy)} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50">Editar</button>
                {item.id === defaultLocationId ? <span className="px-2 py-1.5 text-sm text-slate-500">Usado nas sessões sem exceção</span> : <button type="button" onClick={() => void definirPadrao(item.id)} disabled={Boolean(busy)} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50">Usar como padrão</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <form aria-label={editingId ? "Editar local" : "Adicionar local"} onSubmit={(event) => void salvarLocal(event)} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">{editingId ? "Editar local" : "Novo local"}</h3><button type="button" onClick={fecharFormulario} disabled={Boolean(busy)} className="text-sm text-slate-600 underline disabled:opacity-50">Cancelar</button></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">Nome do local<input aria-label="Nome do local" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "nome-local-erro" : undefined} className="mt-1 w-full rounded border border-slate-300 bg-white p-2" autoComplete="off" />{errors.name && <span id="nome-local-erro" className="mt-1 block text-xs font-normal text-red-700">{errors.name}</span>}</label>
            <label className="block text-sm font-medium text-slate-700">Endereço<input aria-label="Endereço do local" value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "endereco-local-erro" : undefined} className="mt-1 w-full rounded border border-slate-300 bg-white p-2" autoComplete="street-address" />{errors.address && <span id="endereco-local-erro" className="mt-1 block text-xs font-normal text-red-700">{errors.address}</span>}</label>
          </div>
          <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)} className="text-sm font-medium text-slate-700 underline">Campos avançados</button>
          {advancedOpen && <div className="grid gap-3 border-t border-slate-200 pt-3 md:grid-cols-3"><label className="block text-sm font-medium text-slate-700">Sala<input aria-label="Sala" value={draft.room ?? ""} onChange={(event) => setDraft((current) => ({ ...current, room: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label><label className="block text-sm font-medium text-slate-700">Instruções<textarea aria-label="Instruções" value={draft.instructions ?? ""} onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white p-2" /></label><label className="block text-sm font-medium text-slate-700">Acessibilidade<textarea aria-label="Acessibilidade" value={draft.accessibility ?? ""} onChange={(event) => setDraft((current) => ({ ...current, accessibility: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white p-2" /></label></div>}
          <button type="submit" aria-busy={busy === "local"} className="rounded-lg bg-[#3d7c4a] px-4 py-2 text-sm font-medium text-white hover:bg-[#32663d]">{editingId ? "Salvar alterações" : "Cadastrar local"}</button>
        </form>
      )}
    </section>
  );
}
