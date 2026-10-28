import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const caminhoRota = new URL(
  "./eventos/admin/[[...path]]/route.ts",
  import.meta.url,
);

describe("proxy administrativo de Eventos", () => {
  it("aceita o caminho vazio e os caminhos aninhados no mesmo handler", () => {
    expect(existsSync(caminhoRota)).toBe(true);
    const fonte = readFileSync(caminhoRota, "utf8");
    expect(fonte).toContain("proxyRequest");
    expect(fonte).toContain("export async function GET");
    expect(fonte).toContain("export async function POST");
    expect(fonte).toContain("export async function PUT");
    expect(fonte).toContain("export async function PATCH");
    expect(fonte).toContain("export async function DELETE");
  });
});
