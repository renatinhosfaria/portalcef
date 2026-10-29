import { describe, expect, it } from "vitest";
import { canPublish, formatPublicationError, type PublicationItem } from "./publication-checklist";

const ok: PublicationItem[] = [
  { key: "TEXTOS_OBRIGATORIOS", label: "Textos", state: "OK" },
  { key: "SLUG_VALIDO", label: "Slug", state: "OK" },
];

describe("checklist de publicação", () => {
  it("bloqueia publicação enquanto houver item bloqueador", () => {
    expect(canPublish([...ok, { key: "MAPA_CONFIRMADO", label: "Mapa", state: "BLOQUEADOR" }])).toBe(false);
    expect(canPublish(ok)).toBe(true);
  });

  it("considera avisos publicáveis quando não existem bloqueadores", () => {
    expect(canPublish([...ok, { key: "IMAGEM", label: "Imagem", state: "AVISO" }])).toBe(true);
  });

  it("preserva código de concorrência para atualização da readiness", () => {
    expect(formatPublicationError({ status: 409, code: "VERSION_CONFLICT", message: "versão" })).toMatchObject({ code: "VERSION_CONFLICT", status: 409 });
  });
});

it("a página de revisão chama a publicação administrativa", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./event-review-page.tsx", import.meta.url), "utf8");
  expect(source).toContain("/eventos-admin/api/eventos/admin/");
  expect(source).toContain("/publicar");
});

it("usa a rota de revisão do shell e oferece ação para etapas pendentes", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync(new URL("../../app/eventos/[id]/revisar/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("./publication-checklist.tsx", import.meta.url), "utf8");
  expect(route).toContain("EventReviewPage");
  expect(component).toContain("Revisar etapa");
  expect(component).toContain("item.href");
});
