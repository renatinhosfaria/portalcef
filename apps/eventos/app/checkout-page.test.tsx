import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "./checkout/page";

describe("página de checkout", () => {
  it("mantém o checkout bloqueado quando a query não identifica a reserva", async () => {
    const html = renderToStaticMarkup(await Page({
      searchParams: Promise.resolve({ slug: "festival", sessionId: "sessao-1" }),
    }));

    expect(html).toContain("Não foi possível identificar o pedido e a sessão.");
    expect(html).not.toContain('name="buyerName"');
  });
});
