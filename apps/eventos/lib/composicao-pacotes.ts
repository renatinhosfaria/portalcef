import { validarComposicaoPacotes } from "@essencia/shared/eventos/pacotes";
import type { PublicEventTicketType } from "@essencia/shared/types";
import type { AssentoSelecionado } from "../components/assentos-types";

export function adicionarPacote(selecao: AssentoSelecionado[], tipos: PublicEventTicketType[], tipoId: string, pacoteId: string): AssentoSelecionado[] {
  const tipo = tipos.find(item => item.id === tipoId);
  const quantidade = tipo?.lugaresPorPacote ?? 1;
  if (!tipo || quantidade <= 1 || !Number.isInteger(quantidade) || selecao.some(item => item.pacoteId === pacoteId)) return selecao;
  const tiposAvulsos = new Set(tipos.filter(item => (item.lugaresPorPacote ?? 1) === 1).map(item => item.id));
  const semTipo = selecao.filter(item => !item.pacoteId && !item.ticketTypeId);
  const avulsos = selecao.filter(item => !item.pacoteId && tiposAvulsos.has(item.ticketTypeId));
  const candidatos = [...semTipo, ...avulsos];
  if (candidatos.length < quantidade || (tipo.maxPerOrder != null && selecao.filter(item => item.ticketTypeId === tipoId).length + quantidade > tipo.maxPerOrder)) return selecao;
  const escolhidos = new Set(candidatos.slice(0, quantidade).map(item => item.seatId));
  return selecao.map(item => escolhidos.has(item.seatId) ? { ...item, ticketTypeId: tipoId, pacoteId } : item);
}

export function desfazerPacote(selecao: AssentoSelecionado[], pacoteId: string): AssentoSelecionado[] {
  return selecao.map(item => {
    if (item.pacoteId !== pacoteId) return item;
    const { pacoteId: _pacoteId, ...assento } = item;
    return { ...assento, ticketTypeId: "" };
  });
}

export function removerAssentos(selecao: AssentoSelecionado[], seatIds: string[]): AssentoSelecionado[] {
  const removidos = new Set(seatIds);
  const afetados = new Set(selecao.filter(item => removidos.has(item.seatId) && item.pacoteId).map(item => item.pacoteId!));
  let resultado = selecao;
  for (const id of afetados) resultado = desfazerPacote(resultado, id);
  return resultado.filter(item => !removidos.has(item.seatId));
}

export function selecaoCompleta(selecao: AssentoSelecionado[], tipos: PublicEventTicketType[]): boolean {
  if (!selecao.length) return false;
  try {
    validarComposicaoPacotes(selecao.map((item, participantIndex) => ({ ...item, participantIndex })), tipos);
    const quantidades = new Map<string, number>();
    for (const item of selecao) quantidades.set(item.ticketTypeId, (quantidades.get(item.ticketTypeId) ?? 0) + 1);
    return tipos.every(tipo => tipo.maxPerOrder == null || (quantidades.get(tipo.id) ?? 0) <= tipo.maxPerOrder);
  } catch {
    return false;
  }
}
