import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("proxy de usuários", () => {
  it("usa o proxy compartilhado", () => {
    const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
    expect(source).toContain('@essencia/lib/server/api-proxy');
    expect(source).toContain('proxyRequest(request, "GET")');
  });
});
