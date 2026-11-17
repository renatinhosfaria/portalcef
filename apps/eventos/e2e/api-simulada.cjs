// API isolada para testar o histórico real do Next.js, sem banco nem serviços de produção.
const { createServer } = require("node:http");
const prefixo = "/api/eventos/public";
const id = numero => `11111111-1111-4111-8111-${String(numero).padStart(12, "0")}`;
const evento = { id: id(100), slug: "retomada-checkout", title: "Evento de teste", summary: null, description: null, imageUrl: null, category: null, startsAt: "2099-12-07T19:00:00Z", locationName: "Auditório", fromPriceCents: 4500, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const combo = { id: id(300), name: "Combo 10 ingressos", lugaresPorPacote: 10, priceCents: 38000, description: null, maxPerOrder: null, eligibility: null };
const sessao = { id: id(200), startsAt: evento.startsAt, endsAt: "2099-12-07T21:00:00Z", status: "PUBLICADA", capacity: 12, location: null, mapId: id(400), salesStartsAt: null, salesEndsAt: null, availability: "available", ticketTypes: [{ ...combo, id: id(301), name: "Ingresso", lugaresPorPacote: 1, priceCents: 4500 }, combo], offers: [] };
const assentos = Array.from({ length: 12 }, (_, indice) => ({ id: id(indice + 1), sessionId: sessao.id, rowLabel: "A", seatNumber: String(indice + 1), x: indice * 20, y: 0, width: 15, height: 15, category: "COMUM", accessible: false }));
let pedido = null;
let reservasCriadas = 0;
let requisicoesReserva = 0;
let liberacoes = 0;

createServer(async (requisicao, resposta) => {
  const caminho = new URL(requisicao.url, "http://127.0.0.1").pathname;
  const enviar = (valor, status = 200) => { resposta.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); resposta.end(JSON.stringify(valor)); };
  if (caminho === "/health") return enviar({ status: "ok" });
  if (caminho === "/__estado") return enviar({ reservasCriadas, requisicoesReserva, liberacoes, status: pedido?.status });
  if (caminho === "/__reiniciar" && requisicao.method === "POST") { pedido = null; reservasCriadas = 0; requisicoesReserva = 0; liberacoes = 0; return enviar({ ok: true }); }
  if (caminho === prefixo) return enviar([evento]);
  if (caminho === `${prefixo}/${evento.slug}`) return enviar(evento);
  if (caminho === `${prefixo}/${evento.slug}/sessoes`) return enviar([sessao]);
  if (caminho === `${prefixo}/${evento.slug}/politicas`) return enviar([]);
  if (caminho === `${prefixo}/sessoes/${sessao.id}/map`) return enviar({ sessionId: sessao.id, mapId: sessao.mapId, seats: assentos.map(assento => ({ ...assento, state: pedido?.status === "INICIADO" && pedido.items.some(item => item.seatId === assento.id) ? "reserved" : "available" })) });
  if (caminho === `${prefixo}/reservas` && requisicao.method === "POST") {
    requisicoesReserva += 1;
    let texto = ""; for await (const parte of requisicao) texto += parte;
    const entrada = JSON.parse(texto);
    if (!pedido) {
      reservasCriadas += 1;
      pedido = { orderNumber: "PEDIDOTESTE123", reservationId: id(500), status: "INICIADO", eventTitle: evento.title, eventSlug: evento.slug, sessionId: sessao.id, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), session: { startsAt: sessao.startsAt, endsAt: sessao.endsAt }, subtotalCents: 38000, totalCents: 38000, offerDiscountCents: 0, couponDiscountCents: 0, discountCents: 0, appliedOffer: null, appliedCoupon: null, items: entrada.seats.map((item, indice) => ({ seatId: item.seatId, ticketTypeId: item.ticketTypeId, participantIndex: indice, unitPriceCents: 3800, totalPriceCents: 3800, rowLabel: "A", seatNumber: assentos.find(assento => assento.id === item.seatId).seatNumber, ticketTypeName: combo.name, pacote: { id: item.pacoteId, lugaresPorPacote: 10, precoPacoteCentavos: 38000, versaoTipo: 1, nomeTipo: combo.name } })) };
    }
    return enviar(pedido, 201);
  }
  if (pedido && caminho === `${prefixo}/pedidos/${pedido.orderNumber}`) return enviar(pedido);
  if (pedido && caminho === `${prefixo}/pedidos/${pedido.orderNumber}/liberar` && requisicao.method === "POST") { liberacoes += 1; pedido.status = "CANCELADO"; return enviar({ liberado: true }); }
  enviar({ code: "NOT_FOUND" }, 404);
}).listen(4032, "127.0.0.1");
