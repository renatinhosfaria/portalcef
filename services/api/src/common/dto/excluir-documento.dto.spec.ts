import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ExcluirDocumentoDto } from "./excluir-documento.dto";

describe("ExcluirDocumentoDto", () => {
  it.each([
    ["motivo ausente", undefined],
    ["motivo vazio", ""],
    ["motivo com apenas espaços", "          "],
    ["motivo menor que 10 caracteres após o trim", " 123456789 "],
  ])("rejeita %s", async (_descricao, motivo) => {
    const dto = plainToInstance(
      ExcluirDocumentoDto,
      motivo === undefined ? {} : { motivo },
    );

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it("aceita motivo válido e preserva o valor normalizado", async () => {
    const dto = plainToInstance(ExcluirDocumentoDto, {
      motivo: "  Arquivo substituído por versão corrigida  ",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.motivo).toBe("Arquivo substituído por versão corrigida");
  });
});
