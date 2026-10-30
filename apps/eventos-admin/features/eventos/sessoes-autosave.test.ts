import { describe, expect, it, vi } from "vitest";
import {
  criarCompensacaoSessao,
  criarPersistenciaSessao,
  mesclarRespostaSessao,
} from "./sessoes-autosave";
import type { SessaoValue } from "./etapas-contratos";

function sessao(partial: Partial<SessaoValue> = {}): SessaoValue {
  return {
    clientId: "cliente-1",
    startsAt: "2026-11-01T10:00",
    endsAt: "2026-11-01T11:00",
    capacity: 10,
    salesStartsAt: "2026-10-01T10:00",
    salesEndsAt: "2026-10-31T10:00",
    inheritLocation: true,
    inheritMap: true,
    locationId: null,
    mapId: null,
    ...partial,
  };
}

describe("persistência concorrente de sessões", () => {
  it("reutiliza o POST em voo quando uma edição posterior chega antes da resposta", async () => {
    let liberar!: (value: { id: string }) => void;
    const chamadas: SessaoValue[] = [];
    const persistir = criarPersistenciaSessao(async (item) => {
      chamadas.push(item);
      return new Promise((resolve) => { liberar = resolve; });
    });
    const primeiro = persistir.enviar(sessao(), "evento-1");
    const segundo = persistir.enviar(sessao(), "evento-1");

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].id).toBeUndefined();
    liberar({ id: "sessao-criada" });

    await expect(Promise.all([primeiro, segundo])).resolves.toEqual([{ id: "sessao-criada" }, { id: "sessao-criada" }]);
    expect(chamadas).toHaveLength(1);
  });

  it("envia a edição posterior como PATCH depois de concluir o POST deduplicado", async () => {
    let liberar!: (value: { id: string }) => void;
    const chamadas: Array<{ id?: string; startsAt: string }> = [];
    const persistir = criarPersistenciaSessao(async (item) => {
      chamadas.push({ id: item.id, startsAt: item.startsAt });
      if (!item.id) return new Promise<{ id: string }>((resolve) => { liberar = resolve; });
      return { id: item.id };
    });
    const primeiro = persistir.enviar(sessao(), "evento-1");
    const segundo = persistir.enviar(sessao({ startsAt: "2026-11-01T12:00" }), "evento-1");

    liberar({ id: "sessao-criada" });

    await expect(primeiro).resolves.toEqual({ id: "sessao-criada" });
    await expect(segundo).resolves.toEqual({ id: "sessao-criada" });
    expect(chamadas).toEqual([
      { id: undefined, startsAt: "2026-11-01T10:00" },
      { id: "sessao-criada", startsAt: "2026-11-01T12:00" },
    ]);
  });

  it("mescla o ID de resposta stale no rascunho sobrevivente sem perder sua edição", () => {
    const enviada = sessao();
    const atual = sessao({ startsAt: "2026-11-01T12:00" });
    const result = mesclarRespostaSessao({
      atuais: [atual],
      salvas: [],
      enviada,
      resposta: { id: "sessao-criada" },
      geracaoDaOperacao: 1,
      geracaoAtual: 2,
    });

    expect(result.stale).toBe(true);
    expect(result.deveCompensar).toBe(false);
    expect(result.atuais).toEqual([{ ...atual, id: "sessao-criada" }]);
    expect(result.salvas).toEqual([{ ...enviada, id: "sessao-criada" }]);
  });

  it("sinaliza compensação apenas quando o POST stale foi realmente removido", () => {
    const enviada = sessao();
    const result = mesclarRespostaSessao({
      atuais: [],
      salvas: [],
      enviada,
      resposta: { id: "sessao-criada" },
      geracaoDaOperacao: 1,
      geracaoAtual: 2,
    });

    expect(result.deveCompensar).toBe(true);
    expect(result.atuais).toEqual([]);
    expect(result.salvas).toEqual([]);
  });

  it("deduplica a exclusão compensatória em respostas stale fora de ordem", async () => {
    let liberar!: () => void;
    const excluir = vi.fn(() => new Promise<void>((resolve) => { liberar = resolve; }));
    const compensacao = criarCompensacaoSessao(excluir);
    const primeiro = compensacao.executar("evento-1", "sessao-criada");
    const segundo = compensacao.executar("evento-1", "sessao-criada");

    expect(excluir).toHaveBeenCalledTimes(1);
    liberar();
    await Promise.all([primeiro, segundo]);
    await compensacao.executar("evento-1", "sessao-criada");
    expect(excluir).toHaveBeenCalledTimes(1);
  });
});
