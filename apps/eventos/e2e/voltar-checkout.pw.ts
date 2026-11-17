import { expect, test } from "@playwright/test";

const api = "http://127.0.0.1:4032";
const mapa = "/evento/retomada-checkout/sessao/11111111-1111-4111-8111-000000000200";

test("Voltar e Avançar preservam o combo e retomam o mesmo pedido", async ({ page, request }) => {
  await request.post(`${api}/__reiniciar`);
  await page.route("**/api/eventos/public/**", async rota => {
    const url = new URL(rota.request().url());
    const resposta = await rota.fetch({ url: `${api}${url.pathname}${url.search}` });
    await rota.fulfill({ response: resposta });
  });
  await page.goto(mapa);
  await page.getByRole("button", { name: "Ver lugares em lista", exact: true }).click();
  for (let numero = 1; numero <= 10; numero += 1) {
    await page.getByRole("button", { name: `Selecionar A${numero} · categoria COMUM`, exact: true }).click();
  }
  await page.getByRole("button", { name: "Adicionar pacote Combo 10 ingressos", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\?pedido=PEDIDOTESTE123&/);
  await expect(page.getByRole("complementary", { name: "Resumo do pedido" })).toBeVisible();

  await page.goBack();
  await expect(page.getByText(/Você já tem uma reserva ativa/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar compra", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => {
    const referencia = new URL(location.href).searchParams.get("selecao");
    const rascunho = JSON.parse(sessionStorage.getItem(`eventos:selecao:${referencia}`)!);
    return { lugares: rascunho.assentos.length, grupos: new Set(rascunho.assentos.map((item: { pacoteId: string }) => item.pacoteId)).size };
  })).toEqual({ lugares: 10, grupos: 1 });

  await page.goForward();
  await expect(page).toHaveURL(/\/checkout\?pedido=PEDIDOTESTE123&/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Continuar compra", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Continuar compra", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\?pedido=PEDIDOTESTE123&/);
  expect(await (await request.get(`${api}/__estado`)).json()).toEqual({ reservasCriadas: 1, requisicoesReserva: 1, liberacoes: 0, status: "INICIADO" });

  await page.goBack();
  await page.getByRole("link", { name: "Alterar lugares", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desfazer pacote Combo 10 ingressos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeEnabled();
  expect(new URL(page.url()).searchParams.has("orderNumber")).toBe(false);
  expect(await (await request.get(`${api}/__estado`)).json()).toEqual({ reservasCriadas: 1, requisicoesReserva: 1, liberacoes: 1, status: "CANCELADO" });
});
