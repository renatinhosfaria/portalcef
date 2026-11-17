import type { EvidenciaPacote } from "../types/eventos";
import type { ItemPreco } from "./precos";

export type { EvidenciaPacote } from "../types/eventos";
export type AssentoPacote = { seatId: string; ticketTypeId: string; participantIndex: number; pacoteId?: string };
export type TipoIngressoPacote = { id: string; name: string; priceCents: number; lugaresPorPacote?: number; version?: number };
export type ItemPrecoPacote = ItemPreco & { pacote?: EvidenciaPacote };

export class ErroComposicaoPacotes extends Error {
  constructor(public readonly codigo: "PACOTE_INCOMPLETO" | "PACOTE_INVALIDO", mensagem: string) {
    super(mensagem);
    this.name = "ErroComposicaoPacotes";
  }
}

function agrupar(assentos: AssentoPacote[]): Map<string, AssentoPacote[]> {
  const grupos = new Map<string, AssentoPacote[]>();
  for (const assento of assentos) {
    if (!assento.pacoteId) continue;
    const grupo = grupos.get(assento.pacoteId) ?? [];
    grupo.push(assento);
    grupos.set(assento.pacoteId, grupo);
  }
  return grupos;
}

export function validarComposicaoPacotes(assentos: AssentoPacote[], tipos: TipoIngressoPacote[]): void {
  const porTipo = new Map(tipos.map(tipo => [tipo.id, tipo]));
  const vistos = new Set<string>();
  for (const assento of assentos) {
    const tipo = porTipo.get(assento.ticketTypeId);
    const quantidade = tipo?.lugaresPorPacote ?? 1;
    if (!tipo || vistos.has(assento.seatId) || !Number.isInteger(quantidade) || quantidade < 1 || !Number.isSafeInteger(tipo.priceCents) || tipo.priceCents < 0 || (quantidade === 1 && assento.pacoteId)) {
      throw new ErroComposicaoPacotes("PACOTE_INVALIDO", "Composição de ingressos inválida.");
    }
    if (quantidade > 1 && !assento.pacoteId) throw new ErroComposicaoPacotes("PACOTE_INCOMPLETO", "Escolha um pacote completo para os lugares selecionados.");
    vistos.add(assento.seatId);
  }
  for (const grupo of agrupar(assentos).values()) {
    const primeiro = grupo[0]!;
    if (grupo.some(assento => assento.ticketTypeId !== primeiro.ticketTypeId)) throw new ErroComposicaoPacotes("PACOTE_INVALIDO", "Um pacote deve conter um único tipo de ingresso.");
    if (grupo.length !== porTipo.get(primeiro.ticketTypeId)!.lugaresPorPacote) throw new ErroComposicaoPacotes("PACOTE_INCOMPLETO", "A quantidade de lugares não corresponde ao pacote.");
  }
}

export function montarItensPrecoPacotes(assentos: AssentoPacote[], tipos: TipoIngressoPacote[]): ItemPrecoPacote[] {
  validarComposicaoPacotes(assentos, tipos);
  const porTipo = new Map(tipos.map(tipo => [tipo.id, tipo]));
  const valores = new Map<string, number>();
  for (const grupo of agrupar(assentos).values()) {
    const preco = porTipo.get(grupo[0]!.ticketTypeId)!.priceCents;
    const base = Math.floor(preco / grupo.length);
    const resto = preco % grupo.length;
    [...grupo].sort((a, b) => a.seatId.localeCompare(b.seatId)).forEach((assento, indice) => valores.set(assento.seatId, base + (indice < resto ? 1 : 0)));
  }
  return assentos.map(assento => {
    const tipo = porTipo.get(assento.ticketTypeId)!;
    const pacote: EvidenciaPacote | undefined = assento.pacoteId ? { id: assento.pacoteId, lugaresPorPacote: tipo.lugaresPorPacote!, precoPacoteCentavos: tipo.priceCents, versaoTipo: tipo.version ?? 1, nomeTipo: tipo.name } : undefined;
    return { seatId: assento.seatId, ticketTypeId: assento.ticketTypeId, participantIndex: assento.participantIndex, basePriceCents: valores.get(assento.seatId) ?? tipo.priceCents, ...(pacote ? { pacote } : {}) };
  });
}

export function assinaturaComposicaoPacotes(sessionId: string, assentos: AssentoPacote[]): string {
  const grupos = new Map([...agrupar(assentos)].map(([id, grupo]) => [id, grupo.map(assento => assento.seatId).sort()]));
  return JSON.stringify([sessionId, [...assentos].sort((a, b) => a.seatId.localeCompare(b.seatId)).map(assento => [assento.seatId, assento.ticketTypeId, assento.participantIndex, assento.pacoteId ? grupos.get(assento.pacoteId) : null])]);
}
