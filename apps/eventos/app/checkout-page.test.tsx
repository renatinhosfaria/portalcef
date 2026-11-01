import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "./checkout/page";

describe("página de checkout", () => {
  it("mantém o checkout bloqueado quando a lista da query tem percent-encoding inválido", async () => {
    const html = renderToStaticMarkup(await Page({
      searchParams: Promise.resolve({ assentos: "%", ticketTypeIds: "inteira" }),
    }));

    expect(html).toContain("Não foi possível interpretar a seleção de assentos informada.");
    expect(html).not.toContain('name="buyerName"');
  });
});
