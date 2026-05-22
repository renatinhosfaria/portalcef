import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  const retencaoOriginal =
    process.env.PLANEJAMENTO_OBSERVABILIDADE_RETENCAO_DIAS;
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
    if (retencaoOriginal === undefined) {
      delete process.env.PLANEJAMENTO_OBSERVABILIDADE_RETENCAO_DIAS;
    } else {
      process.env.PLANEJAMENTO_OBSERVABILIDADE_RETENCAO_DIAS =
        retencaoOriginal;
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

    const conteudo = await readFile(service.obterArquivoDoDia(), "utf8");

    expect(conteudo).toContain('"evento":"api_chamada"');

    await moduleRef.close();
  });

  it("limpa logs antigos ao iniciar o modulo usando a retencao configurada", async () => {
    process.env.PLANEJAMENTO_OBSERVABILIDADE_DIR = dir;
    process.env.PLANEJAMENTO_OBSERVABILIDADE_RETENCAO_DIAS = "1";
    const antigo = join(dir, `planejamento-${formatarDataRelativa(-2)}.jsonl`);
    const recente = join(dir, `planejamento-${formatarDataRelativa(-1)}.jsonl`);
    await writeFile(antigo, "{}\n", "utf8");
    await writeFile(recente, "{}\n", "utf8");

    const moduleRef = await Test.createTestingModule({
      imports: [PlanejamentoObservabilidadeProvidersModule],
    }).compile();
    await moduleRef.init();

    await expect(access(antigo)).rejects.toThrow();
    await expect(access(recente)).resolves.toBeUndefined();

    await moduleRef.close();
  });
});

function formatarDataRelativa(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);

  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}
