import type { SessaoValue } from "./etapas-contratos";

export type SessionLocationOption = {
  id: string;
  name: string;
  address: string;
  room: string | null;
};

export type SessionMapOption = {
  id: string;
  version: number;
  status: "CONFIRMADO";
  originalFileName: string | null;
};

export type SessionOptions = {
  defaultLocation: SessionLocationOption | null;
  locations: SessionLocationOption[];
  defaultMap: SessionMapOption | null;
  maps: SessionMapOption[];
};

export type SessionDraftState = Omit<SessaoValue, "inheritLocation" | "inheritMap"> & {
  locationMode: "default" | "custom";
  mapMode: "default" | "custom";
};

type SessionValidationErrors = Partial<Record<"startsAt" | "endsAt" | "capacity" | "salesStartsAt" | "salesEndsAt" | "location" | "map", string>>;

export function validarSessao(draft: SessionDraftState): { ok: boolean; errors: SessionValidationErrors } {
  const errors: SessionValidationErrors = {};

  if (!draft.startsAt?.trim()) errors.startsAt = "Informe o horário de início";
  if (!draft.endsAt?.trim()) errors.endsAt = "Informe o horário de término";
  if (!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity) < 1) errors.capacity = "Informe uma capacidade inteira maior que zero";
  if (!draft.salesStartsAt?.trim()) errors.salesStartsAt = "Informe o início das vendas";
  if (!draft.salesEndsAt?.trim()) errors.salesEndsAt = "Informe o encerramento das vendas";

  const startsAt = Date.parse(draft.startsAt);
  const endsAt = Date.parse(draft.endsAt);
  if (!errors.startsAt && !errors.endsAt && (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt)) {
    errors.startsAt = "O início deve ser anterior ao término";
  }

  const salesStartsAt = Date.parse(draft.salesStartsAt);
  const salesEndsAt = Date.parse(draft.salesEndsAt);
  if (!errors.salesStartsAt && !errors.salesEndsAt && (!Number.isFinite(salesStartsAt) || !Number.isFinite(salesEndsAt) || salesStartsAt >= salesEndsAt)) {
    errors.salesStartsAt = "O início das vendas deve ser anterior ao encerramento";
  }

  if (draft.locationMode === "custom" && !draft.locationId?.trim()) errors.location = "Escolha um local para esta sessão";
  if (draft.mapMode === "custom" && !draft.mapId?.trim()) errors.map = "Escolha um mapa para esta sessão";

  return { ok: Object.keys(errors).length === 0, errors };
}

