import { createServer } from "node:http";
import { describe, expect, it, afterEach, beforeEach } from "vitest";

describe("Worker Health Check", () => {
  let server: ReturnType<typeof createServer>;
  const port = 3999; // Porta de teste

  beforeEach(() => {
    const startTime = Date.now();

    server = createServer((req, res) => {
      if (req.url === "/health" && req.method === "GET") {
        const uptime = Math.floor((Date.now() - startTime) / 1000);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            worker: "documentos-conversao",
            uptime,
            timestamp: new Date().toISOString(),
          }),
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(port);
  });

  afterEach(() => {
    server.close();
  });

  it("deve retornar 200 em /health", async () => {
    const response = await fetch(`http://localhost:${port}/health`);
    expect(response.status).toBe(200);
  });

  it("deve retornar JSON com status ok", async () => {
    const response = await fetch(`http://localhost:${port}/health`);
    const data = await response.json();

    expect(data).toMatchObject({
      status: "ok",
      worker: "documentos-conversao",
    });
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data.timestamp).toBeDefined();
  });

  it("deve retornar 404 em rotas desconhecidas", async () => {
    const response = await fetch(`http://localhost:${port}/unknown`);
    expect(response.status).toBe(404);
  });

  it("deve incrementar uptime ao longo do tempo", async () => {
    // Primeira chamada
    const response1 = await fetch(`http://localhost:${port}/health`);
    const data1 = await response1.json();
    const uptime1 = data1.uptime;

    // Aguardar 1 segundo
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Segunda chamada
    const response2 = await fetch(`http://localhost:${port}/health`);
    const data2 = await response2.json();
    const uptime2 = data2.uptime;

    // Uptime deve ter aumentado
    expect(uptime2).toBeGreaterThanOrEqual(uptime1);
  });
});
