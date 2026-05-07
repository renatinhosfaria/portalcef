import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";

function createContext(handler: () => void, userRole: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          userId: "user-1",
          role: userRole,
          schoolId: "school-1",
          unitId: "unit-1",
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("mantém hierarquia quando a rota não exige correspondência exata", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, ["professora"], handler);

    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(createContext(handler, "coordenadora_geral")),
    ).toBe(true);
  });

  it("bloqueia papel fora da lista quando a rota exige correspondência exata", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      ROLES_KEY,
      [
        "master",
        "diretora_geral",
        "gerente_unidade",
        "gerente_financeiro",
        "auxiliar_administrativo",
      ],
      handler,
    );
    Reflect.defineMetadata("roles:exact", true, handler);

    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext(handler, "professora")),
    ).toThrow(ForbiddenException);
  });

  it("permite papel listado quando a rota exige correspondência exata", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      ROLES_KEY,
      ["master", "diretora_geral", "gerente_unidade"],
      handler,
    );
    Reflect.defineMetadata("roles:exact", true, handler);

    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(createContext(handler, "gerente_unidade"))).toBe(
      true,
    );
  });
});
