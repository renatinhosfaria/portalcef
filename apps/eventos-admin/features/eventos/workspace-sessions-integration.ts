import { normalizarRespostaLocais, type LocalesResposta } from "./event-location-contracts";
import {
  aplicarLocaisNasOpcoes,
  type SessionLocationOption,
  type SessionMapOption,
  type SessionOptions,
} from "./session-card-contracts";

export type WorkspaceFetcher = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

export type WorkspaceSessionsData = {
  locations: LocalesResposta;
  options: SessionOptions;
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
  return { id: record.id, name: record.name, address: record.address, room: typeof record.room === "string" ? record.room : null };
}

function normalizarMapa(value: unknown): SessionMapOption | null {
  const record = asRecord(value);
  if (typeof record.id !== "string" || record.status !== "CONFIRMADO" || typeof record.version !== "number") return null;
  return { id: record.id, version: record.version, status: "CONFIRMADO", originalFileName: typeof record.originalFileName === "string" ? record.originalFileName : null };
}

function normalizarOpcoesSessao(value: unknown): SessionOptions {
  const record = asRecord(unwrapData(value));
  const locations = Array.isArray(record.locations) ? record.locations.map(normalizarLocal).filter((item): item is SessionLocationOption => Boolean(item)) : [];
  const maps = Array.isArray(record.maps) ? record.maps.map(normalizarMapa).filter((item): item is SessionMapOption => Boolean(item)) : [];
  const defaultLocation = normalizarLocal(record.defaultLocation);
  const defaultMap = normalizarMapa(record.defaultMap);
  return {
    locations,
    maps,
    defaultLocation: defaultLocation && locations.some((item) => item.id === defaultLocation.id) ? defaultLocation : null,
    defaultMap: defaultMap && maps.some((item) => item.id === defaultMap.id) ? defaultMap : null,
  };
}

export async function carregarDadosWorkspace(eventId: string, fetcher: WorkspaceFetcher = fetch): Promise<WorkspaceSessionsData> {
  const [locationsResponse, optionsResponse] = await Promise.all([
    fetcher(`/eventos-admin/api/eventos/admin/${eventId}/locais`, { credentials: "include" }),
    fetcher(`/eventos-admin/api/eventos/admin/${eventId}/sessoes/opcoes`, { credentials: "include" }),
  ]);
  if (!locationsResponse.ok || !optionsResponse.ok) throw new Error("workspace-options");
  const [locationsBody, optionsBody] = await Promise.all([locationsResponse.json(), optionsResponse.json()]);
  const locations = normalizarRespostaLocais(locationsBody);
  const options = aplicarLocaisNasOpcoes(normalizarOpcoesSessao(optionsBody), locations);
  return { locations, options };
}
