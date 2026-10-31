import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const evento = { id: "e1", slug: "festival-demo", title: "Festival Demo", summary: "Experiência", description: "Descrição", category: "Cultura", imageUrl: "https://www.portalcef.com.br/storage/demo.jpg", startsAt: "2026-11-05T18:00:00Z", locationName: "Auditório", fromPriceCents: 5000, availability: "available" };
const sessoes = [{ id: "s1", startsAt: "2026-11-05T18:00:00Z", endsAt: "2026-11-05T20:00:00Z", availability: "available", mapId: "m1", location: { name: "Auditório", room: "Sala A", address: "Rua A", accessibility: "Rampa" }, ticketTypes: [{ id: "t1", name: "Inteira", priceCents: 5000 }, { id: "t2", name: "Meia", priceCents: 2500 }] }, { id: "s3", startsAt: "2026-11-05T16:00:00Z", availability: "available", mapId: "m1", location: { name: "Auditório" }, ticketTypes: [{ id: "t1", name: "Inteira", priceCents: 5000 }] }, { id: "s2", startsAt: "2026-11-06T18:00:00Z", availability: "sold_out", mapId: null, location: { name: "Auditório" }, ticketTypes: [] }];
const mapa = { sessionId: "s1", seats: [{ id: "a1", rowLabel: "A", seatNumber: 1, x: 0, y: 0, width: 1, height: 1, state: "available", accessible: true }, { id: "a2", rowLabel: "A", seatNumber: 2, x: 2, y: 0, width: 1, height: 1, state: "reserved", accessible: false }, { id: "b1", rowLabel: "B", seatNumber: 1, x: 0, y: 2, width: 1, height: 1, state: "sold", accessible: false }, { id: "b2", rowLabel: "B", seatNumber: 2, x: 2, y: 2, width: 1, height: 1, state: "blocked", accessible: false }] };

let catalogoModo = "normal";
function resposta(path) {
  if (path === "/api/eventos/public" && catalogoModo === "empty") return [];
  if (path === "/api/eventos/public" && catalogoModo === "error") return { erroCatalogo: true };
  if (path === "/api/eventos/public") return [evento, { ...evento, id: "e2", slug: "sem-imagem", title: "Sem imagem", imageUrl: null, availability: "sold_out" }];
  if (path === "/api/eventos/public/festival-demo") return evento;
  if (path === "/api/eventos/public/festival-demo/sessoes") return sessoes;
  if (path === "/api/eventos/public/festival-demo/politicas") return ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, version: 1, content: "Política" }));
  if (path === "/api/eventos/public/sessoes/s1/map") return mapa;
  if (path.startsWith("/api/eventos/public/pedidos/")) { const orderNumber = path.split("/").pop(); return { orderNumber, eventTitle: evento.title, status: orderNumber === "PENDENTE" ? "AGUARDANDO_PAGAMENTO" : "CONFIRMADO", session: sessoes[0], items: [{ seatId: "a1" }] }; }
  return undefined;
}

