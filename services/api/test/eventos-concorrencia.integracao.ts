import { BadRequestException } from "@nestjs/common";
import { randomUUID } from 'node:crypto';
import { closeDb, eq, eventoIngressos, eventoPagamentos, eventoInventarioAssentos, eventoMapaAssentos, eventoMapas, eventoPedidos, eventoReservas, eventoSessoes, eventoTiposIngresso, eventos, getDb, schools, sql } from '@essencia/db';
import { EventosPagamentosService } from '../src/modules/eventos/eventos-pagamentos.service';
import { EventosService } from '../src/modules/eventos/eventos.service';
import { EventosPublicSalesService } from '../src/modules/eventos/eventos-public-sales.service';

if (process.env.EVENTOS_BANCO_TESTE !== '1' || !process.env.DATABASE_URL?.endsWith('/eventos_teste')) {
  throw new Error('Integração permitida somente no banco descartável eventos_teste. Use scripts/testar-concorrencia-eventos.sh.');
}
const db = getDb();
function sinal() {
  let resolver!: () => void;
  const promessa = new Promise<void>((resolve) => { resolver = resolve; });
  return { promessa, resolver };
}
async function cenario(quantidade = 2) {
  const [escola] = await db.insert(schools).values({ name: 'Escola de teste', code: randomUUID() }).returning();
  const [evento] = await db.insert(eventos).values({ schoolId: escola.id, slug: randomUUID(), title: 'Evento de teste', status: 'PUBLICADO' }).returning();
  const [mapa] = await db.insert(eventoMapas).values({ eventId: evento.id, originalFileKey: 'teste', status: 'CONFIRMADO' }).returning();
  const [sessao] = await db.insert(eventoSessoes).values({ eventId: evento.id, mapId: mapa.id, startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000), capacity: quantidade, status: 'PUBLICADA' }).returning();
  const [tipo] = await db.insert(eventoTiposIngresso).values({ eventId: evento.id, name: 'Inteira', priceCents: 4500 }).returning();
  const assentos = await db.insert(eventoMapaAssentos).values(Array.from({ length: quantidade }, (_, i) => ({ mapId: mapa.id, rowLabel: 'A', seatNumber: String(i + 1), x: i, y: 0 }))).returning();
  await db.insert(eventoInventarioAssentos).values(assentos.map((assento) => ({ sessionId: sessao.id, seatId: assento.id })));
  const entrada = (indice: number) => ({ sessionId: sessao.id, seats: [{ seatId: assentos[indice].id, ticketTypeId: tipo.id, participantIndex: 0 }], idempotencyKey: randomUUID() });
  return { evento, sessao, tipo, entrada };
}
const servico = (banco: any = db, pagamentos?: any) => new EventosPublicSalesService({ db: banco } as any, pagamentos);

afterAll(async () => { await closeDb(); });

