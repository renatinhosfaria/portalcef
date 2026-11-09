import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const evento = {
  id: "evento-1",
  slug: "ballet",
  title: "O chamado do oceano",
  summary: "Uma apresentação para toda a família.",
  description: "Descrição do espetáculo.",
  category: "Cultura",
  imageUrl: "https://www.portalcef.com.br/storage/arte-ballet.jpg",
  startsAt: "2026-11-05T18:00:00.000Z",
  locationName: "Auditório Essência Feliz",
  fromPriceCents: 4500,
  availability: "available",
  contactEmail: "eventos@portalcef.com.br",
  contactPhone: "3432927388",
  cancellationPolicy: "Política de cancelamento.",
};

const sessao = {
  id: "sessao-1",
  startsAt: "2026-11-05T18:00:00.000Z",
  endsAt: "2026-11-05T20:00:00.000Z",
  status: "PUBLICADA",
  capacity: 2,
  mapId: "mapa-1",
  location: { name: "Auditório Essência Feliz", address: "Rua A, 100", room: "Sala A", instructions: null, accessibility: "Rampa" },
  salesStartsAt: null,
  salesEndsAt: null,
  availability: "available",
  ticketTypes: [
    { id: "tipo-adulto", name: "Adulto", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null },
  ],
  offers: [{ id: "oferta-volume", version: 1, name: "Ballet em grupo", minQuantity: 10, maxQuantity: null, discountPercent: 15 }],
};

// O contrato da oferta também permanece coberto no mock: 15% de desconto a partir de 10 lugares.
// A seleção de 20 lugares continua sendo o limite exercitado no fluxo completo (Quantidade: 20 assento(s)).
// POST de reserva é interceptado pelo servidor HTTP mockado abaixo.

const mapa = {
  sessionId: sessao.id,
  mapId: sessao.mapId,
  seats: [
    { id: "a1", sessionId: sessao.id, rowLabel: "A", seatNumber: "1", x: 3, y: 4, width: 1, height: 1, category: null, accessible: false, state: "available" },
    { id: "a2", sessionId: sessao.id, rowLabel: "A", seatNumber: "2", x: 5, y: 4, width: 1, height: 1, category: null, accessible: false, state: "available" },
  ],
  layout: {
    largura: 10,
    altura: 8,
    rotulos: [{ fileira: "A", x: 4, y: 5 }, { fileira: "X", x: 8, y: 2 }],
    elementos: [{ tipo: "PALCO", texto: "PALCO", x: 5, y: 1 }],
  },
};

const politicas = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, version: 1, content: "Política do evento." }));
const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const pedido = {
  orderNumber: "PEDIDO123",
  status: "RESERVADO",
  eventTitle: evento.title,
  eventSlug: evento.slug,
  sessionId: sessao.id,
  expiresAt,
  session: { startsAt: sessao.startsAt, endsAt: sessao.endsAt },
  subtotalCents: 9000,
  discountCents: 0,
  totalCents: 9000,
  appliedOffer: null,
  items: [
    { seatId: "a1", ticketTypeId: "tipo-adulto", unitPriceCents: 4500, totalPriceCents: 4500, rowLabel: "A", seatNumber: "1", ticketTypeName: "Adulto" },
    { seatId: "a2", ticketTypeId: "tipo-adulto", unitPriceCents: 4500, totalPriceCents: 4500, rowLabel: "A", seatNumber: "2", ticketTypeName: "Adulto" },
  ],
};
const ingressos = {
  ...pedido,
  status: "CONFIRMADO",
  buyerName: "Ana Souza",
  event: { title: evento.title, slug: evento.slug, imageUrl: evento.imageUrl, locationName: evento.locationName },
  tickets: [
    { numero: "K7Q482MX", qrPayload: "qr-k7q4", rowLabel: "A", seatNumber: "1", ticketTypeName: "Adulto", participantName: "Ana Souza", status: "ATIVO" },
    { numero: "B2P911CD", qrPayload: "qr-b2p9", rowLabel: "A", seatNumber: "2", ticketTypeName: "Adulto", participantName: "Bruno Souza", status: "ATIVO" },
  ],
};

function json(response, value, status = 200) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(value));
}

