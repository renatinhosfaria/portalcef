import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogoPublico } from "../components/catalogo-publico";
import { coresPublicas } from "../components/mapa/mapa-publico";

describe("vitrine pública de Eventos", () => {
  it("declara pacote público na porta 3014 sem basePath", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.name).toBe("@essencia/eventos");
    expect(pkg.scripts.dev).toContain("3014");
    const config = readFileSync(new URL("../next.config.js", import.meta.url), "utf8");
    expect(config).not.toContain("basePath");
  });

  it("declara as dependências e a configuração compartilhada da fundação visual", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.dependencies["@essencia/ui"]).toBe("workspace:*");
    expect(pkg.dependencies["@essencia/tailwind-config"]).toBe("workspace:*");

    const tailwind = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");
    expect(tailwind).toContain("@essencia/tailwind-config");
    expect(tailwind).toContain("packages/ui");
  });

  it("passa STRIPE_PUBLISHABLE_KEY ao serviço eventos", () => {
    const compose = readFileSync(new URL("../../../docker-compose.prod.yml", import.meta.url), "utf8");
    const eventos = compose.slice(compose.indexOf("\n  eventos:"), compose.indexOf("\n  eventos-admin:"));
    expect(eventos).toContain("STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY}");
  });

  it("CSP do eventos libera o checkout embutido da Stripe", () => {
    const nginx = readFileSync(new URL("../../../nginx.conf", import.meta.url), "utf8");
    const inicio = nginx.indexOf("server_name eventos.portalcef.com.br;", nginx.indexOf("listen 443 ssl"));
    const fim = nginx.indexOf("\n    }", inicio);
    const blocoHttps = nginx.slice(inicio, fim);
    const csp = blocoHttps.match(/Content-Security-Policy-Report-Only[^\n]+/u)?.[0] ?? "";

    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com");
    expect(csp).toContain("frame-src 'self' https://js.stripe.com https://*.stripe.com https://hooks.stripe.com");
  });

  it("transpila a UI e permite imagens do storage público", () => {
    const config = readFileSync(new URL("../next.config.js", import.meta.url), "utf8");
    expect(config).toContain('"@essencia/ui"');
    expect(config).toContain('"@essencia/shared"');
    expect(config).toContain('hostname: "www.portalcef.com.br"');
    expect(config).toContain('pathname: "/storage/**"');
    expect(config).toContain('protocol: "https", hostname: "minio.essencia.edu.br"');
    expect(config).toContain('pathname: "/essencia-uploads/**"');
    expect(config).toContain('protocol: "http", hostname: "localhost", port: "9000"');
  });

  it("mantém layout anônimo e catálogo com links públicos", () => {
    const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    const cabecalho = readFileSync(new URL("../components/base/cabecalho.tsx", import.meta.url), "utf8");
    expect(layout).toContain('lang="pt-BR"');
    expect(layout).toContain("export const metadata");
    expect(layout).toContain("export const viewport");
    expect(cabecalho).toContain("/pedido/consulta");
    expect(layout).toContain("<Cabecalho />");
    expect(layout).toContain("<RodapeConfianca />");
    expect(layout).not.toContain("bg-blue");
    expect(layout).not.toContain("TenantProvider");
    expect(layout).not.toContain("Shell");
    expect(layout).not.toContain("/api/auth/me");
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).toContain("Eventos do Colégio Essência Feliz");
    expect(page).toContain("listarEventosPublicosServidor");
    const catalog = readFileSync(new URL("../components/catalogo-eventos.tsx", import.meta.url), "utf8");
    expect(catalog).toContain("EventoDestaque");
  });

  it("integra a vitrine ao shell compartilhado e à consulta pública", () => {
    const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    const cabecalho = readFileSync(new URL("../components/base/cabecalho.tsx", import.meta.url), "utf8");
    const consulta = readFileSync(new URL("./pedido/consulta/page.tsx", import.meta.url), "utf8");
    const catalog = readFileSync(new URL("../components/catalogo-eventos.tsx", import.meta.url), "utf8");
    const card = readFileSync(new URL("../components/evento-card.tsx", import.meta.url), "utf8");
    const detalhe = readFileSync(new URL("../components/detalhe-evento.tsx", import.meta.url), "utf8");

    expect(layout).toContain('import "@essencia/ui/globals.css"');
    expect(layout).toContain('import "./globals.css"');
    expect(cabecalho).toContain('href="/pedido/consulta"');
    expect(consulta).toContain("MeusIngressos");
    expect(catalog).toContain("<EventoCard");
    expect(card).toContain("event.imageUrl");
    expect(card).toContain("/evento/${event.slug}");
    expect(detalhe).toContain("event.imageUrl");
    expect(detalhe).toContain("ImagemPublicaEvento");
    expect(detalhe).not.toContain("<img");
  });

  it("usa somente endpoints públicos e não expõe a superfície administrativa", () => {
    const api = readFileSync(new URL("../lib/eventos-api.ts", import.meta.url), "utf8");
    expect(api).toContain('"/eventos/public"');
    expect(api).toContain("credentials: \"omit\"");
    expect(api).not.toContain("/eventos-admin");

    const appRoot = new URL(".", import.meta.url).pathname;
    const diretorioComponentes = new URL("../components/", import.meta.url).pathname;
    const diretorioLib = new URL("../lib/", import.meta.url).pathname;
    const arquivos = [appRoot, diretorioComponentes, diretorioLib]
      .flatMap((diretorio) => procurarArquivos(diretorio))
      .filter((arquivo) => /\.(tsx?|css)$/.test(arquivo) && !arquivo.endsWith(".test.ts") && !arquivo.endsWith(".test.tsx"));
    for (const arquivo of arquivos) {
      expect(readFileSync(arquivo, "utf8"), arquivo).not.toContain("/eventos-admin");
    }
  });

  it("mantém no smoke o contrato público da oferta de volume do evento", () => {
    const smoke = readFileSync(new URL("../scripts/smoke-publico.mjs", import.meta.url), "utf8");
    expect(smoke).toContain("offers");
    expect(smoke).toContain("minQuantity: 10");
    expect(smoke).toContain("maxQuantity: null");
    expect(smoke).toContain("discountPercent: 15");
    expect(smoke).toContain("O chamado do oceano");
    expect(smoke).toContain("15% de desconto a partir de 10 lugares");
    expect(smoke).toContain("Quantidade: 20 assento(s)");
    expect(smoke).toContain("POST de reserva");
  });
});

