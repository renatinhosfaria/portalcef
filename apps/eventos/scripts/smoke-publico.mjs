import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const evento = { id: "e1", slug: "ballet", title: "O chamado do oceano", summary: "Experiência", description: "Descrição", category: "Cultura", imageUrl: "https://www.portalcef.com.br/storage/demo.jpg", startsAt: "2026-11-05T18:00:00Z", locationName: "Auditório", fromPriceCents: 4500, availability: "available" };
const ofertaVolume = { id: "oferta-volume", version: 1, name: "Ballet em grupo", minQuantity: 10, maxQuantity: null, discountPercent: 15 };
const sessoes = [{ id: "s1", startsAt: "2026-11-05T18:00:00Z", endsAt: "2026-11-05T20:00:00Z", availability: "available", mapId: "m1", location: { name: "Auditório", room: "Sala A", address: "Rua A", accessibility: "Rampa" }, ticketTypes: [{ id: "t1", name: "Adulto", priceCents: 4500 }, { id: "t2", name: "Criança", priceCents: 2250 }], offers: [ofertaVolume] }, { id: "s3", startsAt: "2026-11-05T16:00:00Z", availability: "available", mapId: "m1", location: { name: "Auditório" }, ticketTypes: [{ id: "t1", name: "Adulto", priceCents: 4500 }], offers: [] }, { id: "s2", startsAt: "2026-11-06T18:00:00Z", availability: "sold_out", mapId: null, location: { name: "Auditório" }, ticketTypes: [], offers: [] }];
const assentosAdicionais = Array.from({ length: 18 }, (_, index) => ({ id: `a${index + 4}`, rowLabel: "A", seatNumber: index + 4, x: (index + 3) * 2, y: 0, width: 1, height: 1, state: "available", accessible: false }));
const mapa = { sessionId: "s1", seats: [{ id: "c1", rowLabel: "C", seatNumber: 1, x: 0, y: -1, width: 1, height: 1, state: "blocked", accessible: false }, { id: "a1", rowLabel: "A", seatNumber: 1, x: 0, y: 0, width: 1, height: 1, state: "available", accessible: true }, { id: "a2", rowLabel: "A", seatNumber: 2, x: 2, y: 0, width: 1, height: 1, state: "reserved", accessible: false }, { id: "a3", rowLabel: "A", seatNumber: 3, x: 4, y: 0, width: 1, height: 1, state: "available", accessible: false }, ...assentosAdicionais, { id: "b1", rowLabel: "B", seatNumber: 1, x: 0, y: 1, width: 1, height: 1, state: "sold", accessible: false }, { id: "b2", rowLabel: "B", seatNumber: 2, x: 2, y: 1, width: 1, height: 1, state: "blocked", accessible: false }, { id: "b3", rowLabel: "B", seatNumber: 3, x: 0, y: 1, width: 1, height: 1, state: "blocked", accessible: false }] };