function iniciarApi() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    if (path === "/api/eventos/public" && request.method === "GET") return json(response, [evento]);
    if (path === "/api/eventos/public/ballet" && request.method === "GET") return json(response, evento);
    if (path === "/api/eventos/public/ballet/sessoes" && request.method === "GET") return json(response, [sessao]);
    if (path === "/api/eventos/public/ballet/politicas" && request.method === "GET") return json(response, politicas);
    if (path === "/api/eventos/public/sessoes/sessao-1/map" && request.method === "GET") return json(response, mapa);
    if (path === "/api/eventos/public/reservas" && request.method === "POST") return json(response, { reservationId: "reserva-1", orderNumber: pedido.orderNumber, expiresAt, subtotalCents: pedido.subtotalCents, discountCents: 0, totalCents: pedido.totalCents, appliedOffer: null, items: pedido.items });
    if (path === "/api/eventos/public/pedidos/PEDIDO123" && request.method === "GET") return json(response, pedido);
    if (path === "/api/eventos/public/pedidos/PEDIDO123/finalizar" && request.method === "POST") return json(response, { pedido: { ...pedido, status: "AGUARDANDO_PAGAMENTO" }, acesso: "acesso-seguro-123" });
    if (path === "/api/eventos/public/pedidos/PEDIDO123/checkout" && request.method === "POST") return json(response, { clientSecret: "cs_test_smoke", expiresAt, orderNumber: pedido.orderNumber });
    if (path === "/api/eventos/public/pedidos/PEDIDO123/ingressos" && request.method === "GET") return json(response, ingressos);
    if (path === "/api/eventos/public/pedidos/PEDIDO123/liberar" && request.method === "POST") { response.statusCode = 204; return response.end(); }
    if (path === "/api/eventos/public/meus-ingressos" && request.method === "POST") return json(response, { pedidos: [{ orderNumber: pedido.orderNumber, eventTitle: evento.title, sessionStartsAt: sessao.startsAt, acesso: "acesso-seguro-123" }] });
    return json(response, { message: `Rota não mockada: ${request.method} ${path}` }, 404);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function portaDoServidor(server) {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Não foi possível descobrir a porta do servidor");
  return address.port;
}

