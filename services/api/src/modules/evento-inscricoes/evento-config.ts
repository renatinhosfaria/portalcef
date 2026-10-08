export interface EventoConfig {
  slug: string;
  nome: string;
  dataEvento: string;
  horarioInicio: string;
  horarioFim: string;
  local: string;
  endereco: string;
  encerramentoInscricoes: string;
}

/**
 * Configuração operacional dos eventos publicados.
 *
 * Enquanto não existe uma tela de gestão de eventos, este mapa é a fonte
 * única da API para datas, local e ciclo de inscrições.
 */
export const EVENTOS_CONFIG: Record<string, EventoConfig> = {
  "mae-por-inteiro": {
    slug: "mae-por-inteiro",
    nome: "Mãe por Inteiro",
    dataEvento: "2026-05-16",
    horarioInicio: "09:30",
    horarioFim: "12:30",
    local: "Auditório do Parque Una",
    endereco:
      "R. Nininha Rocha, 125 — Gávea, Uberlândia — MG, 38411-852",
    encerramentoInscricoes: "2026-05-16T09:30:00-03:00",
  },
};

export function obterEventoConfig(eventoSlug: string): EventoConfig | undefined {
  return EVENTOS_CONFIG[eventoSlug];
}
