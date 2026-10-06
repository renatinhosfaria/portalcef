import { describe, expect, it } from "vitest";

import { LIMITE_TOTAL_ANEXOS_SUPORTE } from "@essencia/shared/types";
import { adicionarArquivosComLimite } from "../../../lib/anexos";

describe("limite de anexos da nova OS", () => {
  it("aceita somente as vagas restantes e informa os arquivos ignorados", () => {
    const arquivo = (nome: string) => ({ name: nome }) as File;
    const atuais = [
      arquivo("um.png"),
      arquivo("dois.png"),
      arquivo("tres.png"),
      arquivo("quatro.png"),
    ];
    const novos = [arquivo("cinco.png"), arquivo("seis.png")];

    const resultado = adicionarArquivosComLimite(atuais, novos);

    expect(resultado.arquivos).toHaveLength(1);
    expect(resultado.arquivos[0]?.name).toBe("cinco.png");
    expect(resultado.quantidadeIgnorada).toBe(1);
    expect(atuais.length + resultado.arquivos.length).toBe(
      LIMITE_TOTAL_ANEXOS_SUPORTE,
    );
  });
});