async function portaLivre() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = portaDoServidor(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function aguardarServidor(baseUrl) {
  for (let tentativa = 0; tentativa < 30; tentativa += 1) {
    try { if ((await fetch(`${baseUrl}/`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Servidor Next não iniciou a tempo");
}

async function exercitarViewport(browser, nome, viewport, apiPort, baseUrl) {
  const contexto = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const pagina = await contexto.newPage();
  const errosConsole = [];
  const respostasErro = [];
  await pagina.route("**/api/eventos/**", async (route) => {
    const origem = new URL(route.request().url());
    const destino = `http://127.0.0.1:${apiPort}${origem.pathname}${origem.search}`;
    const resposta = await fetch(destino, {
      method: route.request().method(),
      headers: route.request().headers(),
      body: ["GET", "HEAD"].includes(route.request().method()) ? undefined : route.request().postDataBuffer(),
    });
    await route.fulfill({ status: resposta.status, headers: { "content-type": resposta.headers.get("content-type") ?? "application/json" }, body: Buffer.from(await resposta.arrayBuffer()) });
  });
  pagina.route("**/_next/image**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='#a3d154'/></svg>" });
  });
  pagina.on("console", (mensagem) => { if (mensagem.type() === "error") errosConsole.push(mensagem.text()); });
  pagina.on("pageerror", (erro) => errosConsole.push(erro.message));
  pagina.on("response", (response) => { if (response.status() >= 400) respostasErro.push(`${response.status()} ${response.url()}`); });

  async function acessar(url) {
    await pagina.goto(`${baseUrl}${url}`, { waitUntil: "networkidle", timeout: 30000 });
    await pagina.waitForTimeout(50);
    const diagnostico = await pagina.evaluate(() => {
      const main = document.querySelector("main");
      const conteudo = main?.querySelector(".content-width, .content-narrow") ?? main;
      const caixa = conteudo?.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > window.innerWidth, mainLeft: caixa?.left ?? 0, contentClass: conteudo?.className ?? "", text: conteudo?.textContent?.slice(0, 80) ?? "" };
    });
    if (diagnostico.overflow) throw new Error(`${nome}: rolagem horizontal em ${url}`);
    if (diagnostico.mainLeft < 16) throw new Error(`${nome}: conteúdo principal encostado na borda em ${url} (${diagnostico.mainLeft}px; ${diagnostico.contentClass}; ${diagnostico.text})`);
    if (errosConsole.length || respostasErro.length) throw new Error(`${nome}: erros em ${url} (console=${errosConsole.join(" | ")}; rede=${respostasErro.join(" | ")})`);
  }

  await acessar("/");
  if (!await pagina.getByTestId("evento-destaque").count() || !await pagina.getByText(evento.title).count()) throw new Error(`${nome}: catálogo em destaque ausente`);

  await acessar("/evento/ballet");
  const arte = pagina.getByRole("img", { name: evento.title }).first();
  if (!await arte.count() || !(await arte.getAttribute("class"))?.includes("object-contain")) throw new Error(`${nome}: arte do evento não usa object-fit contain`);

  await acessar("/evento/ballet/sessao/sessao-1");
  if (!await pagina.getByText("PALCO", { exact: true }).count() || !await pagina.getByText("A", { exact: true }).count()) throw new Error(`${nome}: mapa sem PALCO ou letra A`);
  if (await pagina.getByText("X", { exact: true }).count()) throw new Error(`${nome}: rótulo órfão X foi exibido`);
  const assento1 = pagina.getByRole("button", { name: /Fileira A, assento 1, livre/ });
  const assento2 = pagina.getByRole("button", { name: /Fileira A, assento 2, livre/ });
  if (!await assento1.count() || !await assento2.count()) throw new Error(`${nome}: dois lugares livres ausentes`);
  await assento1.click();
  await assento2.click();
  if (await assento1.getAttribute("aria-pressed") !== "true" || await assento2.getAttribute("aria-pressed") !== "true") throw new Error(`${nome}: lugares não foram marcados`);
  await pagina.getByRole("button", { name: "Continuar", exact: true }).first().click();
  await pagina.waitForTimeout(5000);
  if (!/\/checkout\?/.test(pagina.url())) throw new Error(`${nome}: reserva não navegou (url=${pagina.url()} alert=${await pagina.locator('[role="alert"]').allTextContents()} continuar=${await pagina.getByRole("button", { name: "Continuar", exact: true }).evaluateAll((els) => els.map((el) => ({ disabled: el.disabled, text: el.textContent })))})`);

  if (!await pagina.getByRole("status").filter({ hasText: "Seus lugares estão guardados por" }).count()) throw new Error(`${nome}: relógio da reserva ausente`);
  await pagina.getByLabel("Nome completo").fill("Ana Souza");
  await pagina.getByLabel("E-mail").fill("ana@example.com");
  await pagina.getByLabel("Celular (WhatsApp)").fill("34999999999");
  const participantes = pagina.locator('input[name^="participant-"]');
  for (let indice = 0; indice < await participantes.count(); indice += 1) await participantes.nth(indice).fill(indice === 0 ? "Ana Souza" : "Bruno Souza");
  await pagina.locator('input[aria-label="Li e aceito as políticas do evento"]').check();
  await pagina.getByRole("button", { name: "Ir para o pagamento" }).click();
  await pagina.waitForTimeout(3000);
  if (!await pagina.getByText("Pagamento indisponível no momento").count()) throw new Error(`${nome}: pagamento não avançou (url=${pagina.url()} alert=${await pagina.locator('[role="alert"]').allTextContents()} botao=${await pagina.locator("button").allTextContents()})`);
  if (!await pagina.getByText("Pagamento processado pela Stripe").count()) throw new Error(`${nome}: etapa Stripe não carregou o texto esperado`);

  await acessar("/pedido/PEDIDO123?acesso=acesso-seguro-123");
  await pagina.locator('[aria-label="QR code do ingresso"] svg').first().waitFor({ state: "visible", timeout: 10000 });
  if (!await pagina.getByText("K7Q4-82MX").count()) throw new Error(`${nome}: ingressos sem número K7Q4-82MX (texto=${(await pagina.locator("body").innerText()).slice(0, 500)})`);

  await acessar("/pedido/consulta");
  if (!await pagina.getByRole("heading", { name: "Meus ingressos" }).count()) throw new Error(`${nome}: página Meus ingressos ausente`);
  await pagina.getByRole("textbox", { name: "Número do pedido" }).fill("PEDIDO123");
  await pagina.locator('input[name="email"]').first().fill("ana@example.com");
  await pagina.getByRole("button", { name: "Buscar ingressos" }).click();
  await pagina.waitForURL(/\/pedido\/PEDIDO123\?acesso=/, { timeout: 30000 });
  if (!await pagina.getByText("K7Q4-82MX").count()) throw new Error(`${nome}: consulta não abriu os ingressos`);

  await contexto.close();
  return `${nome}: PASS (viewport ${viewport.width}x${viewport.height})`;
}

let api;
let next;
let encerrando = false;
async function encerrar() {
  if (encerrando) return;
  encerrando = true;
  if (next?.pid) {
    try { process.kill(-next.pid, "SIGTERM"); } catch { try { next.kill("SIGTERM"); } catch {} }
    await new Promise((resolve) => {
      if (next.exitCode !== null) return resolve();
      const timer = setTimeout(() => { try { process.kill(-next.pid, "SIGKILL"); } catch {} resolve(); }, 2000);
      next.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    try { process.kill(-next.pid, "SIGKILL"); } catch {}
  }
  if (api) { api.closeAllConnections?.(); await new Promise((resolve) => api.close(resolve)); }
}

const sair = (code) => { void encerrar().finally(() => process.exit(code)); };
process.once("SIGINT", () => sair(130));
process.once("SIGTERM", () => sair(143));

api = await iniciarApi();
const apiPort = portaDoServidor(api);
const nextPort = await portaLivre();
const baseUrl = `http://127.0.0.1:${nextPort}`;
next = spawn("pnpm", ["--filter", "@essencia/eventos", "exec", "next", "dev", "--port", String(nextPort)], {
  detached: true,
  env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, STRIPE_PUBLISHABLE_KEY: "" },
  stdio: "ignore",
});
try {
  await aguardarServidor(baseUrl);
  const browser = await chromium.launch({ headless: true });
  try {
    console.log(await exercitarViewport(browser, "mobile", { width: 390, height: 844 }, apiPort, baseUrl));
    console.log(await exercitarViewport(browser, "desktop", { width: 1440, height: 900 }, apiPort, baseUrl));
  } finally { await browser.close(); }
} finally { await encerrar(); }
