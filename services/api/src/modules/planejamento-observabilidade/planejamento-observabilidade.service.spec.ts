import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Test } from "@nestjs/testing";

import { PlanejamentoObservabilidadeService } from "./planejamento-observabilidade.service";

describe("PlanejamentoObservabilidadeService", () => {
  let dir: string;
  let service: PlanejamentoObservabilidadeService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "planejamento-observabilidade-"));
    service = new PlanejamentoObservabilidadeService({
      diretorio: dir,
      ambiente: "test",
      slowMs: 2000,
      retencaoDias: 30,
      agora: () => new Date("2026-05-21T12:00:00.000Z"),
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("pode ser registrado diretamente como provider do Nest", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PlanejamentoObservabilidadeService],
    }).compile();

    expect(moduleRef.get(PlanejamentoObservabilidadeService)).toBeInstanceOf(
      PlanejamentoObservabilidadeService,
    );
    await moduleRef.close();
  });

  it("remove dados sensiveis, trunca erros, normaliza rotas e preserva campos permitidos", () => {
    const evento = service.normalizarEvento({
      timestamp: "2026-05-21T12:00:00.000Z",
      origem: "browser",
      evento: "api_chamada",
      nivel: "info",
      correlationId: "correlation-1",
      sessaoObservabilidadeId: "sessao-1",
      requestId: "request-1",
      usuario: {
        id: "user-1",
        nome: "Maria Silva",
        role: "professora",
        schoolId: "school-1",
        unitId: "unit-1",
        email: "maria@example.com",
      },
      http: {
        metodo: "GET",
        rota: "/api/plano-aula/11111111-1111-1111-1111-111111111111/documentos/22222222-2222-2222-2222-222222222222/download",
        status: 200,
        duracaoMs: 120,
      },
      pagina: {
        url: "/planejamento/plano-aula/33333333-3333-3333-3333-333333333333",
        titulo: "Plano de Aula",
      },
      arquivo: {
        planoId: "plano-1",
        provaId: null,
        documentoId: "documento-1",
        nome: "Plano Bercario.docx",
        tipo: "docx",
        tamanhoBytes: 180234,
      },
      detalhes: {
        navegador: "Chrome",
        resultado: "sucesso",
        token: "segredo",
        aninhado: {
          cookie: "sid=abc",
          sistema: "Windows",
          lista: [{ authorization: "Bearer segredo", tentativa: 1 }],
        },
      },
      erro: {
        codigo: "ERRO_TESTE",
        mensagem: "x".repeat(2000),
        stackResumo: "y".repeat(5000),
        payload: "conteudo bruto",
      },
      headers: { cookie: "sid=abc" },
      body: { conteudo: "texto digitado" },
    });

    expect(evento.http).toEqual({
      metodo: "GET",
      rota: "/api/plano-aula/:id/documentos/:id/download",
      status: 200,
      duracaoMs: 120,
    });
    expect(evento.pagina).toEqual({
      url: "/planejamento/plano-aula/:id",
      titulo: "Plano de Aula",
    });
    expect(evento.usuario).toEqual({
      id: "user-1",
      nome: "Maria Silva",
      role: "professora",
      schoolId: "school-1",
      unitId: "unit-1",
    });
    expect(evento.arquivo).toEqual({
      planoId: "plano-1",
      provaId: null,
      documentoId: "documento-1",
      nome: "Plano Bercario.docx",
      tipo: "docx",
      tamanhoBytes: 180234,
    });
    expect(evento.detalhes).toEqual({
      navegador: "Chrome",
      resultado: "sucesso",
      aninhado: {
        sistema: "Windows",
        lista: [{ tentativa: 1 }],
      },
    });
    expect(evento.erro?.codigo).toBe("ERRO_TESTE");
    expect(evento.erro?.mensagem).toHaveLength(500);
    expect(evento.erro?.stackResumo).toHaveLength(1000);
    expect(JSON.stringify(evento)).not.toContain("segredo");
    expect(JSON.stringify(evento)).not.toContain("sid=abc");
    expect(JSON.stringify(evento)).not.toContain("texto digitado");
    expect(JSON.stringify(evento)).not.toContain("maria@example.com");
  });

  it("remove chaves sensiveis mesmo quando aparecem com prefixo ou sufixo", () => {
    const evento = service.normalizarEvento({
      origem: "browser",
      evento: "erro_navegador",
      detalhes: {
        tentativa: 1,
        accessToken: "segredo-token",
        authorizationHeader: "Bearer segredo",
        conteudoDigitado: "texto privado",
        htmlGerado: "<p>privado</p>",
        senhaTemporaria: "123",
        passwordHash: "hash-privado",
        aninhado: {
          requestHeaders: { cookie: "sid=abc" },
        },
      },
    });

    const serializado = JSON.stringify(evento);

    expect(evento.detalhes).toEqual({
      tentativa: 1,
      aninhado: {},
    });
    expect(serializado).not.toContain("segredo-token");
    expect(serializado).not.toContain("Bearer segredo");
    expect(serializado).not.toContain("texto privado");
    expect(serializado).not.toContain("<p>privado</p>");
    expect(serializado).not.toContain("hash-privado");
    expect(serializado).not.toContain("sid=abc");
  });

  it("remove query string e hash antes de registrar URL de pagina", () => {
    const evento = service.normalizarEvento({
      origem: "browser",
      evento: "pagina_aberta",
      pagina: {
        url: "/planejamento/plano-aula/11111111-1111-1111-1111-111111111111?token=segredo&conteudo=x#ancora",
      },
    });

    expect(evento.pagina?.url).toBe("/planejamento/plano-aula/:id");
    expect(JSON.stringify(evento)).not.toContain("segredo");
    expect(JSON.stringify(evento)).not.toContain("conteudo");
    expect(JSON.stringify(evento)).not.toContain("ancora");
  });

  it("registra evento em arquivo diario com uma linha JSON valida", async () => {
    await service.registrarEvento({
      origem: "api",
      evento: "api_chamada",
      nivel: "info",
      http: {
        metodo: "GET",
        rota: "/api/plano-aula/11111111-1111-1111-1111-111111111111",
        status: 200,
        duracaoMs: 80,
      },
      detalhes: { resultado: "sucesso" },
    });

    const conteudo = await readFile(
      join(dir, "planejamento-2026-05-21.jsonl"),
      "utf8",
    );
    const linhas = conteudo.trim().split("\n");
    const linha = JSON.parse(linhas[0]);

    expect(linhas).toHaveLength(1);
    expect(linha).toMatchObject({
      timestamp: "2026-05-21T12:00:00.000Z",
      ambiente: "test",
      app: "planejamento",
      origem: "api",
      evento: "api_chamada",
      nivel: "info",
      http: {
        metodo: "GET",
        rota: "/api/plano-aula/:id",
        status: 200,
        duracaoMs: 80,
      },
      detalhes: { resultado: "sucesso" },
    });
  });

  it("nao rejeita a promise quando a escrita falha", async () => {
    const caminhoArquivo = join(dir, "bloqueio");
    await writeFile(caminhoArquivo, "nao e diretorio", "utf8");

    const serviceComFalha = new PlanejamentoObservabilidadeService({
      diretorio: caminhoArquivo,
      ambiente: "test",
      retencaoDias: 30,
      agora: () => new Date("2026-05-21T12:00:00.000Z"),
    });

    await expect(
      serviceComFalha.registrarEvento({
        origem: "api",
        evento: "api_chamada",
        nivel: "info",
      }),
    ).resolves.toBeUndefined();
  });

  it("normaliza timestamp invalido ou futuro para o horario do servidor ao gravar", async () => {
    await service.registrarEvento({
      timestamp: "invalido",
      origem: "api",
      evento: "api_chamada",
      nivel: "info",
    });
    await service.registrarEvento({
      timestamp: "2026-05-22T12:00:00.000Z",
      origem: "api",
      evento: "api_chamada",
      nivel: "info",
    });

    const conteudo = await readFile(
      join(dir, "planejamento-2026-05-21.jsonl"),
      "utf8",
    );
    const linhas = conteudo
      .trim()
      .split("\n")
      .map((linha) => JSON.parse(linha));

    expect(linhas).toHaveLength(2);
    expect(linhas).toEqual([
      expect.objectContaining({ timestamp: "2026-05-21T12:00:00.000Z" }),
      expect.objectContaining({ timestamp: "2026-05-21T12:00:00.000Z" }),
    ]);
    await expect(
      access(join(dir, "planejamento-2026-05-22.jsonl")),
    ).rejects.toThrow();
  });

  it("remove arquivos com mais de 30 dias e preserva arquivos recentes", async () => {
    const antigo = join(dir, "planejamento-2026-04-20.jsonl");
    const recente = join(dir, "planejamento-2026-04-22.jsonl");
    const outroArquivo = join(dir, "outro.log");
    await writeFile(antigo, "{}\n", "utf8");
    await writeFile(recente, "{}\n", "utf8");
    await writeFile(outroArquivo, "{}\n", "utf8");

    await service.limparAntigos();

    await expect(access(antigo)).rejects.toThrow();
    await expect(access(recente)).resolves.toBeUndefined();
    await expect(access(outroArquivo)).resolves.toBeUndefined();
  });
});
