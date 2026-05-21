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
});
