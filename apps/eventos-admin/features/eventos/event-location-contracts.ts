export type EventoLocalOption = {
  id: string;
  name: string;
  address: string;
  room: string | null;
  instructions: string | null;
  accessibility: string | null;
  isDefault: boolean;
};

export type EventoLocalDraft = Omit<EventoLocalOption, "id" | "isDefault">;

export type ValidacaoLocal = {
  ok: boolean;
  errors: Partial<Record<"name" | "address", string>>;
};

export type LocalesResposta = {
  items: EventoLocalOption[];
  defaultLocationId: string | null;
  updatedAt: string | null;
};

export type RespostaApiErro = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

export function validarLocal(draft: EventoLocalDraft): ValidacaoLocal {
  const errors: ValidacaoLocal["errors"] = {};
  if (!draft.name.trim()) errors.name = "Informe o nome do local.";
  if (!draft.address.trim()) errors.address = "Informe o endereço do local.";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function construirPayloadLocal(draft: EventoLocalDraft) {
  return {
    name: draft.name.trim(),
    address: draft.address.trim(),
    room: draft.room?.trim() || null,
    instructions: draft.instructions?.trim() || null,
    accessibility: draft.accessibility?.trim() || null,
  };
}

export function construirPayloadPadrao(defaultLocationId: string | null, expectedUpdatedAt: string | null) {
  return {
    defaultLocationId,
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  };
}

function normalizarLocal(value: unknown, defaultLocationId: string | null): EventoLocalOption {
  if (!value || typeof value !== "object") throw new Error("Resposta de local inválida.");
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.address !== "string") {
    throw new Error("Resposta de local inválida.");
  }
  return {
    id: item.id,
    name: item.name,
    address: item.address,
    room: typeof item.room === "string" ? item.room : null,
    instructions: typeof item.instructions === "string" ? item.instructions : null,
    accessibility: typeof item.accessibility === "string" ? item.accessibility : null,
    isDefault: item.id === defaultLocationId || item.isDefault === true,
  };
}

export function normalizarRespostaLocais(value: unknown): LocalesResposta {
  const envelope = value as { success?: unknown; data?: unknown } | null;
  if (!envelope || envelope.success !== true || !envelope.data || typeof envelope.data !== "object") {
    throw new Error("Resposta de locais inválida.");
  }
  const data = envelope.data as Record<string, unknown>;
  const defaultLocationId = typeof data.defaultLocationId === "string" ? data.defaultLocationId : null;
  if (!Array.isArray(data.items)) throw new Error("Resposta de locais inválida.");
  return {
    items: data.items.map((item) => normalizarLocal(item, defaultLocationId)),
    defaultLocationId,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
  };
}

export function normalizarLocalResposta(value: unknown, defaultLocationId: string | null = null): EventoLocalOption {
  return normalizarLocal(value, defaultLocationId);
}

export function criarErroApi(status: number, body: unknown): RespostaApiErro {
  const envelope = body as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null;
  const error = new Error(
    typeof envelope?.error?.message === "string" ? envelope.error.message : "Não foi possível salvar o local.",
  ) as RespostaApiErro;
  error.status = status;
  if (typeof envelope?.error?.code === "string") error.code = envelope.error.code;
  error.details = envelope?.error?.details;
  return error;
}