describe('Concorrência com PostgreSQL real', () => {
  it('reserva outro lugar do mesmo evento enquanto a primeira transação continua aberta', async () => {
    const dados = await cenario();
    const pronta = sinal();
    const liberar = sinal();
    const bancoPrimeiro = new Proxy(db, { get(alvo, propriedade) {
      if (propriedade === 'transaction') return (executar: any) => db.transaction(async (tx) => {
        const resultado = await executar(tx);
        pronta.resolver();
        await liberar.promessa;
        return resultado;
      });
      return Reflect.get(alvo, propriedade);
    } });
    const primeira = servico(bancoPrimeiro).reservarAssentos(dados.entrada(0));
    await pronta.promessa;
    try {
      const segunda = await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '500ms'`);
        // A reserva usa a mesma transação para tornar o limite observável no PostgreSQL.
        const bancoSegundo = { transaction: (executar: any) => executar(tx) };
        return servico(bancoSegundo).reservarAssentos(dados.entrada(1));
      });
      expect(segunda.totalCents).toBe(4500);
    } finally {
      liberar.resolver();
      await primeira;
    }
  });

  it('duas compras do mesmo lugar têm exatamente uma vencedora', async () => {
    const dados = await cenario();
    const resultados = await Promise.allSettled([
      servico().reservarAssentos(dados.entrada(0)),
      servico().reservarAssentos(dados.entrada(0)),
    ]);
    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find((resultado) => resultado.status === 'rejected')).toMatchObject({ reason: { response: { code: 'SEAT_UNAVAILABLE' } } });
    const pedidos = await db.select().from(eventoPedidos).where(eq(eventoPedidos.eventId, dados.evento.id));
    expect(pedidos).toHaveLength(1);
  });
  it('não mantém transações abertas durante a chamada à Stripe', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    await db.update(eventoPedidos).set({ status: 'RESERVADO', buyerName: 'Pessoa de teste', buyerEmail: 'teste@example.invalid', buyerPhone: '34999999999' }).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    let transacoesAbertas = -1;
    const pagamentos = { createEmbeddedCheckoutSession: async () => {
      const resultado = await db.execute(sql`SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle in transaction' AND pid <> pg_backend_pid()`);
      transacoesAbertas = Number(resultado[0].total);
      return { checkoutSessionId: `cs_${randomUUID()}`, clientSecret: 'segredo_teste' };
    } };
    await servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, { returnUrl: 'https://eventos.portalcef.com.br/pagamento/retorno', idempotencyKey: randomUUID() });
    expect(transacoesAbertas).toBe(0);
  });

  it('retoma falha da Stripe com os mesmos parâmetros em outra instância e outra chave do navegador', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    await db.update(eventoPedidos).set({ status: 'RESERVADO', buyerName: 'Pessoa de teste', buyerEmail: 'teste@example.invalid', buyerPhone: '34999999999' }).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const entradas: any[] = [];
    const pagamentos = { createEmbeddedCheckoutSession: async (entrada: any) => {
      entradas.push(entrada);
      if (entradas.length === 1) throw new Error('Timeout simulado depois de enviar a requisição');
      return { checkoutSessionId: `cs_${randomUUID()}`, clientSecret: 'segredo_retomado' };
    } };
    const entrada = { returnUrl: 'https://eventos.portalcef.com.br/pagamento/retorno', idempotencyKey: randomUUID() };
    await expect(servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, entrada)).rejects.toThrow('Timeout simulado');
    await expect(servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, { ...entrada, idempotencyKey: randomUUID() })).resolves.toMatchObject({ clientSecret: 'segredo_retomado' });
    expect(entradas[1]).toEqual(entradas[0]);
  });

  it('recusa liberação enquanto a Stripe ainda cria a sessão e permite liberar após sua conclusão', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    await db.update(eventoPedidos).set({ status: 'RESERVADO', buyerName: 'Pessoa de teste', buyerEmail: 'teste@example.invalid' }).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const iniciou = sinal();
    const concluir = sinal();
    const pagamentos = {
      createEmbeddedCheckoutSession: async () => { iniciou.resolver(); await concluir.promessa; return { checkoutSessionId: `cs_${randomUUID()}`, clientSecret: 'segredo_teste' }; },
      encerrarCheckoutSessionSeAberta: async () => 'encerrada',
    };
    const checkout = servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, { returnUrl: 'https://eventos.portalcef.com.br/pagamento/retorno', idempotencyKey: randomUUID() });
    await iniciou.promessa;
    try {
      await expect(servico(db, pagamentos).liberarPedido(reserva.orderNumber)).rejects.toMatchObject({ response: { code: 'CHECKOUT_IN_PROGRESS' } });
    } finally { concluir.resolver(); await checkout; }
    await servico(db, pagamentos).liberarPedido(reserva.orderNumber);
    const [pedido] = await db.select().from(eventoPedidos).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    expect(pedido.status).toBe('CANCELADO');
  });

  it('lista catálogo sem transferir o produto de tipos por todos os assentos', async () => {
    const dados = await cenario(100);
    await db.insert(eventoTiposIngresso).values({ eventId: dados.evento.id, name: 'Meia-entrada', priceCents: 2250 });
    let linhas = 0;
    const observar = (consulta: any): any => new Proxy(consulta, { get(alvo, propriedade) {
      if (propriedade === 'then') return (resolver: any, rejeitar: any) => alvo.then((resultado: any[]) => { linhas += resultado.length; return resolver(resultado); }, rejeitar);
      const valor = Reflect.get(alvo, propriedade);
      return typeof valor === 'function' ? (...args: any[]) => {
        const resultado = valor.apply(alvo, args);
        return resultado && typeof resultado === 'object' && ('then' in resultado || 'where' in resultado) ? observar(resultado) : resultado;
      } : valor;
    } });
    const monitorado = new Proxy(db, { get(alvo, propriedade) {
      if (propriedade === 'select') return (...args: any[]) => observar((alvo.select as any)(...args));
      return Reflect.get(alvo, propriedade);
    } });
    const servicoEventos = new EventosService({ db: monitorado } as any, {} as any, undefined, undefined);
    const catalogo = await servicoEventos.listarPublicados(new Date());
    expect(catalogo.find((item) => item.id === dados.evento.id)).toMatchObject({ fromPriceCents: 4500, availability: 'available' });
    // Há poucos eventos dos testes anteriores. Inventário de 100 assentos não
    // deve provocar centenas de linhas trafegadas para montar um único cartão.
    expect(linhas).toBeLessThan(100);
  });

  it('duas instâncias usam uma única preparação e uma sessão idempotente', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    await db.update(eventoPedidos).set({ status: 'RESERVADO', buyerName: 'Pessoa de teste', buyerEmail: 'teste@example.invalid' }).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const sessoes = new Map<string, any>();
    const pagamentos = {
      createEmbeddedCheckoutSession: async (entrada: any) => {
        if (!sessoes.has(entrada.idempotencyKey)) sessoes.set(entrada.idempotencyKey, { checkoutSessionId: `cs_${randomUUID()}`, clientSecret: 'segredo_unico' });
        return sessoes.get(entrada.idempotencyKey);
      },
      obterClientSecretSeAberta: async () => 'segredo_unico',
    };
    const entrada = () => ({ returnUrl: 'https://eventos.portalcef.com.br/pagamento/retorno', idempotencyKey: randomUUID() });
    const resultados = await Promise.all([servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, entrada()), servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, entrada())]);
    expect(resultados.map((resultado) => resultado.clientSecret)).toEqual(['segredo_unico', 'segredo_unico']);
    expect(sessoes.size).toBe(1);
    const [pedido] = await db.select().from(eventoPedidos).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    expect(await db.select().from(eventoPagamentos).where(eq(eventoPagamentos.orderId, pedido.id))).toHaveLength(1);
  });

  it('webhook antes da resposta do checkout emite uma vez e não é sobrescrito', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    await db.update(eventoPedidos).set({ status: 'RESERVADO', buyerName: 'Pessoa de teste', buyerEmail: 'teste@example.invalid' }).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const confirmacao = new EventosPagamentosService({ db } as any);
    const sessaoStripe = `cs_${randomUUID()}`;
    const pagamentos = { createEmbeddedCheckoutSession: async (entrada: any) => {
      await confirmacao.confirmarCheckout({ checkoutSessionId: sessaoStripe, amountCents: 4500, eventOrderId: entrada.orderId, chaveCheckout: entrada.eventCheckoutKey });
      return { checkoutSessionId: sessaoStripe, clientSecret: 'segredo_pago' };
    } };
    await expect(servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, { returnUrl: 'https://eventos.portalcef.com.br/pagamento/retorno', idempotencyKey: randomUUID() })).rejects.toMatchObject({ response: { code: 'PAYMENT_ALREADY_COMPLETED' } });
    const [pedido] = await db.select().from(eventoPedidos).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const [pagamento] = await db.select().from(eventoPagamentos).where(eq(eventoPagamentos.orderId, pedido.id));
    expect(pedido.status).toBe('CONFIRMADO');
    expect(pagamento.status).toBe('APROVADO');
    await confirmacao.confirmarCheckout({ checkoutSessionId: sessaoStripe, amountCents: 4500, eventOrderId: pedido.id });
    expect(await db.select().from(eventoIngressos).where(eq(eventoIngressos.orderId, pedido.id))).toHaveLength(1);
  });

  it('processa uma rajada de 50 reservas independentes sem perder nem duplicar assentos', async () => {
    const dados = await cenario(50);
    const inicio = performance.now();
    const resultados = await Promise.all(Array.from({ length: 50 }, (_, indice) => servico().reservarAssentos(dados.entrada(indice))));
    expect(new Set(resultados.map((resultado) => resultado.orderNumber)).size).toBe(50);
    const inventarios = await db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.sessionId, dados.sessao.id));
    expect(inventarios.filter((inventario) => inventario.status === 'RESERVADO')).toHaveLength(50);
    console.info(`Medição isolada: 50 reservas em ${Math.round(performance.now() - inicio)} ms (PostgreSQL limitado a 1 CPU/256 MB).`);
  });

  it('renova a preparação após rejeição explícita do prazo mínimo, preservando a chave em timeout ambíguo', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    await db.update(eventoPedidos).set({ status: 'RESERVADO', buyerName: 'Pessoa de teste', buyerEmail: 'teste@example.invalid' }).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const entradas: any[] = [];
    const pagamentos = { createEmbeddedCheckoutSession: async (entrada: any) => {
      entradas.push(entrada);
      if (entradas.length === 1) throw new Error('Conexão interrompida antes da resposta');
      if (entrada.expiresAt.getTime() < Date.now() + 30 * 60000) throw new BadRequestException({ code: 'CHECKOUT_EXPIRATION_INVALID' });
      return { checkoutSessionId: `cs_${randomUUID()}`, clientSecret: 'segredo_novo_prazo' };
    } };
    const entrada = () => ({ returnUrl: 'https://eventos.portalcef.com.br/pagamento/retorno', idempotencyKey: randomUUID() });
    await expect(servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, entrada())).rejects.toThrow('Conexão interrompida');
    const agora = Date.now();
    const relogio = jest.spyOn(Date, 'now').mockReturnValue(agora + 6 * 60000);
    try { await expect(servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, entrada())).resolves.toMatchObject({ clientSecret: 'segredo_novo_prazo' }); }
    finally { relogio.mockRestore(); }
    expect(entradas).toHaveLength(3);
    expect(entradas[1]).toEqual(entradas[0]);
    expect(entradas[2].idempotencyKey).not.toBe(entradas[0].idempotencyKey);
  });

  it('ignora cancelamento atrasado do PaymentIntent antigo enquanto prepara um checkout novo', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    await db.update(eventoPedidos).set({ status: 'RESERVADO', buyerName: 'Pessoa de teste', buyerEmail: 'teste@example.invalid' }).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const confirmacao = new EventosPagamentosService({ db } as any);
    let chaveAntiga = '';
    let chamadas = 0;
    const pagamentos = {
      obterClientSecretSeAberta: async () => null,
      encerrarCheckoutSessionSeAberta: async () => 'encerrada',
      createEmbeddedCheckoutSession: async (entrada: any) => {
        chamadas += 1;
        if (chamadas === 1) { chaveAntiga = entrada.idempotencyKey; return { checkoutSessionId: 'cs_antiga', paymentIntentId: 'pi_antigo', clientSecret: 'segredo_antigo' }; }
        await confirmacao.falharCheckout({ paymentIntentId: 'pi_antigo', eventOrderId: entrada.orderId, chaveCheckout: chaveAntiga, reason: 'PaymentIntent cancelado no Stripe' } as any);
        return { checkoutSessionId: 'cs_nova', clientSecret: 'segredo_novo' };
      },
    };
    const entrada = () => ({ returnUrl: 'https://eventos.portalcef.com.br/pagamento/retorno', idempotencyKey: randomUUID() });
    await servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, entrada());
    await expect(servico(db, pagamentos).iniciarCheckout(reserva.orderNumber, entrada())).resolves.toMatchObject({ clientSecret: 'segredo_novo' });
    const [pedido] = await db.select().from(eventoPedidos).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    expect(pedido.status).toBe('AGUARDANDO_PAGAMENTO');
  });

  it('impede mudança administrativa de configuração durante a reserva', async () => {
    const dados = await cenario();
    const pronta = sinal();
    const liberar = sinal();
    const banco = { transaction: (executar: any) => db.transaction(async (tx) => { const resultado = await executar(tx); pronta.resolver(); await liberar.promessa; return resultado; }) };
    const reserva = servico(banco).reservarAssentos(dados.entrada(0));
    await pronta.promessa;
    try {
      await expect(db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '300ms'`);
        await tx.update(eventos).set({ status: 'PAUSADO' }).where(eq(eventos.id, dados.evento.id));
      })).rejects.toMatchObject({ cause: { code: '55P03' } });
    } finally { liberar.resolver(); await reserva; }
  });

  it('disputa pelos mesmos lugares em ordem inversa não forma deadlock', async () => {
    const dados = await cenario();
    const lugares = [dados.entrada(0).seats[0], dados.entrada(1).seats[0]];
    const entrada = (inverter: boolean) => ({ sessionId: dados.sessao.id, seats: (inverter ? [...lugares].reverse() : lugares).map((lugar, participantIndex) => ({ ...lugar, participantIndex })), idempotencyKey: randomUUID() });
    const resultados = await Promise.allSettled([servico().reservarAssentos(entrada(false)), servico().reservarAssentos(entrada(true))]);
    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find((resultado) => resultado.status === 'rejected')).toMatchObject({ reason: { response: { code: 'SEAT_UNAVAILABLE' } } });
  });

  it('expiração concorrente com retomada não libera assento do novo comprador', async () => {
    const dados = await cenario();
    const reserva = await servico().reservarAssentos(dados.entrada(0));
    const [antigo] = await db.select().from(eventoPedidos).where(eq(eventoPedidos.orderNumber, reserva.orderNumber));
    const expirouEm = new Date(Date.now() - 60000);
    await db.update(eventoPedidos).set({ expiresAt: expirouEm }).where(eq(eventoPedidos.id, antigo.id));
    await db.update(eventoReservas).set({ expiresAt: expirouEm }).where(eq(eventoReservas.orderId, antigo.id));
    await db.update(eventoInventarioAssentos).set({ reservationExpiresAt: expirouEm }).where(eq(eventoInventarioAssentos.reservedByOrderId, antigo.id));
    const [novo] = await Promise.all([servico().reservarAssentos(dados.entrada(0)), servico().liberarReservasExpiradas(new Date())]);
    const [pedido] = await db.select().from(eventoPedidos).where(eq(eventoPedidos.orderNumber, novo.orderNumber));
    const [assento] = await db.select().from(eventoInventarioAssentos).where(eq(eventoInventarioAssentos.reservedByOrderId, pedido.id));
    expect(assento.status).toBe('RESERVADO');
  });

});
