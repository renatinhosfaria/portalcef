import { normalizarRespostaLocais, type LocalesResposta } from "./event-location-contracts";
import {
  aplicarLocaisNasOpcoes,
  type SessionLocationOption,
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

function normalizarOpcoesSessao(value: unknown): SessionOptions {
  const record = asRecord(unwrapData(value));
  const locations = Array.isArray(record.locations) ? record.locations.map(normalizarLocal).filter((item): item is SessionLocationOption => Boolean(item)) : [];
  const defaultLocation = normalizarLocal(record.defaultLocation);
  return {
    locations,
    defaultLocation: defaultLocation && locations.some((item) => item.id === defaultLocation.id) ? defaultLocation : null,
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
