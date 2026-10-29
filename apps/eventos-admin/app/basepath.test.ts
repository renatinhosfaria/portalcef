import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function listarArquivosTsx(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = `${diretorio}/${entrada.name}`;
    if (entrada.isDirectory()) return listarArquivosTsx(caminho);
    return entrada.name.endsWith(".tsx") ? [caminho] : [];
  });
}

describe("proxy com basePath", () => {
  it("usa a URL administrativa pública completa", () => {
    expect(readFileSync(new URL("./page.tsx", import.meta.url), "utf8")).toContain(
      "/eventos-admin/api/eventos/admin",
    );
  });

  it("deixa o Next prefixar o basePath nos links internos", () => {
    const diretorioApp = fileURLToPath(new URL(".", import.meta.url));
    const linksDuplicados = listarArquivosTsx(diretorioApp).flatMap((arquivo) => {
      const conteudo = readFileSync(arquivo, "utf8");
      return /href\s*=\s*(?:\{)?[\x60"']\/eventos-admin/.test(conteudo) ? [arquivo] : [];
    });

    expect(linksDuplicados).toEqual([]);
  });
});
