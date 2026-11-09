import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import Page from "./page";

describe("página de consulta de ingressos", () => {
  it("preenche o primeiro número quando pedido vem repetido na query", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pedido: ["PRIMEIRO123", "SEGUNDO456"] }) }));
    expect(html).toContain('name="orderNumber"');
    expect(html).toContain('value="PRIMEIRO123"');
    expect(html).not.toContain("SEGUNDO456");
  });

  it("mantém o campo vazio sem pedido", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('name="orderNumber"');
    expect(html).toContain('value=""');
  });
});
