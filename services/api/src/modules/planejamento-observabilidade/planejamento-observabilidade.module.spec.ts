import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";

jest.mock("../auth/auth.module", () => ({
  AuthModule: class AuthModule {},
}));

import { PlanejamentoObservabilidadeProvidersModule } from "./planejamento-observabilidade.module";
import { PlanejamentoObservabilidadeService } from "./planejamento-observabilidade.service";

describe("PlanejamentoObservabilidadeProvidersModule", () => {
  const envOriginal = process.env.PLANEJAMENTO_OBSERVABILIDADE_DIR;
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "planejamento-observabilidade-env-"));
  });

  afterEach(async () => {
    if (envOriginal === undefined) {
      delete process.env.PLANEJAMENTO_OBSERVABILIDADE_DIR;
    } else {
      process.env.PLANEJAMENTO_OBSERVABILIDADE_DIR = envOriginal;
    }

    await rm(dir, { recursive: true, force: true });
  });

  it("configura o diretorio de observabilidade pela variavel de ambiente", async () => {
    process.env.PLANEJAMENTO_OBSERVABILIDADE_DIR = dir;

    const moduleRef = await Test.createTestingModule({
      imports: [PlanejamentoObservabilidadeProvidersModule],
    }).compile();

    const service = moduleRef.get(PlanejamentoObservabilidadeService);

    await service.registrarEvento({
      origem: "api",
      evento: "api_chamada",
      nivel: "info",
    });

    const hoje = new Date().toISOString().slice(0, 10);
    const conteudo = await readFile(
      join(dir, `planejamento-${hoje}.jsonl`),
      "utf8",
    );

    expect(conteudo).toContain('"evento":"api_chamada"');

    await moduleRef.close();
  });
});