let catalogoModo = "normal";
function resposta(path) {
  if (path === "/api/eventos/public" && catalogoModo === "empty") return [];
  if (path === "/api/eventos/public" && catalogoModo === "error") return { erroCatalogo: true };
  if (path === "/api/eventos/public") return [evento, { ...evento, id: "e2", slug: "sem-imagem", title: "Sem imagem", imageUrl: null, availability: "sold_out" }];
  if (path === "/api/eventos/public/ballet") return evento;
  if (path === "/api/eventos/public/ballet/sessoes") return sessoes;
  if (path === "/api/eventos/public/ballet/politicas") return ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"].map((type) => ({ type, version: 1, content: "Política" }));
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
  const lugaresDisponiveis = mapa.seats.filter((seat) => seat.state === "available");
  if (mapa.seats.length < 20 || lugaresDisponiveis.length < 20) throw new Error(`${nome}: fixture precisa ter pelo menos 20 assentos disponíveis`);
  const contexto = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const pagina = await contexto.newPage();
  const errosConsole = [];
  const respostasErro = [];
  const urlsImagensRemotasConhecidas = new Set();
  const postsReserva = [];
  const ehImagemRemotaConhecida = (url) => {
    try {
      const endereco = new URL(url);
      return endereco.pathname === "/_next/image" && decodeURIComponent(endereco.href).includes("www.portalcef.com.br");
    } catch {
      return false;
    }
  };
  const eh403ImagemRemotaConhecida = (status, url) => status === 403 && ehImagemRemotaConhecida(url);
  const chaveRespostaErro = ({ status, url }) => `${status} ${url}`;
  const ehErroConsoleImagemRemotaConhecida = ({ url }, snapshot) => snapshot.urls.includes(url);
  const ehRespostaImagemRemotaConhecida = (resposta, snapshot) => snapshot.respostas.includes(chaveRespostaErro(resposta));
  const filtrarErrosConsole = (erros, snapshot) => erros.filter((erro) => !ehErroConsoleImagemRemotaConhecida(erro, snapshot));
  const filtrarRespostasErro = (respostas, snapshot) => respostas.filter((resposta) => !ehRespostaImagemRemotaConhecida(resposta, snapshot));
  const descreverErrosConsole = (erros) => erros.map(({ texto, url }) => `${texto}${url ? ` [${url}]` : ""}`).join(" | ");
  const descreverRespostasErro = (respostas) => respostas.map(({ status, url }) => `${status} ${url}`).join(" | ");
  pagina.on("console", (mensagem) => { if (mensagem.type() === "error") errosConsole.push({ texto: mensagem.text(), url: mensagem.location().url }); });
  pagina.on("pageerror", (erro) => errosConsole.push({ texto: erro.message, url: "" }));
  pagina.on("response", (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    const imagemRemotaConhecida = eh403ImagemRemotaConhecida(response.status(), url);
    if (imagemRemotaConhecida) urlsImagensRemotasConhecidas.add(url);
    respostasErro.push({ status: response.status(), url });
  });
  pagina.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/eventos/public/reservas") postsReserva.push(request.url());
  });
  const acessar = async (url) => pagina.goto(`${baseUrl}${url}`, { waitUntil: "networkidle", timeout: 30000 });
  const mudarCatalogo = async (modo) => { await fetch(`http://127.0.0.1:${apiPort}/__mode?value=${modo}`); await acessar("/"); };
  await acessar("/");
  const catalogo = { titulo: await pagina.getByText("O chamado do oceano").count(), semImagem: await pagina.getByText("Sem imagem").count(), imagem: await pagina.locator('img[alt="O chamado do oceano"], [role="img"][aria-label="O chamado do oceano"]').count(), link: await pagina.getByRole("link", { name: /O chamado do oceano/ }).count() };
  if (!catalogo.titulo || !catalogo.semImagem || !catalogo.imagem || !catalogo.link) throw new Error(`${nome}: catálogo incompleto (${JSON.stringify(catalogo)})`);
  await mudarCatalogo("empty");
  if (!await pagina.getByText("Nenhum evento disponível").count() || await pagina.locator('p[role="alert"]').count()) throw new Error(`${nome}: catálogo vazio incorreto`);
  await mudarCatalogo("error");
  if (!await pagina.locator('[role="alert"]').filter({ hasText: "Não foi possível carregar os eventos" }).count() || await pagina.getByText("Nenhum evento disponível").count()) throw new Error(`${nome}: catálogo de erro incorreto`);
  await mudarCatalogo("normal");
  await acessar("/evento/ballet");
  if (!await pagina.getByRole("heading", { name: "O chamado do oceano" }).count() || !await pagina.getByText("Sessões").count() || !await pagina.getByText("Esgotada").count()) throw new Error(`${nome}: detalhe incompleto`);
  const grupos = pagina.locator('section[aria-labelledby^="dia-"]');
  if (await grupos.count() !== 2) throw new Error(`${nome}: agrupamento de sessões incorreto`);
  const primeiroGrupo = await grupos.nth(0).innerText();
  if (primeiroGrupo.indexOf("13:00") === -1 || primeiroGrupo.indexOf("15:00") === -1 || primeiroGrupo.indexOf("13:00") > primeiroGrupo.indexOf("15:00")) throw new Error(`${nome}: ordenação de sessões incorreta`);
  const inicioSessao = {
    errosConsole: errosConsole.length,
    respostasErro: respostasErro.length,
    snapshotConhecido: Object.freeze({
      urls: Object.freeze([...urlsImagensRemotasConhecidas]),
      respostas: Object.freeze(respostasErro.filter((resposta) => eh403ImagemRemotaConhecida(resposta.status, resposta.url)).map(chaveRespostaErro)),
    }),
  };
  await acessar("/evento/ballet/sessao/s1?ticketTypeId=t1");
  const lista = pagina.getByRole("button", { name: "Lista", exact: true });
  const mapaBotao = pagina.getByRole("button", { name: "Mapa", exact: true });
  const modoEsperado = viewport.width < 768 ? "lista" : "mapa";
  await pagina.waitForFunction((esperado) => {
    const grupo = document.querySelector('[aria-label="Modo de visualização dos assentos"]');
    const botao = grupo?.querySelector(`button[aria-pressed="true"]`);
    return botao?.textContent?.trim().toLowerCase() === esperado;
  }, modoEsperado);
  const garantirLista = async () => {
    await pagina.waitForFunction(() => Boolean(document.querySelector('[aria-label="Modo de visualização dos assentos"] button[aria-pressed]')));
    await pagina.waitForTimeout(100);
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      if (await lista.getAttribute("aria-pressed") === "true") return;
      await lista.click({ force: true });
      await pagina.waitForTimeout(100);
    }
    throw new Error(`${nome}: não foi possível ativar a lista de assentos`);
  };
  const fimCarregamentoInicial = { errosConsole: errosConsole.length, respostasErro: respostasErro.length };
  const errosMapaInicial = filtrarErrosConsole(errosConsole.slice(inicioSessao.errosConsole, fimCarregamentoInicial.errosConsole), inicioSessao.snapshotConhecido);
  const respostasMapaInicial = filtrarRespostasErro(respostasErro.slice(inicioSessao.respostasErro, fimCarregamentoInicial.respostasErro), inicioSessao.snapshotConhecido);
  if (errosMapaInicial.length || respostasMapaInicial.length) throw new Error(`${nome}: erros no carregamento inicial do mapa (console: ${descreverErrosConsole(errosMapaInicial)}; rede: ${descreverRespostasErro(respostasMapaInicial)})`);
  if (await lista.getAttribute("aria-pressed") !== String(modoEsperado === "lista") || await mapaBotao.getAttribute("aria-pressed") !== String(modoEsperado === "mapa")) throw new Error(`${nome}: modo inicial não respeita o viewport`);
  await (modoEsperado === "lista" ? mapaBotao : lista).click();
  if (await lista.getAttribute("aria-pressed") !== String(modoEsperado !== "lista") || await mapaBotao.getAttribute("aria-pressed") !== String(modoEsperado === "lista")) throw new Error(`${nome}: alternância para o modo oposto falhou`);
  await (modoEsperado === "lista" ? lista : mapaBotao).click();
  if (await lista.getAttribute("aria-pressed") !== String(modoEsperado === "lista") || await mapaBotao.getAttribute("aria-pressed") !== String(modoEsperado === "mapa")) throw new Error(`${nome}: retorno ao modo inicial falhou`);

  await mapaBotao.click();
  const svg = pagina.locator('section[aria-label="Mapa de assentos"] svg');
  await svg.waitFor({ state: "visible" });
  const grupoSvg = svg.locator(":scope > g").first();
  await pagina.waitForFunction(() => Boolean(document.querySelector('section[aria-label="Mapa de assentos"] svg > g')?.getAttribute("transform")));
  const transformInicial = await grupoSvg.getAttribute("transform");
  await pagina.getByRole("button", { name: "Aumentar zoom" }).click();
  const transformAumentado = await grupoSvg.getAttribute("transform");
  await pagina.getByRole("button", { name: "Reduzir zoom" }).click();
  const transformReduzido = await grupoSvg.getAttribute("transform");
  await pagina.getByRole("button", { name: "Centralizar mapa" }).click();
  const transformCentralizado = await grupoSvg.getAttribute("transform");
  if (!transformInicial || !transformAumentado || transformAumentado === transformInicial || !transformReduzido || transformReduzido === transformAumentado || transformCentralizado !== transformInicial || !transformCentralizado.includes("scale(1)")) throw new Error(`${nome}: controles de zoom não alteram/restauram o transform (${JSON.stringify({ transformInicial, transformAumentado, transformReduzido, transformCentralizado })})`);

  const fileira = pagina.getByRole("combobox", { name: "Escolha uma fileira" });
  await fileira.selectOption("B");
  await pagina.waitForTimeout(30);
  const transformFileiraB = await grupoSvg.getAttribute("transform");
  await fileira.selectOption("A");
  await pagina.waitForTimeout(30);
  const transformFileiraA = await grupoSvg.getAttribute("transform");
  if (!transformFileiraA || !transformFileiraB || transformFileiraA === transformFileiraB) throw new Error(`${nome}: foco do mapa não acompanha a fileira`);

  if (await pagina.getByRole("button", { name: /^Assento A-2,/ }).count() || await pagina.getByRole("button", { name: /^Assento B-1,/ }).count() || await pagina.getByRole("button", { name: /^Assento B-2,/ }).count()) throw new Error(`${nome}: assento indisponível acionável`);
  const assentoDisponivel = svg.locator('[data-seat-id="a3"][role="button"]');
  await assentoDisponivel.focus();
  if (!await assentoDisponivel.evaluate((element) => document.activeElement === element)) throw new Error(`${nome}: foco de teclado ausente`);
  const pontoClique = await assentoDisponivel.locator("rect").evaluate((rect) => {
    const caixa = rect.getBoundingClientRect();
    for (const fatorX of [0.2, 0.5, 0.8]) for (const fatorY of [0.2, 0.5, 0.8]) {
      const x = caixa.left + caixa.width * fatorX;
      const y = caixa.top + caixa.height * fatorY;
      if (document.elementFromPoint(x, y)?.closest('[data-seat-id="a3"]')) return { x, y };
    }
    return null;
  });
  if (!pontoClique) throw new Error(`${nome}: geometria do assento disponível ausente`);
  await pagina.mouse.click(pontoClique.x, pontoClique.y);
  await pagina.waitForTimeout(30);
  const assentoDisponivelSelecionado = await assentoDisponivel.getAttribute("aria-pressed");
  if (assentoDisponivelSelecionado !== "true") {
    const atingido = await pagina.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-seat-id]")?.getAttribute("data-seat-id"), pontoClique);
    throw new Error(`${nome}: seleção de assento disponível falhou (aria-pressed=${assentoDisponivelSelecionado}, atingido=${atingido}, ponto=${JSON.stringify(pontoClique)})`);
  }
  const caixaDisponivel = await assentoDisponivel.boundingBox();
  const caixaBloqueado = await pagina.getByRole("img", { name: /Assento B-2/ }).boundingBox();
  if (!caixaDisponivel || !caixaBloqueado || caixaDisponivel.width <= 0 || caixaDisponivel.height <= 0 || caixaBloqueado.width <= 0 || caixaBloqueado.height <= 0 || caixaDisponivel.x === caixaBloqueado.x || caixaDisponivel.y === caixaBloqueado.y) throw new Error(`${nome}: geometria do mapa não aplicada`);
  const overflowMapa = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflowMapa) throw new Error(`${nome}: overflow horizontal no mapa visível`);

  // Aceite integrado: a vitrine lê a oferta, calcula a prévia para 9/10
  // lugares e mantém a seleção mista sem reservar antes do CTA.
  await acessar("/evento/ballet/sessao/s1");
  await garantirLista();
  const listaOferta = pagina.getByRole("list", { name: "Assentos da fileira A" });
  const selecionarAssento = async (numero) => {
    const botao = listaOferta.getByRole("button", { name: new RegExp(`Assento A-${numero}, disponível`) });
    if (!await botao.count()) throw new Error(`${nome}: assento A-${numero} ausente no mock de aceite`);
    await botao.click();
  };
  const escolherTipo = async (numero, tipo) => {
    await pagina.getByRole("radiogroup", { name: `Tipo de ingresso do assento A-${numero}`, exact: true }).getByText(tipo, { exact: false }).click();
  };
  for (const numero of [1, 3, 4, 5, 6, 7, 8, 9, 10]) await selecionarAssento(numero);
  // Assentos começam sem tipo: o checkout só libera depois da escolha.
  if (await pagina.getByText("Continuar para checkout").last().getAttribute("href") || !await pagina.getByText("Escolha o tipo de ingresso de cada assento para continuar.").count()) throw new Error(`${nome}: checkout liberado antes de escolher o tipo de cada assento`);
  for (const numero of [1, 3, 4, 5, 6, 7, 8, 9, 10]) await escolherTipo(numero, "Adulto");
  const resumoOferta = pagina.getByRole("region", { name: "Resumo dos assentos selecionados" });
  const nove = await resumoOferta.innerText();
  if (!nove.includes("15% de desconto a partir de 10 lugares")) throw new Error(`${nome}: oferta pública ativa ausente`);
  if (!nove.includes("Quantidade: 9 assento(s)") || !nove.includes("Subtotal: R$ 405,00") || !nove.includes("Desconto: R$ 0,00") || !nove.includes("Total: R$ 405,00")) throw new Error(`${nome}: prévia de 9 lugares incorreta (${nove})`);
  await selecionarAssento(11);
  await escolherTipo(11, "Adulto");
  const dezAdultos = await resumoOferta.innerText();
  if (!dezAdultos.includes("Quantidade: 10 assento(s)") || !dezAdultos.includes("Subtotal: R$ 450,00") || !dezAdultos.includes("Desconto: R$ 67,50") || !dezAdultos.includes("Total: R$ 382,50")) throw new Error(`${nome}: prévia de 10 adultos incorreta (${dezAdultos})`);
  for (const numero of [7, 8, 9, 10]) await escolherTipo(numero, "Criança");
  const misto = await resumoOferta.innerText();
  if (!misto.includes("Subtotal: R$ 360,00") || !misto.includes("Desconto: R$ 54,00") || !misto.includes("Total: R$ 306,00")) throw new Error(`${nome}: prévia mista 6+4 incorreta (${misto})`);
  const checkoutAntesDeContinuar = pagina.getByRole("link", { name: "Continuar para checkout" }).last();
  if (!await checkoutAntesDeContinuar.getAttribute("href") || postsReserva.length) throw new Error(`${nome}: seleção de 10 lugares não habilitou o CTA sem POST de reserva`);

  await acessar("/evento/ballet/sessao/s1");
  await garantirLista();
  const numerosVinte = [1, 3, ...Array.from({ length: 18 }, (_, index) => index + 4)];
  for (const numero of numerosVinte) await selecionarAssento(numero);
  for (const numero of numerosVinte) await escolherTipo(numero, "Adulto");
  const vinteAssentos = await pagina.getByRole("region", { name: "Resumo dos assentos selecionados" }).innerText();
  const checkoutVinte = pagina.getByRole("link", { name: "Continuar para checkout" }).last();
  if (!vinteAssentos.includes("Quantidade: 20 assento(s)") || !await checkoutVinte.getAttribute("href") || postsReserva.length) throw new Error(`${nome}: seleção de 20 lugares não habilitou o CTA sem POST de reserva (${vinteAssentos})`);

  await acessar("/evento/ballet/sessao/s1");
  await garantirLista();
  const listaAssentos = pagina.getByRole("list", { name: "Assentos da fileira A" });
  await listaAssentos.getByRole("button", { name: /A-3, disponível/ }).click();
  await listaAssentos.getByRole("button", { name: /A-3, disponível/ }).click();
  await pagina.waitForTimeout(30);
  await listaAssentos.getByRole("button", { name: /A-1, disponível/ }).click();
  await pagina.waitForTimeout(30);
  await listaAssentos.getByRole("button", { name: /A-3, disponível/ }).click();
  await pagina.waitForTimeout(30);
  await escolherTipo(1, "Adulto");
  await escolherTipo(3, "Criança");
  const checkoutLink = pagina.getByRole("link", { name: "Continuar para checkout" }).last();
  const hrefCheckout = await checkoutLink.getAttribute("href");
  const alinhamento = { resumo: await pagina.getByRole("region", { name: "Resumo dos assentos selecionados" }).count(), href: hrefCheckout, a1: await listaAssentos.getByText("Assento A-1").count(), a3: await listaAssentos.getByText("Assento A-3").count(), tipoA1: await pagina.getByRole("radiogroup", { name: "Tipo de ingresso do assento A-1", exact: true }).locator("input:checked").inputValue(), tipoA3: await pagina.getByRole("radiogroup", { name: "Tipo de ingresso do assento A-3", exact: true }).locator("input:checked").inputValue() };
  if (!alinhamento.resumo || !hrefCheckout?.includes("sessionId=s1") || !hrefCheckout.includes("assentos=a1%2Ca3") || !hrefCheckout.includes("ticketTypeIds=t1%2Ct2") || !alinhamento.a1 || !alinhamento.a3 || alinhamento.tipoA1 !== "t1" || alinhamento.tipoA3 !== "t2") throw new Error(`${nome}: resumo, sessão, assentos e tipos desalinhados (${JSON.stringify(alinhamento)})`);
  if (postsReserva.length) throw new Error(`${nome}: seleção acionou POST de reserva`);
  const overflowLista = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflowLista) throw new Error(`${nome}: overflow horizontal na lista`);
  const resumoFixo = pagina.getByRole("region", { name: "Resumo fixo da seleção" });
  if (await resumoFixo.count()) {
    // A folga no fim da página deve deixar todo o conteúdo visível acima da
    // barra fixa; durante a rolagem, ficar atrás dela por instantes é esperado.
    await pagina.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await pagina.waitForTimeout(50);
    const caixaResumo = await resumoFixo.boundingBox();
    const sobreposicao = await pagina.evaluate(() => {
      const resumo = document.querySelector('[aria-label="Resumo fixo da seleção"]')?.getBoundingClientRect();
      if (!resumo) return false;
      return Array.from(document.querySelectorAll("main a")).filter((link) => link.textContent?.includes("Continuar para checkout")).some((link) => {
        const caixa = link.getBoundingClientRect();
        return caixa.bottom > resumo.top && caixa.top < resumo.bottom && !link.closest('[aria-label="Resumo fixo da seleção"]');
      });
    });
    if (!caixaResumo || caixaResumo.x < 0 || caixaResumo.x + caixaResumo.width > viewport.width || caixaResumo.y + caixaResumo.height > viewport.height || sobreposicao) throw new Error(`${nome}: resumo fixo sobrepõe conteúdo ou excede a viewport`);
  }

  await acessar("/evento/ballet/sessao/s1?assentos=a1%2Ca2&ticketTypeIds=t1%2Ct2&conflito=disponibilidade");
  await mapaBotao.click();
  const assentoConflito = pagina.getByRole("button", { name: /A-1, disponível/ }).first();
  if (!await pagina.getByRole("alert").filter({ hasText: "Assento A-2 ficou indisponível" }).count() || !await assentoConflito.count() || await assentoConflito.getAttribute("aria-pressed") !== "true" || !await pagina.getByRole("img", { name: /A-2, indisponível/ }).count() || await pagina.getByRole("button", { name: /^Assento A-2,/ }).count()) throw new Error(`${nome}: conflito não reidrata seleção no mapa`);
  const errosMapa = [
    ...filtrarErrosConsole(errosConsole.slice(inicioSessao.errosConsole, fimCarregamentoInicial.errosConsole), inicioSessao.snapshotConhecido),
    ...errosConsole.slice(fimCarregamentoInicial.errosConsole),
  ];
  const respostasMapa = [
    ...filtrarRespostasErro(respostasErro.slice(inicioSessao.respostasErro, fimCarregamentoInicial.respostasErro), inicioSessao.snapshotConhecido),
    ...respostasErro.slice(fimCarregamentoInicial.respostasErro),
  ];
  if (errosMapa.length || respostasMapa.length) throw new Error(`${nome}: erros durante a experiência do mapa (console: ${descreverErrosConsole(errosMapa)}; rede: ${descreverRespostasErro(respostasMapa)})`);
  await acessar("/checkout?assentos=a1%2Cb2&ticketTypeIds=t1%2Ct2&sessionId=s1&slug=ballet");
  if (!await pagina.getByText("Assento 1: Adulto · R$ 45,00").count() || !await pagina.getByText("Assento 2: Criança · R$ 22,50").count() || !await pagina.getByLabel("Nome completo").count()) throw new Error(`${nome}: checkout incompleto`);
  await acessar("/pedido/PENDENTE?retorno=sucesso");
  if (!await pagina.getByText("Pagamento pendente").count()) throw new Error(`${nome}: pedido pendente ausente`);
  await acessar("/pedido/CONFIRMADO");
  if (!await pagina.getByText("Confirmado").count()) throw new Error(`${nome}: pedido conclusivo ausente`);
  await acessar("/pedido/consulta");
  if (!await pagina.getByRole("textbox", { name: "Número do pedido" }).count() || !await pagina.getByRole("button", { name: "Consultar pedido" }).count()) throw new Error(`${nome}: labels da consulta ausentes`);
  const transition = await pagina.evaluate(() => getComputedStyle(document.body).transitionDuration);
  await contexto.close();
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