function iniciarApi() {
  const server = createServer((request, response) => { const url = new URL(request.url ?? "/", "http://127.0.0.1"); if (url.pathname === "/__mode") { catalogoModo = url.searchParams.get("value") ?? "normal"; response.statusCode = 204; return response.end(); } const body = resposta(url.pathname); const erro = body?.erroCatalogo; response.statusCode = erro ? 500 : body ? 200 : 404; response.setHeader("content-type", "application/json"); response.end(JSON.stringify(erro ? { message: "falha simulada" } : body ?? { message: "not found" })); });
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

async function aguardarServidor(baseUrl) { for (let tentativa = 0; tentativa < 30; tentativa += 1) { try { const response = await fetch(`${baseUrl}/pedido/consulta`); if (response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 1000)); } throw new Error("Servidor Next não iniciou a tempo"); }

async function exercitarViewport(browser, nome, viewport) {
  const contexto = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const pagina = await contexto.newPage();
  const acessar = async (url) => pagina.goto(`${baseUrl}${url}`, { waitUntil: "networkidle", timeout: 30000 });
  const mudarCatalogo = async (modo) => { await fetch(`http://127.0.0.1:${apiPort}/__mode?value=${modo}`); await acessar("/"); };
  await acessar("/");
  if (!await pagina.getByText("Festival Demo").count() || !await pagina.getByText("Sem imagem").count() || !await pagina.locator('img[alt="Festival Demo"]').count() || !await pagina.getByRole("link", { name: /Festival Demo/ }).count()) throw new Error(`${nome}: catálogo incompleto`);
  await mudarCatalogo("empty");
  if (!await pagina.getByText("Nenhum evento disponível").count() || await pagina.locator('p[role="alert"]').count()) throw new Error(`${nome}: catálogo vazio incorreto`);
  await mudarCatalogo("error");
  if (!await pagina.locator('p[role="alert"]').filter({ hasText: "Não foi possível carregar os eventos" }).count() || await pagina.getByText("Nenhum evento disponível").count()) throw new Error(`${nome}: catálogo de erro incorreto`);
  await mudarCatalogo("normal");
  await acessar("/evento/festival-demo");
  if (!await pagina.getByRole("heading", { name: "Festival Demo" }).count() || !await pagina.getByText("Sessões").count() || !await pagina.getByText("Esgotada").count()) throw new Error(`${nome}: detalhe incompleto`);
  const grupos = pagina.locator('section[aria-labelledby^="dia-"]');
  if (await grupos.count() !== 2) throw new Error(`${nome}: agrupamento de sessões incorreto`);
  const primeiroGrupo = await grupos.nth(0).innerText();
  if (primeiroGrupo.indexOf("13:00") === -1 || primeiroGrupo.indexOf("15:00") === -1 || primeiroGrupo.indexOf("13:00") > primeiroGrupo.indexOf("15:00")) throw new Error(`${nome}: ordenação de sessões incorreta`);
  await acessar("/evento/festival-demo/sessao/s1?ticketTypeId=t1");
  if (await pagina.getByRole("button", { name: /A-2/ }).count()) throw new Error(`${nome}: assento indisponível acionável`);
  await pagina.getByRole("button", { name: /A-1/ }).focus();
  if (!await pagina.getByRole("button", { name: /A-1/ }).evaluate((element) => document.activeElement === element)) throw new Error(`${nome}: foco de teclado ausente`);
  await pagina.getByRole("button", { name: /A-1/ }).click();
  if (!await pagina.getByRole("region", { name: "Resumo dos assentos selecionados" }).count() || !(await pagina.getByRole("link", { name: /Continuar/ }).getAttribute("href")).includes("sessionId=s1")) throw new Error(`${nome}: mapa/resumo incompleto`);
  const caixaDisponivel = await pagina.getByRole("button", { name: /A-1/ }).boundingBox();
  const caixaBloqueado = await pagina.getByLabel(/Assento B-2/).boundingBox();
  if (!caixaDisponivel || !caixaBloqueado || caixaDisponivel.width <= 0 || caixaDisponivel.height <= 0 || caixaBloqueado.width <= 0 || caixaBloqueado.height <= 0 || caixaDisponivel.x === caixaBloqueado.x || caixaDisponivel.y === caixaBloqueado.y) throw new Error(`${nome}: geometria do mapa não aplicada`);
  await acessar("/checkout?assentos=a1%2Cb2&ticketTypeIds=t1%2Ct2&sessionId=s1&slug=festival-demo");
  if (!await pagina.getByText("Assento a1: t1").count() || !await pagina.getByText("Assento b2: t2").count() || !await pagina.getByLabel("Nome completo").count()) throw new Error(`${nome}: checkout incompleto`);
  await acessar("/pedido/PENDENTE?retorno=sucesso");
  if (!await pagina.getByText("Pagamento pendente").count()) throw new Error(`${nome}: pedido pendente ausente`);
  await acessar("/pedido/CONFIRMADO");
  if (!await pagina.getByText("CONFIRMADO").count()) throw new Error(`${nome}: pedido conclusivo ausente`);
  await acessar("/pedido/consulta");
  if (!await pagina.getByRole("textbox", { name: "Número do pedido" }).count() || !await pagina.getByRole("button", { name: "Consultar pedido" }).count()) throw new Error(`${nome}: labels da consulta ausentes`);
  const overflow = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${nome}: overflow horizontal`);
  const transition = await pagina.evaluate(() => getComputedStyle(document.body).transitionDuration);
  return `${nome}: PASS (viewport ${viewport.width}x${viewport.height}, reduced-motion ${transition})`;
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
      const timer = setTimeout(() => { try { process.kill(-next.pid, "SIGKILL"); } catch { try { next.kill("SIGKILL"); } catch {} } resolve(); }, 2000);
      next.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    // O wrapper do pnpm pode encerrar antes do processo Next filho; mate o
    // grupo inteiro para não deixar um servidor órfão ocupando a porta.
    try { process.kill(-next.pid, "SIGKILL"); } catch { /* grupo já encerrado */ }
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
next = spawn("pnpm", ["--filter", "@essencia/eventos", "exec", "next", "dev", "--port", String(nextPort)], { detached: true, env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, stdio: "ignore" });
try { await aguardarServidor(baseUrl); const browser = await chromium.launch({ headless: true }); try { console.log(await exercitarViewport(browser, "mobile", { width: 390, height: 844 })); console.log(await exercitarViewport(browser, "desktop", { width: 1440, height: 900 })); } finally { await browser.close(); } } finally { await encerrar(); }
