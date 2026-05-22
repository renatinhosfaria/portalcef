jest.mock("./relatorio.service", () => ({ RelatorioService: jest.fn() }));
jest.mock("./relatorio-historico.service", () => ({
  RelatorioHistoricoService: jest.fn(),
}));
jest.mock("../../common/guards/auth.guard", () => ({ AuthGuard: jest.fn() }));
jest.mock("../../common/guards/roles.guard", () => ({ RolesGuard: jest.fn() }));
jest.mock("../../common/guards/tenant.guard", () => ({ TenantGuard: jest.fn() }));
jest.mock("../../common/sharepoint/sharepoint.service", () => ({
  SharePointService: jest.fn(),
}));
jest.mock("../../common/storage/storage.service", () => ({
  StorageService: jest.fn(),
}));

import { GUARDS_METADATA } from "@nestjs/common/constants";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RelatorioController } from "./relatorio.controller";

describe("RelatorioController", () => {
  it("é definido", () => {
    expect(RelatorioController).toBeDefined();
  });

  it("usa guards na ordem obrigatória", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, RelatorioController);

    expect(guards).toEqual([AuthGuard, RolesGuard, TenantGuard]);
  });
});
