import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";

import { ApiExceptionFilter } from "./api-exception.filter";

const criarHost = () => {
  const response = {
    send: jest.fn(),
    statusCode: 0,
  };
  const request = {
    url: "/api/documentos",
    method: "GET",
  };

  return {
    response,
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    },
  };
};

describe("ApiExceptionFilter", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("não expõe detalhes de erro interno ao cliente", () => {
    const filter = new ApiExceptionFilter();
    const { host, response } = criarHost();

    filter.catch(new Error("detalhe interno fictício"), host as never);

    expect(response.statusCode).toBe(500);
    expect(response.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno do servidor",
      },
    });
    expect(response.send.mock.calls[0]?.[0]).not.toEqual(
      expect.objectContaining({ message: expect.stringContaining("fictício") }),
    );
  });

  it("preserva mensagem de exceção HTTP controlada", () => {
    const filter = new ApiExceptionFilter();
    const { host, response } = criarHost();

    filter.catch(new BadRequestException("Campo inválido"), host as never);

    expect(response.statusCode).toBe(400);
    expect(response.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Campo inválido",
      },
    });
  });

  it("remove detalhes também de exceção HTTP 500", () => {
    const filter = new ApiExceptionFilter();
    const { host, response } = criarHost();

    filter.catch(
      new InternalServerErrorException({
        code: "DB_ERROR",
        message: "SQL secreto",
        details: { query: "select * from users" },
      }),
      host as never,
    );

    expect(response.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno do servidor",
      },
    });
  });
});
