import { z } from "zod";
import type { AssentoSelecionado } from "../components/assentos-types";

export type RascunhoSelecao = { versao: 1; sessionId: string; assentos: AssentoSelecionado[] };
const identificador = z.string().uuid();
const esquema = z.object({
  versao: z.literal(1),
  sessionId: z.string().min(1),
  assentos: z.array(z.object({ seatId: z.string().min(1), ticketTypeId: z.string(), pacoteId: z.string().min(1).optional(), label: z.string().optional(), accessible: z.boolean().optional() }).strict()),
}).strict().refine(valor => new Set(valor.assentos.map(item => item.seatId)).size === valor.assentos.length);

export function salvarRascunhoSelecao(valor: RascunhoSelecao, idExistente?: string): string {
  try {
    const dados = esquema.parse(valor);
    const id = idExistente === undefined ? globalThis.crypto.randomUUID() : identificador.parse(idExistente);
    window.sessionStorage.setItem(`eventos:selecao:${id}`, JSON.stringify(dados));
    return id;
  } catch {
    throw new Error("Não foi possível guardar a seleção neste navegador. Tente novamente antes de continuar.");
  }
}

export function lerRascunhoSelecao(id: string, sessionId: string): RascunhoSelecao | null {
  try {
    if (!identificador.safeParse(id).success) return null;
    const texto = window.sessionStorage.getItem(`eventos:selecao:${id}`);
    if (!texto) return null;
    const resultado = esquema.safeParse(JSON.parse(texto));
    return resultado.success && resultado.data.sessionId === sessionId ? resultado.data : null;
  } catch {
    return null;
  }
}
