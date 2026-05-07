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
});
