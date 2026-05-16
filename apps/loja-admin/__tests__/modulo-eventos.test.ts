import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const raizRepositorio = path.resolve(__dirname, "../../..");

function caminhoRepositorio(...partes: string[]) {
  return path.join(raizRepositorio, ...partes);
}

function existeNoRepositorio(...partes: string[]) {
  return fs.existsSync(caminhoRepositorio(...partes));
}

function lerArquivoRepositorio(...partes: string[]) {
  return fs.readFileSync(caminhoRepositorio(...partes), "utf8");
}

describe("módulo eventos", () => {
  it("mantém inscrições de evento fora de loja-admin e publicada em eventos", () => {
    expect(existeNoRepositorio("apps/loja-admin/app/inscricoes-evento")).toBe(
      false,
    );
    expect(
      existeNoRepositorio("apps/eventos/app/inscricoes-evento/page.tsx"),
    ).toBe(true);
    expect(existeNoRepositorio("apps/eventos/app/page.tsx")).toBe(true);
    expect(lerArquivoRepositorio("apps/eventos/next.config.js")).toContain(
      'basePath: "/eventos"',
    );
    expect(lerArquivoRepositorio("apps/eventos/app/page.tsx")).toContain(
      'redirect("/eventos/inscricoes-evento")',
    );
    expect(lerArquivoRepositorio("apps/eventos/package.json")).toContain(
      '"name": "eventos"',
    );
  });

  it("remove o atalho de evento do shell da loja-admin", () => {
    const adminShell = lerArquivoRepositorio(
      "apps/loja-admin/components/AdminShell.tsx",
    );

    expect(adminShell).not.toContain("/inscricoes-evento");
    expect(adminShell).not.toContain("Mãe por Inteiro");
  });

  it("libera o módulo eventos para auxiliar administrativo", () => {
    const appSidebar = lerArquivoRepositorio(
      "packages/components/src/shell/app-sidebar.tsx",
    );
    const eventosPage = lerArquivoRepositorio(
      "apps/eventos/app/inscricoes-evento/page.tsx",
    );
    const eventosController = lerArquivoRepositorio(
      "services/api/src/modules/evento-inscricoes/evento-inscricoes.controller.ts",
    );

    expect(appSidebar).toMatch(
      /eventos:\s*\[[^\]]*"auxiliar_administrativo"[^\]]*\]/,
    );
    expect(eventosPage).toMatch(
      /ALLOWED_ROLES\s*=\s*\[[^\]]*"auxiliar_administrativo"[^\]]*\]/,
    );
    expect(eventosController).toMatch(
      /ADMIN_ROLES\s*=\s*\[[^\]]*"auxiliar_administrativo"[^\]]*\]/,
    );
  });

  it("exibe controles para confirmar presença no evento", () => {
    const eventosPage = lerArquivoRepositorio(
      "apps/eventos/app/inscricoes-evento/page.tsx",
    );

    expect(eventosPage).toContain("Presentes confirmadas");
    expect(eventosPage).toContain("Somente presentes");
    expect(eventosPage).toContain("Confirmar presença");
    expect(eventosPage).toContain("Desfazer presença");
    expect(eventosPage).toContain("presencaConfirmadaEm");
    expect(eventosPage).toContain('method: "PATCH"');
    expect(eventosPage).toContain("somentePresentes");
    expect(eventosPage).toContain("resumoSorteios");
  });

  it("exibe sorteio por brinde com histórico e elegibilidade", () => {
    const eventosPage = lerArquivoRepositorio(
      "apps/eventos/app/inscricoes-evento/page.tsx",
    );

    expect(eventosPage).toContain("Sorteio de brindes");
    expect(eventosPage).toContain("Nome do brinde");
    expect(eventosPage).toContain("Sortear entre presentes");
    expect(eventosPage).toContain("Elegíveis para sorteio");
    expect(eventosPage).toContain("Histórico de sorteios");
    expect(eventosPage).toContain("sorteios/resumo");
    expect(eventosPage).toContain("/sorteios");
    expect(eventosPage).toContain("inscricaoId");
  });
});
