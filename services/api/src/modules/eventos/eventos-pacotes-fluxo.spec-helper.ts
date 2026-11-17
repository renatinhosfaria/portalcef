import { eventoAceites, eventoAuditorias, eventoCupons, eventoCupomUsos, eventoIngressos, eventoInventarioAssentos, eventoItensPedido, eventoLocais, eventoMapaAssentos, eventoPagamentos, eventoParticipantes, eventoPedidos, eventoPoliticas, eventoReservas, eventoSessoes, eventoTiposIngresso, eventoTokensConsulta, eventos } from "@essencia/db";

export const uuidPacoteTeste = (numero: number) => `00000000-0000-4000-8000-${String(numero).padStart(12, "0")}`;
type Linha = Record<string, any>;

/** Fronteira de banco em memória: executa predicados, joins e rollback, sem simular regras de venda. */
export function criarBancoFluxoPacotes(quantidade: number, falharNaReserva?: number) {
  const tabelas = new Map<unknown, Linha[]>();
  const ler = (tabela: unknown) => { if (!tabelas.has(tabela)) tabelas.set(tabela, []); return tabelas.get(tabela)!; };
  const nome = (tabela: any): string => tabela.id.__table;
  const idEvento = uuidPacoteTeste(1), idSessao = uuidPacoteTeste(2), idTipo = uuidPacoteTeste(3);
  ler(eventos).push({ id: idEvento, status: "PUBLICADO", title: "Evento de teste", slug: "evento-teste" });
  ler(eventoSessoes).push({ id: idSessao, eventId: idEvento, status: "PUBLICADA", startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000) });
  ler(eventoTiposIngresso).push({ id: idTipo, eventId: idEvento, name: "Combo 10", priceCents: 38000, lugaresPorPacote: 10, maxPerOrder: null, version: 1, active: true, internal: false });
  for (let i = 0; i < quantidade; i++) {
    ler(eventoMapaAssentos).push({ id: uuidPacoteTeste(100+i), rowLabel: "A", seatNumber: String(i+1) });
    ler(eventoInventarioAssentos).push({ id: uuidPacoteTeste(200+i), sessionId: idSessao, seatId: uuidPacoteTeste(100+i), status: "DISPONIVEL", reservedByOrderId: null });
  }
  const tiposPolitica = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"];
  tiposPolitica.forEach((type, i) => ler(eventoPoliticas).push({ id: uuidPacoteTeste(400+i), eventId: idEvento, type, version: 1, active: true }));
  ler(eventoCupons).push({ id: uuidPacoteTeste(500), eventId: idEvento, code: "DEZ", name: "Dez por cento", version: 1, active: true, pricingType: "PERCENTUAL", discountPercent: 10, discountCents: null, startsAt: null, endsAt: null, usageLimit: null, usageLimitPerBuyer: null });
  for (const tabela of [eventoAceites, eventoAuditorias, eventoCupomUsos, eventoIngressos, eventoItensPedido, eventoLocais, eventoPagamentos, eventoParticipantes, eventoPedidos, eventoReservas, eventoTokensConsulta]) ler(tabela);

  function contexto(tabela: unknown, linha: Linha): Record<string, Linha | undefined> {
    const valores: Record<string, Linha | undefined> = { [nome(tabela)]: linha };
    const colocar = (alvo: unknown, valor: Linha | undefined) => { valores[nome(alvo)] = valor; };
    let item = tabela === eventoItensPedido ? linha : undefined;
    if (tabela === eventoIngressos) { item = ler(eventoItensPedido).find(i => i.id === linha.itemId); colocar(eventoItensPedido, item); colocar(eventoParticipantes, ler(eventoParticipantes).find(p => p.id === linha.participantId)); }
    if (item) {
      const inventario = ler(eventoInventarioAssentos).find(i => i.id === item!.inventorySeatId);
      colocar(eventoInventarioAssentos, inventario);
      colocar(eventoTiposIngresso, ler(eventoTiposIngresso).find(t => t.id === item!.ticketTypeId));
      colocar(eventoMapaAssentos, ler(eventoMapaAssentos).find(s => s.id === inventario?.seatId));
    }
    if (tabela === eventoPedidos || tabela === eventos) {
      colocar(eventos, tabela === eventos ? linha : ler(eventos).find(e => e.id === linha.eventId));
      colocar(eventoSessoes, ler(eventoSessoes).find(s => tabela === eventos ? s.eventId === linha.id : s.id === linha.sessionId));
    }
    return valores;
  }
  function corresponde(predicado: any, valores: Record<string, Linha | undefined>): boolean {
    if (!predicado?.name) return true;
    if (predicado.name === "and") return predicado.args.every((p: any) => corresponde(p, valores));
    if (predicado.name === "eq") {
      const [coluna, esperado] = predicado.args;
      if (esperado?.__column) return true;
      return valores[coluna.__table]?.[coluna.__column] === esperado;
    }
    throw new Error(`Operador não implementado na fixture: ${predicado.name}`);
  }
  function operacao(executar: () => Linha[]) {
    let resultado: Linha[] | undefined;
    const obter = () => resultado ??= executar();
    return { returning: async () => obter(), then: (resolver: any, rejeitar: any) => Promise.resolve().then(obter).then(resolver, rejeitar) };
  }
  let sequencia = 1000, reservasAtualizadas = 0;
  const db: any = { tabelas, ler };
  db.transaction = async (executar: (tx: any) => Promise<unknown>) => {
    const anterior = [...tabelas].map(([tabela, linhas]) => [tabela, structuredClone(linhas)] as const);
    try { return await executar(db); } catch (error) { tabelas.clear(); for (const [tabela, linhas] of anterior) tabelas.set(tabela, linhas); throw error; }
  };
  db.select = (projecao?: Record<string, unknown>) => {
    let tabela: unknown, predicado: any, temJoin = false;
    const obter = () => ler(tabela).filter(linha => corresponde(predicado, contexto(tabela, linha))).map(linha => {
      const valores = contexto(tabela, linha);
      if (projecao) return Object.fromEntries(Object.entries(projecao).map(([alias, alvo]) => [alias, valores[nome(alvo)]]));
      if (temJoin && tabela === eventos) return { event: valores[nome(eventos)], session: valores[nome(eventoSessoes)] };
      return linha;
    });
    const consulta: any = { from: (alvo: unknown) => { tabela = alvo; return consulta; }, where: (valor: any) => { predicado = valor; return consulta; }, innerJoin: () => { temJoin = true; return consulta; }, leftJoin: () => consulta, orderBy: () => consulta, for: () => consulta, then: (resolver: any, rejeitar: any) => Promise.resolve().then(obter).then(resolver, rejeitar) };
    return consulta;
  };
  db.insert = (tabela: unknown) => ({ values: (valores: Linha) => operacao(() => { const linha = { id: uuidPacoteTeste(sequencia++), createdAt: new Date(), ...valores }; ler(tabela).push(linha); return [linha]; }) });
  db.update = (tabela: unknown) => ({ set: (valores: Linha) => ({ where: (predicado: any) => operacao(() => {
    if (tabela === eventoInventarioAssentos && valores.status === "RESERVADO" && ++reservasAtualizadas === falharNaReserva) throw new Error("Falha simulada ao reservar assento");
    const alteradas = ler(tabela).filter(linha => corresponde(predicado, contexto(tabela, linha)));
    alteradas.forEach(linha => Object.assign(linha, valores));
    return alteradas;
  }) }) });
  return { db, ler, idSessao, idTipo, tiposPolitica };
}
