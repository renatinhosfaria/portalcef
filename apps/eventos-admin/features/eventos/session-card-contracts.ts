import type { SessaoValue } from "./etapas-contratos";

export type SessionLocationOption = {
  id: string;
  name: string;
  address: string;
  room: string | null;
};

export type SessionOptions = {
  defaultLocation: SessionLocationOption | null;
  locations: SessionLocationOption[];
};

export type SessionLocationCatalog = {
  items: Array<Pick<SessionLocationOption, "id" | "name" | "address" | "room">>;
  defaultLocationId: string | null;
};

export function aplicarLocaisNasOpcoes(options: SessionOptions, catalog: SessionLocationCatalog): SessionOptions {
  const locations = catalog.items.map((location) => ({ ...location }));
  return {
    ...options,
    locations,
    defaultLocation: locations.find((location) => location.id === catalog.defaultLocationId) ?? null,
  };
}

export type SessionDraftState = Omit<SessaoValue, "inheritLocation"> & {
  locationMode: "default" | "custom";
};

type SessionValidationErrors = Partial<Record<"startsAt" | "endsAt" | "capacity" | "salesStartsAt" | "salesEndsAt" | "location", string>>;

export function validarSessao(draft: SessionDraftState): { ok: boolean; errors: SessionValidationErrors } {
  const errors: SessionValidationErrors = {};

  if (!draft.startsAt?.trim()) errors.startsAt = "Informe o horário de início";
  if (!draft.endsAt?.trim()) errors.endsAt = "Informe o horário de término";
  if (!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity) < 1) errors.capacity = "Informe uma capacidade inteira maior que zero";

  const startsAt = Date.parse(draft.startsAt);
  const endsAt = Date.parse(draft.endsAt);
  if (!errors.startsAt && !errors.endsAt && (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt)) {
    errors.startsAt = "O início deve ser anterior ao término";
  }

  const salesStartsAt = draft.salesStartsAt?.trim() ? Date.parse(draft.salesStartsAt) : null;
  const salesEndsAt = draft.salesEndsAt?.trim() ? Date.parse(draft.salesEndsAt) : null;
  if (salesStartsAt !== null && !Number.isFinite(salesStartsAt)) errors.salesStartsAt = "Informe uma data válida para o início das vendas";
  if (salesEndsAt !== null && !Number.isFinite(salesEndsAt)) errors.salesEndsAt = "Informe uma data válida para o encerramento das vendas";
  if (!errors.salesStartsAt && !errors.salesEndsAt && salesStartsAt !== null && salesEndsAt !== null && salesStartsAt >= salesEndsAt) {
    errors.salesStartsAt = "O início das vendas deve ser anterior ao encerramento";
  }

  if (draft.locationMode === "custom" && !draft.locationId?.trim()) errors.location = "Escolha um local para esta sessão";

  return { ok: Object.keys(errors).length === 0, errors };
}

export function sessaoProntaParaSalvar(draft: SessionDraftState, options: SessionOptions): boolean {
  const validation = validarSessao(draft);
  if (!validation.ok) return false;
  if (draft.locationMode === "default" && !options.defaultLocation) return false;
  return true;
}

