import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
const comandoServidor = process.env.EVENTOS_E2E_PRODUCAO === "1" ? "start" : "dev";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "../../e2e-results/eventos",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3024", screenshot: "only-on-failure" },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    { command: "node apps/eventos/e2e/api-simulada.cjs", cwd: raiz, url: "http://127.0.0.1:4032/health", reuseExistingServer: false },
    {
      command: `pnpm --filter @essencia/eventos exec next ${comandoServidor} --hostname 127.0.0.1 --port 3024`,
      cwd: raiz,
      url: "http://127.0.0.1:3024",
      env: { API_INTERNAL_URL: "http://127.0.0.1:4032" },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
