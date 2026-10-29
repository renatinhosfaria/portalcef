export type InventoryStatus = "DISPONIVEL" | "LIBERADO" | "RESERVADO" | "VENDIDO" | "BLOQUEADO" | string;

export function contarAssentosVendaveis(seats: Array<{ status?: InventoryStatus }>) {
  return seats.filter((seat) => seat.status === "DISPONIVEL" || seat.status === "LIBERADO").length;
}

export function resumoInventario(input: { capacity: number; seats: Array<{ status?: InventoryStatus }> }) {
  const sellable = contarAssentosVendaveis(input.seats);
  const blocked = input.seats.filter((seat) => seat.status === "BLOQUEADO").length;
  return { capacity: input.capacity, sellable, blocked, ready: sellable >= input.capacity, needsReview: sellable < input.capacity };
}

export function prepararConfirmacaoMapa(input: { mapId: string; affectedSessionIds: string[]; inventoryStatus?: string }) {
  return { ...input, requiresInventoryReview: input.affectedSessionIds.length > 0 || input.inventoryStatus === "EM_REVISAO" };
}
