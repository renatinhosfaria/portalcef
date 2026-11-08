import type { PoliticaPublica } from "@essencia/shared/types";

export const ROTULO_POLITICA: Record<PoliticaPublica["type"], string> = {
  PRIVACIDADE: "Privacidade",
  COMPRA: "Compra e meia-entrada",
  CANCELAMENTO_REEMBOLSO: "Cancelamento e reembolso",
  ACESSIBILIDADE: "Acessibilidade",
  CONTATO: "Contato",
};

const ORDEM: PoliticaPublica["type"][] = [
  "CANCELAMENTO_REEMBOLSO",
  "COMPRA",
  "PRIVACIDADE",
  "ACESSIBILIDADE",
  "CONTATO",
];

export function ordenarPoliticas(politicas: PoliticaPublica[]): PoliticaPublica[] {
  return [...politicas].sort((a, b) => ORDEM.indexOf(a.type) - ORDEM.indexOf(b.type));
}
