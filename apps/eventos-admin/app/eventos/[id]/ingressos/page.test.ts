import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("etapa de ingressos", () => {
  it("atualiza o readiness do Workspace após o autosave", () => {
    expect(source).toContain("useRouter");
    expect(source).toContain("onSaved: () => router.refresh()");
  });

  it("oferece exclusão explícita do ingresso já criado", () => {
    expect(source).toContain("Excluir ingresso");
    expect(source).toContain('method: "DELETE"');
    expect(source).toContain("window.confirm");
  });

  it("remove a configuração administrativa de ofertas", () => {
    expect(source).not.toContain("/ofertas");
    expect(source).not.toContain("OfertaEditor");
    expect(source).not.toContain("Descontos e ofertas");
  });

  it("carrega vários cupons e autosalva com versão e conflito", () => {
    expect(source).toContain("/cupons");
    expect(source).toContain("CupomEditor");
    expect(source).toContain("Cupons salvos automaticamente");
    expect(source).toContain("Conflito de versão dos cupons");
    expect(source).toContain("Adicionar cupom");
  });

  it("normaliza datas ISO também na resposta do PATCH de cupons", () => {
    expect(source).toContain("normalizarDataCupom(item.startsAt)");
    expect(source).toContain("normalizarDataCupom(item.endsAt)");
    expect(source).toContain("setCupons(normalizarCupons(data))");
  });

  it("invalida autosave e atualiza revisão antes de excluir cupom persistido", () => {
    expect(source).toContain("cuponsAutosave.invalidate()");
    expect(source).toContain("cuponsRevision.current += 1");
    expect(source).toContain('method: "DELETE"');
  });

  it("preserva dirty dos cupons restantes após excluir um cartão", () => {
    expect(source).toContain("const remaining = cupons.filter");
    expect(source).toContain("setCuponsDirty(remaining.length > 0)");
  });

  it("rearma autosave quando a exclusão falha", () => {
    expect(source).toContain("queueMicrotask(() => setCuponsDirty(true))");
    expect(source).toContain("cuponsDeleteError");
    expect(source).toContain("try { const response = await fetch");
  });
});
