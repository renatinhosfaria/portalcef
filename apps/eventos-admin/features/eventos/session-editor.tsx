"use client";

import React, { useEffect, useState } from "react";
import type { SessaoValue } from "./etapas-contratos";
import { validarSessao, type SessionDraftState, type SessionOptions } from "./session-card-contracts";

export type SessionValue = SessaoValue;

type SessionEditorProps = {
  initialValue?: SessionValue[];
  options?: SessionOptions;
  onChange?: (sessions: SessionValue[]) => void;
  onRemove?: (index: number, session: SessionValue) => void;
};

type SessionErrors = ReturnType<typeof validarSessao>["errors"];

const EMPTY_OPTIONS: SessionOptions = {
  defaultLocation: null,
  locations: [],
  defaultMap: null,
  maps: [],
};

const FIELD_LABELS: Record<keyof SessionErrors, string> = {
  startsAt: "horário de início",
  endsAt: "horário de término",
  capacity: "capacidade vendável",
  salesStartsAt: "início das vendas",
  salesEndsAt: "encerramento das vendas",
  location: "local",
  map: "mapa de assentos",
};

export function sessionValueToDraft(value: SessionValue): SessionDraftState {
  return {
    id: value.id,
    startsAt: value.startsAt ?? "",
    endsAt: value.endsAt ?? "",
    capacity: Number(value.capacity ?? 0),
    salesStartsAt: value.salesStartsAt ?? "",
    salesEndsAt: value.salesEndsAt ?? "",
    locationId: value.locationId ?? null,
    mapId: value.mapId ?? null,
    locationMode: value.inheritLocation ? "default" : "custom",
    mapMode: value.inheritMap ? "default" : "custom",
  };
}

export function confirmarRemocaoSessao(session: SessionValue, confirmar: (mensagem: string) => boolean): boolean {
  if (!session.id) return true;
  return confirmar("Esta sessão já foi salva. Deseja removê-la?");
}

export function sessionDraftToValue(draft: SessionDraftState): SessionValue {
  return {
    id: draft.id,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    capacity: Number(draft.capacity),
    salesStartsAt: draft.salesStartsAt,
    salesEndsAt: draft.salesEndsAt,
    inheritLocation: draft.locationMode === "default",
    inheritMap: draft.mapMode === "default",
    locationId: draft.locationId ?? null,
    mapId: draft.mapId ?? null,
  };
}

