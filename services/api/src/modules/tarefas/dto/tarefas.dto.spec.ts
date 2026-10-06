import { criarTarefaSchema, listarTarefasSchema } from "./tarefas.dto";

describe("DTOs de tarefas", () => {
  it("aceita criação manual sem tipoOrigem e com contextos em lista", () => {
    const resultado = criarTarefaSchema.safeParse({
      titulo: "Revisar planejamento",
      descricao: "Conferir os itens pendentes",
      prioridade: "MEDIA",
      prazo: "2026-12-31T23:59:59Z",
      responsavel: "11111111-1111-4111-8111-111111111111",
      contextos: [
        {
          modulo: "PLANEJAMENTO",
          quinzenaId: "11111111-1111-4111-8111-111111111112",
        },
      ],
    });

    expect(resultado.success).toBe(true);
  });

  it("preserva o filtro tipo na listagem", () => {
    const resultado = listarTarefasSchema.safeParse({ tipo: "atribuidas" });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect((resultado.data as { tipo?: string }).tipo).toBe("atribuidas");
    }
  });

  it("exige data ISO no prazo recebido pela API", () => {
    const resultado = criarTarefaSchema.safeParse({
      titulo: "Tarefa com prazo local",
      prioridade: "MEDIA",
      prazo: "2026-12-31T23:59",
      responsavel: "11111111-1111-4111-8111-111111111111",
    });

    expect(resultado.success).toBe(false);
  });

  it("aceita filtros de prazo com offset de fuso horário", () => {
    const resultado = listarTarefasSchema.safeParse({
      prazoInicio: "2026-12-01T00:00:00-03:00",
      prazoFim: "2026-12-31T23:59:59-03:00",
    });

    expect(resultado.success).toBe(true);
  });
});
