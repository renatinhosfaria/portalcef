export function normalizarTiposPorAssento(seatIds: string[], ticketTypeIds: string[]): string[] {
  if (seatIds.length === 0) {
    if (ticketTypeIds.length === 0) return [];
    throw new Error(`A quantidade de tipos de ingresso (${ticketTypeIds.length}) não corresponde aos assentos selecionados (0).`);
  }
  if (ticketTypeIds.length === seatIds.length) return ticketTypeIds;
  if (ticketTypeIds.length === 1 && ticketTypeIds[0]) return seatIds.map(() => ticketTypeIds[0]);
  throw new Error(`A quantidade de tipos de ingresso (${ticketTypeIds.length}) não corresponde aos assentos selecionados (${seatIds.length}).`);
}
