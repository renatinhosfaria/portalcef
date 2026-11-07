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

  it("carrega e salva ofertas com credenciais junto da etapa de ingressos", () => {
    expect(source).toContain("/ofertas");
    expect(source).toContain('credentials: "include"');
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain("OfertaEditor");
  });

  it("atualiza a versão retornada pela API e mostra o estado do autosave", () => {
    expect(source).toContain("version");
    expect(source).toContain("ofertas salvas automaticamente");
    expect(source).toContain("Oferta arquivada");
  });

  it("aguarda o GET de ofertas antes de habilitar o editor e preserva o bloqueio em erro", () => {
    expect(source).toContain("ofertaLoading");
    expect(source).toContain("Carregando oferta");
    expect(source).toContain("ofertaError");
    expect(source).toContain("disabled={ofertaLoading || Boolean(ofertaError) ||");
  });
});
