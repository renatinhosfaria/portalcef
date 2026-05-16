import {
  atualizarPresencaSchema,
  criarInscricaoSchema,
  criarSorteioSchema,
  listarInscricoesSchema,
} from "./evento-inscricoes.dto";

const baseValido = {
  nome: "Maria Convidada Silva",
  cpf: "123.456.789-00",
  dataNascimento: "1990-01-15",
  email: "maria@exemplo.com",
  telefone: "(34) 99999-9999",
};

describe("criarInscricaoSchema", () => {
  it("aceita filhos: [] para convidadas externas", () => {
    const result = criarInscricaoSchema.safeParse({ ...baseValido, filhos: [] });
    expect(result.success).toBe(true);
  });

  it("continua exigindo filhos válidos quando informados", () => {
    const result = criarInscricaoSchema.safeParse({
      ...baseValido,
      filhos: [{ nome: "João", turma: "Berçário" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita filho com turma inválida", () => {
    const result = criarInscricaoSchema.safeParse({
      ...baseValido,
      filhos: [{ nome: "João", turma: "Turma Inexistente" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("listarInscricoesSchema", () => {
  it("aceita somentePresentes=true como verdadeiro", () => {
    const result = listarInscricoesSchema.parse({ somentePresentes: "true" });

    expect(result.somentePresentes).toBe(true);
  });

  it("mantém somentePresentes=false como falso", () => {
    const result = listarInscricoesSchema.parse({ somentePresentes: "false" });

    expect(result.somentePresentes).toBe(false);
  });
});

describe("atualizarPresencaSchema", () => {
  it("exige campo presente booleano", () => {
    expect(atualizarPresencaSchema.parse({ presente: true })).toEqual({
      presente: true,
    });

    expect(() => atualizarPresencaSchema.parse({ presente: "sim" })).toThrow();
  });
});

describe("criarSorteioSchema", () => {
  it("normaliza brinde e rejeita texto vazio", () => {
    expect(criarSorteioSchema.parse({ brinde: "  Cesta de café  " })).toEqual({
      brinde: "Cesta de café",
    });

    expect(() => criarSorteioSchema.parse({ brinde: "   " })).toThrow();
  });
});
