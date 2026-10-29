"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  assertRespostaApi,
  construirPayloadSessao,
  persistirSessaoSalva,
} from "@/features/eventos/etapas-contratos";
import {
  SessionEditor,
  sessionValueToDraft,
  type SessionValue,
} from "@/features/eventos/session-editor";
import {
  validarSessao,
  type SessionLocationOption,
  type SessionMapOption,
  type SessionOptions,
} from "@/features/eventos/session-card-contracts";
import { useEventoAutosave } from "@/features/eventos/use-evento-autosave";

const EMPTY_OPTIONS: SessionOptions = {
  defaultLocation: null,
  locations: [],
  defaultMap: null,
  maps: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record.data && typeof record.data === "object" ? record.data : value;
}

function normalizarLocal(value: unknown): SessionLocationOption | null {
  const record = asRecord(value);
  if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.address !== "string") return null;
  return {
    id: record.id,
    name: record.name,
    address: record.address,
    room: typeof record.room === "string" ? record.room : null,
  };
}

function normalizarMapa(value: unknown): SessionMapOption | null {
  const record = asRecord(value);
  if (typeof record.id !== "string" || record.status !== "CONFIRMADO" || typeof record.version !== "number") return null;
  return {
    id: record.id,
    version: record.version,
    status: "CONFIRMADO",
    originalFileName: typeof record.originalFileName === "string" ? record.originalFileName : null,
  };
}

export function normalizarOpcoesSessao(value: unknown): SessionOptions {
  const record = asRecord(unwrapData(value));
  const locations = Array.isArray(record.locations)
    ? record.locations.map(normalizarLocal).filter((item): item is SessionLocationOption => Boolean(item))
    : [];
  const maps = Array.isArray(record.maps)
    ? record.maps.map(normalizarMapa).filter((item): item is SessionMapOption => Boolean(item))
    : [];
  const defaultLocation = normalizarLocal(record.defaultLocation);
  const defaultMap = normalizarMapa(record.defaultMap);

  return {
    locations,
    maps,
    defaultLocation: defaultLocation && locations.some((item) => item.id === defaultLocation.id) ? defaultLocation : null,
    defaultMap: defaultMap && maps.some((item) => item.id === defaultMap.id) ? defaultMap : null,
  };
}

function normalizarSessao(value: unknown): SessionValue {
  const row = asRecord(value);
  const id = typeof row.id === "string" ? row.id : undefined;
  return {
    id,
    clientId: id ?? `sessao-local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    startsAt: String(row.startsAt ?? "").slice(0, 16),
    endsAt: String(row.endsAt ?? "").slice(0, 16),
    capacity: Number(row.capacity ?? 0),
    salesStartsAt: row.salesStartsAt ? String(row.salesStartsAt).slice(0, 16) : "",
    salesEndsAt: row.salesEndsAt ? String(row.salesEndsAt).slice(0, 16) : "",
    inheritLocation: !row.locationId,
    inheritMap: !row.mapId,
    locationId: row.locationId ? String(row.locationId) : null,
    mapId: row.mapId ? String(row.mapId) : null,
  };
}

function sessaoProntaParaSalvar(value: SessionValue, options: SessionOptions): boolean {
  const draft = sessionValueToDraft(value);
  const validation = validarSessao(draft);
  if (!validation.ok) return false;
  if (draft.locationMode === "default" && !options.defaultLocation) return false;
  if (draft.mapMode === "default" && !options.defaultMap) return false;
  return true;
}

export function sessoesProntasParaSalvar(values: SessionValue[], options: SessionOptions | null): boolean {
  return Boolean(options && values.length > 0 && values.every((value) => sessaoProntaParaSalvar(value, options)));
}

function mesmaSessao(value: SessionValue, other: SessionValue): boolean {
  return value.startsAt === other.startsAt
    && value.endsAt === other.endsAt
    && value.capacity === other.capacity
    && value.salesStartsAt === other.salesStartsAt
    && value.salesEndsAt === other.salesEndsAt
    && value.inheritLocation === other.inheritLocation
    && value.inheritMap === other.inheritMap
    && value.locationId === other.locationId
    && value.mapId === other.mapId;
}

function identidadeSessao(value: SessionValue): string {
  return value.clientId ?? value.id ?? "sessao-sem-identidade";
}

async function descartarSessaoCriadaDepoisDaRemocao(eventId: string, sessionId: string): Promise<void> {
  try {
    await fetch(`/eventos-admin/api/eventos/admin/${eventId}/sessoes/${sessionId}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // A resposta stale não deve alterar o estado local mesmo que a limpeza seja reprocessada.
  }
}

function restaurarSessaoRemovida(values: SessionValue[], removed: SessionValue, index: number): SessionValue[] {
  if (removed.id && values.some((value) => value.id === removed.id)) return values;
  const next = [...values];
  next.splice(Math.min(index, next.length), 0, removed);
  return next;
}

function temAlteracoesPendentes(current: SessionValue[], saved: SessionValue[]): boolean {
  if (current.length !== saved.length) return true;
  return current.some((value, index) => value.id !== saved[index].id || !mesmaSessao(value, saved[index]));
}