function validarRascunho(draft: SessionDraftState, options: SessionOptions): { ok: boolean; errors: SessionErrors } {
  const result = validarSessao(draft);
  const errors: SessionErrors = { ...result.errors };

  if (draft.locationMode === "default" && !options.defaultLocation) {
    errors.location = "Defina o local padrão do evento ou escolha uma exceção";
  }
  if (draft.mapMode === "default" && !options.defaultMap) {
    errors.map = "Defina o mapa padrão do evento ou escolha uma exceção";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

function nomeLocal(location: SessionOptions["defaultLocation"]): string {
  if (!location) return "Local padrão ainda não definido";
  return location.room ? `${location.name} — ${location.room}` : location.name;
}

function nomeMapa(map: SessionOptions["defaultMap"]): string {
  if (!map) return "Mapa padrão ainda não definido";
  return `Mapa v${map.version} — ${map.originalFileName ?? "arquivo sem nome"} · Confirmado`;
}

function primeiroCampoAusente(errors: SessionErrors): string | null {
  const key = (Object.keys(FIELD_LABELS) as Array<keyof SessionErrors>).find((field) => errors[field]);
  return key ? `Falta ${FIELD_LABELS[key]}` : null;
}

function novoRascunho(): SessionDraftState {
  return {
    startsAt: "",
    endsAt: "",
    capacity: 0,
    salesStartsAt: "",
    salesEndsAt: "",
    locationId: null,
    mapId: null,
    locationMode: "default",
    mapMode: "default",
  };
}

export function SessionEditor({ initialValue = [], options = EMPTY_OPTIONS, onChange, onRemove }: SessionEditorProps) {
  const [drafts, setDrafts] = useState<SessionDraftState[]>(() => initialValue.map(sessionValueToDraft));

  useEffect(() => {
    setDrafts(initialValue.map(sessionValueToDraft));
  }, [initialValue]);

  const emit = (next: SessionDraftState[]) => {
    setDrafts(next);
    onChange?.(next.map(sessionDraftToValue));
  };

  const atualizar = (index: number, patch: Partial<SessionDraftState>) => {
    emit(drafts.map((draft, itemIndex) => (itemIndex === index ? { ...draft, ...patch } : draft)));
  };

  const adicionar = () => emit([...drafts, novoRascunho()]);

  const remover = (index: number) => {
    const removed = drafts[index];
    if (!removed) return;
    const removedValue = sessionDraftToValue(removed);
    const confirmar = (mensagem: string) => typeof window !== "undefined" && window.confirm(mensagem);
    if (!confirmarRemocaoSessao(removedValue, confirmar)) return;
    const next = drafts.filter((_, itemIndex) => itemIndex !== index);
    emit(next);
    if (removed.id) onRemove?.(index, removedValue);
  };

  return (
    <div className="space-y-4" aria-label="Sessões do evento">
      {drafts.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          Adicione a primeira sessão para definir quando e onde o evento acontece.
        </p>
      )}

      {drafts.map((draft, index) => {
        const validation = validarRascunho(draft, options);
        const pending = primeiroCampoAusente(validation.errors);
        const locationDefault = options.defaultLocation;
        const mapDefault = options.defaultMap;
        const sessionLabel = `Sessão ${index + 1}`;

        return (
          <article key={draft.id ?? `nova-${index}`} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{sessionLabel}</h3>
                <p className={`mt-1 text-sm ${validation.ok ? "text-emerald-700" : "text-amber-700"}`} role="status">
                  {validation.ok ? "Pronta" : pending}
                </p>
              </div>
              <button type="button" className="text-sm font-medium text-red-700 underline-offset-2 hover:underline" onClick={() => remover(index)}>
                Remover sessão {index + 1}
              </button>
            </header>

            {!validation.ok && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                <p className="font-medium">{pending}</p>
                <p className="mt-1">Revise os campos destacados antes de salvar.</p>
              </div>
            )}

            <section aria-labelledby={`sessao-${index}-quando`} className="space-y-3">
              <h4 id={`sessao-${index}-quando`} className="font-medium text-slate-900">Quando acontece</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <CampoData idSuffix={`${index}-inicio`} label="Início" value={draft.startsAt} error={validation.errors.startsAt} onChange={(startsAt) => atualizar(index, { startsAt })} />
                <CampoData idSuffix={`${index}-fim`} label="Fim" value={draft.endsAt} error={validation.errors.endsAt} onChange={(endsAt) => atualizar(index, { endsAt })} />
              </div>
            </section>

            <section aria-labelledby={`sessao-${index}-capacidade`} className="space-y-3">
              <h4 id={`sessao-${index}-capacidade`} className="font-medium text-slate-900">Capacidade e vendas</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <CampoNumero idSuffix={`${index}-capacidade`} label="Capacidade vendável" value={draft.capacity} error={validation.errors.capacity} onChange={(capacity) => atualizar(index, { capacity })} />
                <CampoData idSuffix={`${index}-vendas-inicio`} label="Início das vendas" value={draft.salesStartsAt} error={validation.errors.salesStartsAt} onChange={(salesStartsAt) => atualizar(index, { salesStartsAt })} />
                <CampoData idSuffix={`${index}-vendas-fim`} label="Fim das vendas" value={draft.salesEndsAt} error={validation.errors.salesEndsAt} onChange={(salesEndsAt) => atualizar(index, { salesEndsAt })} />
              </div>
            </section>

            <section aria-labelledby={`sessao-${index}-local`} className="space-y-3">
              <h4 id={`sessao-${index}-local`} className="font-medium text-slate-900">Local</h4>
              <div className="grid gap-2 md:grid-cols-2">
                <label className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${draft.locationMode === "default" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                  <input type="radio" name={`sessao-${index}-local-mode`} value="default" checked={draft.locationMode === "default"} aria-describedby={validation.errors.location ? `sessao-${index}-local-erro` : undefined} onChange={() => atualizar(index, { locationMode: "default" })} />
                  <span><span className="block font-medium">Usar local padrão</span><span className="text-slate-600">{nomeLocal(locationDefault)}</span></span>
                </label>
                <label className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${draft.locationMode === "custom" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                  <input type="radio" name={`sessao-${index}-local-mode`} value="custom" checked={draft.locationMode === "custom"} aria-describedby={validation.errors.location ? `sessao-${index}-local-erro` : undefined} onChange={() => atualizar(index, { locationMode: "custom" })} />
                  <span><span className="block font-medium">Escolher outro local</span><span className="text-slate-600">Exceção somente para esta sessão</span></span>
                </label>
              </div>
              {validation.errors.location && draft.locationMode === "default" && <p id={`sessao-${index}-local-erro`} className="text-sm text-red-700">{validation.errors.location}</p>}
              {draft.locationMode === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor={`sessao-${index}-local-excecao`}>Local da exceção</label>
                  <select id={`sessao-${index}-local-excecao`} aria-label="Local da exceção" aria-describedby={validation.errors.location ? `sessao-${index}-local-erro` : undefined} value={draft.locationId ?? ""} onChange={(event) => atualizar(index, { locationId: event.target.value || null })} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
                    <option value="">Escolha um local específico</option>
                    {options.locations.map((location) => <option key={location.id} value={location.id}>{nomeLocal(location)} — {location.address}</option>)}
                  </select>
                  {validation.errors.location && <p id={`sessao-${index}-local-erro`} className="mt-1 text-sm text-red-700">{validation.errors.location}</p>}
                </div>
              )}
            </section>

            <section aria-labelledby={`sessao-${index}-mapa`} className="space-y-3">
              <h4 id={`sessao-${index}-mapa`} className="font-medium text-slate-900">Mapa de assentos</h4>
              <div className="grid gap-2 md:grid-cols-2">
                <label className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${draft.mapMode === "default" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                  <input type="radio" name={`sessao-${index}-mapa-mode`} value="default" checked={draft.mapMode === "default"} aria-describedby={validation.errors.map ? `sessao-${index}-mapa-erro` : undefined} onChange={() => atualizar(index, { mapMode: "default" })} />
                  <span><span className="block font-medium">Usar mapa padrão</span><span className="text-slate-600">{nomeMapa(mapDefault)}</span></span>
                </label>
                <label className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${draft.mapMode === "custom" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                  <input type="radio" name={`sessao-${index}-mapa-mode`} value="custom" checked={draft.mapMode === "custom"} aria-describedby={validation.errors.map ? `sessao-${index}-mapa-erro` : undefined} onChange={() => atualizar(index, { mapMode: "custom" })} />
                  <span><span className="block font-medium">Escolher outro mapa</span><span className="text-slate-600">Exceção somente para esta sessão</span></span>
                </label>
              </div>
              {validation.errors.map && draft.mapMode === "default" && <p id={`sessao-${index}-mapa-erro`} className="text-sm text-red-700">{validation.errors.map}</p>}
              {draft.mapMode === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor={`sessao-${index}-mapa-excecao`}>Mapa da exceção</label>
                  <select id={`sessao-${index}-mapa-excecao`} aria-label="Mapa da exceção" aria-describedby={validation.errors.map ? `sessao-${index}-mapa-erro` : undefined} value={draft.mapId ?? ""} onChange={(event) => atualizar(index, { mapId: event.target.value || null })} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
                    <option value="">Escolha um mapa específico</option>
                    {options.maps.map((map) => <option key={map.id} value={map.id}>Mapa v{map.version} — {map.originalFileName ?? "arquivo sem nome"} · Confirmado</option>)}
                  </select>
                  {validation.errors.map && <p id={`sessao-${index}-mapa-erro`} className="mt-1 text-sm text-red-700">{validation.errors.map}</p>}
                </div>
              )}
            </section>
          </article>
        );
      })}

      <button type="button" onClick={adicionar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
        Adicionar sessão
      </button>
    </div>
  );
}

type CampoDataProps = { idSuffix: string; label: string; value: string; error?: string; onChange: (value: string) => void };
function CampoData({ idSuffix, label, value, error, onChange }: CampoDataProps) {
  const inputId = `campo-${idSuffix}`;
  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
      {label}
      <input id={inputId} aria-label={label} aria-describedby={error ? `${inputId}-erro` : undefined} aria-invalid={Boolean(error)} type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" />
      {error && <span id={`${inputId}-erro`} className="mt-1 block text-sm font-normal text-red-700">{error}</span>}
    </label>
  );
}

type CampoNumeroProps = { idSuffix: string; label: string; value: number; error?: string; onChange: (value: number) => void };
function CampoNumero({ idSuffix, label, value, error, onChange }: CampoNumeroProps) {
  const inputId = `campo-${idSuffix}`;
  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
      {label}
      <input id={inputId} aria-label={label} aria-describedby={error ? `${inputId}-erro` : undefined} aria-invalid={Boolean(error)} type="number" min="1" value={Number.isNaN(value) ? "" : value} onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" />
      {error && <span id={`${inputId}-erro`} className="mt-1 block text-sm font-normal text-red-700">{error}</span>}
    </label>
  );
}
