import { BadRequestException } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/guards/auth.guard";

import { PlanejamentoObservabilidadeController } from "./planejamento-observabilidade.controller";

describe("PlanejamentoObservabilidadeController", () => {
  const usuarioSessao: AuthenticatedRequest["user"] = {
    userId: "user-real",
    role: "professora",
    schoolId: "school-1",
    unitId: "unit-1",
    stageId: "stage-1",
  };

  function criarController() {
    const service = {
      registrarEvento: jest.fn().mockResolvedValue(undefined),
    };

    const controller = new PlanejamentoObservabilidadeController(
      service as never,
    );

    return { controller, service };
  }

  function reqComUsuario(
    user: AuthenticatedRequest["user"] = usuarioSessao,
  ): AuthenticatedRequest {
    return { user } as AuthenticatedRequest;
  }

  function eventoValido(overrides: Record<string, unknown> = {}) {
    return {
      origem: "browser",
      evento: "pagina_aberta",
      ...overrides,
    };
  }

  async function esperarBadRequest(body: unknown) {
    const { controller, service } = criarController();

    await expect(
      controller.registrarEventos(reqComUsuario(), body),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.registrarEvento).not.toHaveBeenCalled();
  }

  it("registra lote com um evento usando o usuario da sessao", async () => {
    const { controller, service } = criarController();

    const resultado = await controller.registrarEventos(reqComUsuario(), {
      eventos: [
        {
          origem: "browser",
          evento: "pagina_aberta",
          usuario: {
            id: "falso",
            nome: "Invasor",
            role: "master",
            schoolId: "school-falsa",
            unitId: "unit-falsa",
          },
          pagina: {
            url: "/planejamento",
            titulo: "Inicio",
          },
        },
      ],
    });

    expect(resultado).toEqual({ success: true });
    expect(service.registrarEvento).toHaveBeenCalledTimes(1);
    expect(service.registrarEvento).toHaveBeenCalledWith({
      origem: "browser",
      evento: "pagina_aberta",
      nivel: "info",
      pagina: {
        url: "/planejamento",
        titulo: "Inicio",
      },
      usuario: {
        id: "user-real",
        role: "professora",
        schoolId: "school-1",
        unitId: "unit-1",
      },
    });
  });

  it("define niveis padrao para eventos tecnicos quando o navegador nao informa", async () => {
    const { controller, service } = criarController();

    await controller.registrarEventos(reqComUsuario(), {
      eventos: [
        {
          origem: "browser",
          evento: "api_lenta",
          http: {
            metodo: "GET",
            rota: "/api/plano-aula",
            duracaoMs: 3200,
          },
        },
        {
          origem: "browser",
          evento: "erro_navegador",
          erro: {
            mensagem: "Falha no navegador",
          },
        },
      ],
    });

    expect(service.registrarEvento).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        evento: "api_lenta",
        nivel: "warn",
      }),
    );
    expect(service.registrarEvento).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        evento: "erro_navegador",
        nivel: "error",
      }),
    );
  });

  it("aceita detalhes tecnicos simples do navegador", async () => {
    const { controller, service } = criarController();

    const resultado = await controller.registrarEventos(reqComUsuario(), {
      eventos: [
        eventoValido({
          detalhes: {
            navegador: "Chrome",
            sistema: "Windows",
            duracaoTotalMs: 123,
            tentativa: 1,
            lento: true,
          },
        }),
      ],
    });

    expect(resultado).toEqual({ success: true });
    expect(service.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        detalhes: {
          navegador: "Chrome",
          sistema: "Windows",
          duracaoTotalMs: 123,
          tentativa: 1,
          lento: true,
        },
      }),
    );
  });

  it("aceita identificador de relatório em eventos de arquivo do navegador", async () => {
    const { controller, service } = criarController();

    await controller.registrarEventos(reqComUsuario(), {
      eventos: [
        eventoValido({
          evento: "arquivo_acao",
          arquivo: {
            relatorioId: "relatorio-1",
            documentoId: "documento-1",
            nome: "Relatorio.docx",
            tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            tamanhoBytes: 1024,
          },
          detalhes: {
            modulo: "planejamento",
            acao: "download",
            status: "sucesso",
          },
        }),
      ],
    });

    expect(service.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "arquivo_acao",
        arquivo: {
          relatorioId: "relatorio-1",
          documentoId: "documento-1",
          nome: "Relatorio.docx",
          tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          tamanhoBytes: 1024,
        },
      }),
    );
  });

  it("rejeita detalhes com string acima do limite", async () => {
    await esperarBadRequest({
      eventos: [
        eventoValido({
          detalhes: {
            navegador: "C".repeat(501),
          },
        }),
      ],
    });
  });

  it.each([
    "token",
    "cookie",
    "authorization",
    "payload",
    "body",
    "html",
    "conteudo",
    "senha",
    "password",
    "headers",
  ])("rejeita detalhes com chave sensivel %s", async (chave) => {
    await esperarBadRequest({
      eventos: [
        eventoValido({
          detalhes: {
            navegador: "Chrome",
            contexto: {
              [chave]: "segredo",
            },
          },
        }),
      ],
    });
  });

  it.each([
    "accessToken",
    "authorizationHeader",
    "email",
    "resposta",
    "conteudoDigitado",
    "requestBody",
  ])("rejeita detalhes com chave fora da allowlist %s", async (chave) => {
    await esperarBadRequest({
      eventos: [
        eventoValido({
          detalhes: {
            navegador: "Chrome",
            [chave]: "valor informado pelo navegador",
          },
        }),
      ],
    });
  });

  it("rejeita detalhes com objeto muito profundo", async () => {
    await esperarBadRequest({
      eventos: [
        eventoValido({
          detalhes: {
            nivel1: {
              nivel2: {
                nivel3: {
                  nivel4: "profundo",
                },
              },
            },
          },
        }),
      ],
    });
  });

  it("rejeita detalhes com muitas chaves", async () => {
    await esperarBadRequest({
      eventos: [
        eventoValido({
          detalhes: Object.fromEntries(
            Array.from({ length: 21 }, (_, indice) => [
              `campo${indice}`,
              indice,
            ]),
          ),
        }),
      ],
    });
  });

  it("rejeita detalhes com array muito grande", async () => {
    await esperarBadRequest({
      eventos: [
        eventoValido({
          detalhes: {
            resultado: Array.from({ length: 21 }, (_, indice) => indice),
          },
        }),
      ],
    });
  });

  it("mantem a rota best effort quando o registro de evento falha", async () => {
    const { controller, service } = criarController();
    service.registrarEvento.mockRejectedValue(new Error("falha"));

    const resultado = await controller.registrarEventos(reqComUsuario(), {
      eventos: [eventoValido()],
    });

    expect(resultado).toEqual({ success: true });
    expect(service.registrarEvento).toHaveBeenCalledTimes(1);
  });

  it("rejeita evento que nao veio do navegador", async () => {
    await esperarBadRequest({
      eventos: [eventoValido({ origem: "servidor" })],
    });
  });

  it("rejeita lote vazio", async () => {
    await esperarBadRequest({
      eventos: [],
    });
  });

  it("rejeita lote com mais de 25 eventos", async () => {
    await esperarBadRequest({
      eventos: Array.from({ length: 26 }, () => eventoValido()),
    });
  });

  it("rejeita strings acima do limite nos campos centrais", async () => {
    await esperarBadRequest({
      eventos: [
        eventoValido({
          pagina: {
            url: `/${"a".repeat(2001)}`,
          },
        }),
      ],
    });
  });
});