export default function SessoesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionValue[]>([]);
  const sessionsRef = useRef<SessionValue[]>([]);
  const savedSessionsRef = useRef<SessionValue[]>([]);
  const mutationGenerationRef = useRef(0);
  const removedSessionIdsRef = useRef(new Set<string>());
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<SessionOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    void fetch(`/eventos-admin/api/eventos/admin/${id}/sessoes`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("sessions")))
      .then((body: unknown) => {
        if (!active) return;
        const data = unwrapData(body);
        const rows = Array.isArray(data) ? data : [];
        const normalized = rows.map(normalizarSessao);
        sessionsRef.current = normalized;
        savedSessionsRef.current = normalized;
        setSessions(normalized);
      })
      .catch(() => { if (active) setError("Não foi possível carregar as sessões."); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    setOptions(null);
    setOptionsError("");
    setOptionsLoading(true);
    void fetch(`/eventos-admin/api/eventos/admin/${id}/sessoes/opcoes`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("options")))
      .then((body: unknown) => {
        if (!active) return;
        setOptions(normalizarOpcoesSessao(body));
      })
      .catch(() => { if (active) setOptionsError("Erro ao carregar opções de local e mapa."); })
      .finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, [id]);

  const autosave = useEventoAutosave({
    eventId: id,
    value: sessions,
    dirty: dirty && sessoesProntasParaSalvar(sessions, options),
    serialize: (items) => items,
    onSaved: () => {
      const temAlteracoes = temAlteracoesPendentes(sessionsRef.current, savedSessionsRef.current);
      setDirty(temAlteracoes);
      setError("");
      if (!temAlteracoes) router.refresh();
    },
    save: async (items, eventId) => {
      const generation = mutationGenerationRef.current;
      let savedItems = items;
      const limparRespostasStale = async () => {
        for (const candidate of savedItems) {
          const original = items.find((value) => identidadeSessao(value) === identidadeSessao(candidate));
          if (removedSessionIdsRef.current.has(identidadeSessao(candidate)) && !original?.id && candidate.id) await descartarSessaoCriadaDepoisDaRemocao(eventId, candidate.id);
        }
      };
      for (const [index] of items.entries()) {
        const item = savedItems[index];
        if (!item || generation !== mutationGenerationRef.current) {
          await limparRespostasStale();
          return;
        }
        const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}/sessoes${item.id ? `/${item.id}` : ""}`, {
          method: item.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(construirPayloadSessao(item)),
        });
        const body = await response.json().catch(() => ({}));
        assertRespostaApi({ ok: response.ok, status: response.status, body });
        const saved = (asRecord(body).data ?? body) as { id?: string };
        savedItems = persistirSessaoSalva(savedItems, index, saved);
        if (generation !== mutationGenerationRef.current) {
          await limparRespostasStale();
          return;
        }
      }
      if (generation !== mutationGenerationRef.current) {
        await limparRespostasStale();
        return;
      }
      savedSessionsRef.current = savedItems;
      const current = sessionsRef.current;
      const next = current.map((item) => {
        const original = items.find((candidate) => identidadeSessao(candidate) === identidadeSessao(item));
        const saved = original ? savedItems.find((candidate) => identidadeSessao(candidate) === identidadeSessao(original)) : undefined;
        return !original || item.id || !saved?.id || !mesmaSessao(item, original) ? item : { ...item, id: saved.id };
      });
      sessionsRef.current = next;
      setSessions(next);
    },
    debounceMs: 700,
  });

  const removerSessao = async (index: number, session: SessionValue) => {
    if (!session.id) return;
    removedSessionIdsRef.current.add(identidadeSessao(session));
    mutationGenerationRef.current += 1;
    autosave.invalidate();
    try {
      const response = await fetch(`/eventos-admin/api/eventos/admin/${id}/sessoes/${session.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      assertRespostaApi({ ok: response.ok, status: response.status, body });
      const savedRemaining = savedSessionsRef.current.filter((value) => value.id !== session.id);
      savedSessionsRef.current = savedRemaining;
       removedSessionIdsRef.current.delete(identidadeSessao(session));
      const temAlteracoes = temAlteracoesPendentes(sessionsRef.current, savedRemaining);
      setDirty(temAlteracoes);
      setError("");
      if (!temAlteracoes) router.refresh();
    } catch {
       removedSessionIdsRef.current.delete(identidadeSessao(session));
      const restored = restaurarSessaoRemovida(sessionsRef.current, session, index);
      sessionsRef.current = restored;
      setSessions(restored);
      const temAlteracoes = temAlteracoesPendentes(restored, savedSessionsRef.current);
      setDirty(temAlteracoes);
      setError("Não foi possível remover a sessão salva.");
    }
  };

  const possuiPendenciaLocal = dirty && !sessoesProntasParaSalvar(sessions, options);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sessões e local</h1>
        <p className="text-sm text-slate-600">Use o local e o mapa padrão do evento ou defina uma exceção por sessão.</p>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {optionsLoading && <p role="status" className="text-sm text-slate-600">Carregando opções de local e mapa…</p>}
      {optionsError && <p role="alert" className="text-red-700">{optionsError}</p>}
      <SessionEditor initialValue={sessions} options={options ?? EMPTY_OPTIONS} onRemove={removerSessao} onChange={(next) => {
        const nextIdentities = new Set(next.map(identidadeSessao));
        let removed = false;
        for (const previous of sessionsRef.current) {
          if (!nextIdentities.has(identidadeSessao(previous))) {
            removedSessionIdsRef.current.add(identidadeSessao(previous));
            removed = true;
          }
        }
        if (removed) autosave.invalidate();
        mutationGenerationRef.current += 1;
        sessionsRef.current = next;
        setSessions(next);
        setDirty(true);
      }} />
      <p className="text-sm text-slate-500" role="status">
        {possuiPendenciaLocal ? "Alterações locais pendentes — revise a sessão antes de salvar." : autosave.state === "saving" ? "Salvando…" : autosave.state === "saved" ? "Sessões salvas automaticamente" : ""}
      </p>
    </section>
  );
}
