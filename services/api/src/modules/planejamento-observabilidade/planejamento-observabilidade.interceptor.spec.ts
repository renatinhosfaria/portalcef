import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";

import { PlanejamentoObservabilidadeInterceptor } from "./planejamento-observabilidade.interceptor";

describe("PlanejamentoObservabilidadeInterceptor", () => {
  const usuarioSessao = {
    userId: "user-1",
    role: "professora",
    schoolId: "school-1",
    unitId: "unit-1",
  };

  function criarInterceptor() {
    const service = {
      registrarEvento: jest.fn().mockResolvedValue(undefined),
      obterSlowMs: jest.fn().mockReturnValue(2000),
    };

    const interceptor = new PlanejamentoObservabilidadeInterceptor(
      service as never,
    );

    return { interceptor, service };
  }

  function criarContexto({
    method = "GET",
    url,
    statusCode = 200,
    correlationId,
    user = usuarioSessao,
  }: {
    method?: string;
    url: string;
    statusCode?: number;
    correlationId?: string;
    user?: typeof usuarioSessao;
  }): ExecutionContext {
    const request = { method, url, correlationId, user };
    const response = { statusCode };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
  }

  function sucesso(valor: unknown = { ok: true }): CallHandler {
    return {
      handle: () => of(valor),
    };
  }

  function falha(erro: Error): CallHandler {
    return {
      handle: () => throwError(() => erro),
    };
  }

  function mockTempo(...valores: number[]) {
    return jest
      .spyOn(Date, "now")
      .mockImplementation(() => valores.shift() ?? 0);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("registra api_chamada para rotas de plano de aula com contexto tecnico", async () => {
    mockTempo(1000, 1123);
    const { interceptor, service } = criarInterceptor();

    await expect(
      lastValueFrom(
        interceptor.intercept(
          criarContexto({
            url: "/api/plano-aula/11111111-1111-1111-1111-111111111111?token=segredo#aba",
            correlationId: "correlation-1",
          }),
          sucesso(),
        ),
      ),
    ).resolves.toEqual({ ok: true });

    expect(service.registrarEvento).toHaveBeenCalledTimes(1);
    expect(service.registrarEvento).toHaveBeenCalledWith({
      origem: "api",
      evento: "api_chamada",
      nivel: "info",
      correlationId: "correlation-1",
      usuario: {
        id: "user-1",
        role: "professora",
        schoolId: "school-1",
        unitId: "unit-1",
      },
      http: {
        metodo: "GET",
        rota: "/api/plano-aula/:id",
        status: 200,
        duracaoMs: 123,
      },
    });
    expect(JSON.stringify(service.registrarEvento.mock.calls[0][0])).not.toContain(
      "segredo",
    );
  });

  it("registra api_lenta quando a duracao atinge o limite configurado", async () => {
    mockTempo(5000, 7000);
    const { interceptor, service } = criarInterceptor();

    await lastValueFrom(
      interceptor.intercept(
        criarContexto({
          method: "POST",
          url: "/api/prova-ciclo",
          statusCode: 201,
          correlationId: "correlation-lenta",
        }),
        sucesso({ id: "prova-ciclo-1" }),
      ),
    );

    expect(service.registrarEvento).toHaveBeenCalledTimes(2);
    expect(service.registrarEvento).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        origem: "api",
        evento: "api_chamada",
        nivel: "info",
        http: {
          metodo: "POST",
          rota: "/api/prova-ciclo",
          status: 201,
          duracaoMs: 2000,
        },
      }),
    );
    expect(service.registrarEvento).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        origem: "api",
        evento: "api_lenta",
        nivel: "warn",
        correlationId: "correlation-lenta",
        http: {
          metodo: "POST",
          rota: "/api/prova-ciclo",
          status: 201,
          duracaoMs: 2000,
        },
      }),
    );
  });

  it("usa limite slowMs configurado pelo service para detectar chamada lenta", async () => {
    mockTempo(1000, 2500);
    const { interceptor, service } = criarInterceptor();
    service.obterSlowMs.mockReturnValue(1500);

    await lastValueFrom(
      interceptor.intercept(
        criarContexto({
          method: "GET",
          url: "/api/plannings",
          correlationId: "correlation-slow-config",
        }),
        sucesso(),
      ),
    );

    expect(service.registrarEvento).toHaveBeenCalledTimes(2);
    expect(service.registrarEvento).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        evento: "api_lenta",
        nivel: "warn",
        http: {
          metodo: "GET",
          rota: "/api/plannings",
          status: 200,
          duracaoMs: 1500,
        },
      }),
    );
  });

  it("nao registra eventos da propria rota de observabilidade", async () => {
    mockTempo(1000, 4000);
    const { interceptor, service } = criarInterceptor();

    await lastValueFrom(
      interceptor.intercept(
        criarContexto({
          method: "POST",
          url: "/api/planejamento-observabilidade/eventos",
          statusCode: 202,
          correlationId: "correlation-ignorada",
        }),
        sucesso(),
      ),
    );

    expect(service.registrarEvento).not.toHaveBeenCalled();
  });

  it("registra api_lenta junto com api_chamada quando erro demora alem do limite", async () => {
    mockTempo(1000, 3001);
    const { interceptor, service } = criarInterceptor();
    const erro = new Error("Falha lenta") as Error & {
      status: number;
      code: string;
    };
    erro.status = 500;
    erro.code = "ERRO_LENTO";

    await expect(
      lastValueFrom(
        interceptor.intercept(
          criarContexto({
            method: "POST",
            url: "/api/plano-aula-periodo",
            correlationId: "correlation-erro-lento",
          }),
          falha(erro),
        ),
      ),
    ).rejects.toBe(erro);

    expect(service.registrarEvento).toHaveBeenCalledTimes(2);
    expect(service.registrarEvento).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        evento: "api_chamada",
        nivel: "error",
        http: {
          metodo: "POST",
          rota: "/api/plano-aula-periodo",
          status: 500,
          duracaoMs: 2001,
        },
        erro: {
          codigo: "ERRO_LENTO",
          mensagem: "Falha lenta",
        },
      }),
    );
    expect(service.registrarEvento).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        evento: "api_lenta",
        nivel: "warn",
        http: {
          metodo: "POST",
          rota: "/api/plano-aula-periodo",
          status: 500,
          duracaoMs: 2001,
        },
      }),
    );
  });

  it("registra erro 500 com nivel error e mensagem sanitizada", async () => {
    mockTempo(2000, 2042);
    const { interceptor, service } = criarInterceptor();
    const erro = new Error(
      "Falha ao processar token=segredo password=123 email=maria@example.com",
    ) as Error & { status: number; code: string };
    erro.status = 500;
    erro.code = "ERRO_INTERNO";

    await expect(
      lastValueFrom(
        interceptor.intercept(
          criarContexto({
            method: "PATCH",
            url: "/api/plano-aula/22222222-2222-2222-2222-222222222222",
            statusCode: 200,
            correlationId: "correlation-erro",
          }),
          falha(erro),
        ),
      ),
    ).rejects.toBe(erro);

    expect(service.registrarEvento).toHaveBeenCalledTimes(1);
    expect(service.registrarEvento).toHaveBeenCalledWith({
      origem: "api",
      evento: "api_chamada",
      nivel: "error",
      correlationId: "correlation-erro",
      usuario: {
        id: "user-1",
        role: "professora",
        schoolId: "school-1",
        unitId: "unit-1",
      },
      http: {
        metodo: "PATCH",
        rota: "/api/plano-aula/:id",
        status: 500,
        duracaoMs: 42,
      },
      erro: {
        codigo: "ERRO_INTERNO",
        mensagem: "Falha ao processar token=*** password=*** email=***",
      },
    });
    expect(JSON.stringify(service.registrarEvento.mock.calls[0][0])).not.toContain(
      "segredo",
    );
    expect(JSON.stringify(service.registrarEvento.mock.calls[0][0])).not.toContain(
      "maria@example.com",
    );
  });

  it("sanitiza segredos em JSON e Authorization Bearer na mensagem de erro", async () => {
    mockTempo(2000, 2042);
    const { interceptor, service } = criarInterceptor();
    const erro = new Error(
      'Falha {"password":"abc","token":"def"} Authorization: Bearer segredo.jwt',
    ) as Error & { status: number; code: string };
    erro.status = 500;
    erro.code = "ERRO_SEGREDO";

    await expect(
      lastValueFrom(
        interceptor.intercept(
          criarContexto({
            method: "GET",
            url: "/api/prova",
            correlationId: "correlation-segredo",
          }),
          falha(erro),
        ),
      ),
    ).rejects.toBe(erro);

    expect(service.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        erro: {
          codigo: "ERRO_SEGREDO",
          mensagem:
            'Falha {"password":"***","token":"***"} Authorization: Bearer ***',
        },
      }),
    );
    const evento = JSON.stringify(service.registrarEvento.mock.calls[0][0]);
    expect(evento).not.toContain("abc");
    expect(evento).not.toContain("def");
    expect(evento).not.toContain("segredo.jwt");
  });
});