function procurarArquivos(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(diretorio, entrada.name);
    return entrada.isDirectory() ? procurarArquivos(caminho) : [caminho];
  });
}

describe("comportamento da vitrine", () => {
  it("aplica apresentação visual distinta a cada estado de assento", () => {
    const livre = { id: "livre", fileira: "G", numero: "19", x: 0, y: 0, largura: 10, altura: 10, rotacao: 0, categoria: null, acessoExterno: false, estado: "livre" as const, livre: true, acessivel: false, rotuloCurto: "G19" };
    expect(coresPublicas(livre, false)).toEqual({ preenchimento: "#ffffff", contorno: "#9fb08a", numero: "#1f2a24" });
    expect(coresPublicas({ ...livre, livre: false }, false).preenchimento).toBe("#e4e6e1");
  });

  it("preserva erro da API separado do estado vazio", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).toContain("Não foi possível carregar os eventos");
    expect(page).toContain("role=\"alert\"");
  });

  it("renderiza comportamentalmente erro e catálogo vazio como estados distintos", () => {
    const erro = renderToStaticMarkup(<CatalogoPublico events={[]} error />);
    const vazio = renderToStaticMarkup(<CatalogoPublico events={[]} error={false} />);
    expect(erro).toContain("Não foi possível carregar os eventos");
    expect(erro).toContain('role="alert"');
    expect(erro).not.toContain("Nenhum evento disponível");
    expect(vazio).toContain("Nenhum evento disponível");
    expect(vazio).not.toContain('role="alert"');
  });

  it("not-found oferece voltar à página inicial", async () => {
    const notFound = await import("./not-found");
    const html = renderToStaticMarkup(notFound.default());
    expect(html).toContain("Não encontramos esta página");
    expect(html).toContain('href="/"');
  });
});
