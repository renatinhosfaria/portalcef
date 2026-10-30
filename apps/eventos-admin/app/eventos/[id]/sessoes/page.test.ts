import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { carregarDadosWorkspace } from "../../../../features/eventos/workspace-sessions-integration";
import { sessaoProntaParaSalvar } from "../../../../features/eventos/session-card-contracts";
import { sessionValueToDraft } from "../../../../features/eventos/session-editor";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

const localPrincipal = {
  id: "local-principal",
  name: "Auditório Principal",
  address: "Rua das Flores, 10",
  room: "Sala 1",
  instructions: null,
  accessibility: null,
  isDefault: false,
};

const localExcecao = {
  id: "local-excecao",
  name: "Quadra Coberta",
  address: "Rua das Flores, 12",
  room: null,
  instructions: null,
  accessibility: null,
  isDefault: false,
};

const sessaoComExcecao = {
  id: "sessao-1",
  startsAt: "2026-11-01T10:00:00.000Z",
  endsAt: "2026-11-01T12:00:00.000Z",
  capacity: 30,
  salesStartsAt: "2026-10-01T10:00:00.000Z",
  salesEndsAt: "2026-11-01T09:00:00.000Z",
  inheritLocation: false,
  inheritMap: false,
  locationId: localExcecao.id,
  mapId: "mapa-padrao",
};

function envelope(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

function opcoes(defaultLocation: typeof localPrincipal | null = null) {
  return {
    defaultLocation,
    locations: [localPrincipal, localExcecao],
    defaultMap: { id: "mapa-padrao", version: 1, status: "CONFIRMADO", originalFileName: "mapa.csv" },
    maps: [{ id: "mapa-padrao", version: 1, status: "CONFIRMADO", originalFileName: "mapa.csv" }],
  };
}

function locais(defaultLocationId: string | null = null) {
  return {
    items: [localPrincipal, localExcecao].map((item) => ({ ...item, isDefault: item.id === defaultLocationId })),
    defaultLocationId,
    updatedAt: defaultLocationId ? "2026-10-30T12:00:00.000Z" : null,
  };
}

describe("integração comportamental de locais e sessões", () => {
  it("recarrega locais e opções após a troca do padrão e atualiza a prontidão", async () => {
    let defaultLocationId: string | null = null;
    const requests: Array<{ url: string; method: string }> = [];
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url.endsWith("/locais") && method === "GET") return envelope(locais(defaultLocationId));
      if (url.endsWith("/sessoes/opcoes") && method === "GET") return envelope(opcoes(defaultLocationId ? localPrincipal : null));
      throw new Error(`Rota inesperada: ${method} ${url}`);
    });

    const initial = await carregarDadosWorkspace("evento-1", fetcher);
    expect(initial.options.defaultLocation).toBeNull();
    expect(sessaoProntaParaSalvar(sessionValueToDraft({ ...sessaoComExcecao, inheritLocation: true, locationId: null }), initial.options)).toBe(false);

    defaultLocationId = "local-principal";
    const updated = await carregarDadosWorkspace("evento-1", fetcher);
    expect(updated.options.defaultLocation?.id).toBe("local-principal");
    expect(updated.options.locations).toHaveLength(2);
    expect(sessaoProntaParaSalvar(sessionValueToDraft({ ...sessaoComExcecao, inheritLocation: true, locationId: null }), updated.options)).toBe(true);
    expect(requests.filter((request) => request.url.endsWith("/locais") && request.method === "GET")).toHaveLength(2);
    expect(requests.filter((request) => request.url.endsWith("/sessoes/opcoes") && request.method === "GET")).toHaveLength(2);
  });

  it("mantém o locationId customizado ao aplicar o novo padrão", async () => {
    const fetcher = vi.fn(async (input: string) => input.endsWith("/locais") ? envelope(locais("local-principal")) : envelope(opcoes(localPrincipal)));
    const { options } = await carregarDadosWorkspace("evento-1", fetcher);
    const draft = sessionValueToDraft(sessaoComExcecao);

    expect(draft.locationId).toBe("local-excecao");
    expect(options.defaultLocation?.id).toBe("local-principal");
    expect(draft.locationId).not.toBe(options.defaultLocation?.id);
  });
});

describe("etapa de sessões", () => {
  it("carrega locais e integra o gerenciador acima dos cartões", () => {
    expect(source).toContain("EventLocationManager");
    expect(source).toContain("buscarDadosWorkspace");
    expect(source).toContain("initialItems={locations.items}");
    expect(source).toContain("initialDefaultLocationId={locations.defaultLocationId}");
    expect(source).toContain("onChanged={atualizarDadosWorkspace}");
  });

  it("recarrega locais e opções depois de uma mutação sem substituir as sessões", () => {
    expect(source).toContain("atualizarDadosWorkspace");
    expect(source).toContain("router.refresh();");
    expect(source).toContain("setOptions");
    expect(source).toContain("setLocations");
    expect(source).toContain("sessionsRef.current");
  });

  it("carrega opções visuais separadas e exibe seus estados", () => {
    expect(source).toContain("buscarDadosWorkspace");
    expect(source).toContain("SessionOptions");
    expect(source).toContain("optionsLoading");
    expect(source).toContain("Carregando opções de local e mapa");
    expect(source).toContain("Erro ao carregar opções de local e mapa");
    expect(source).toContain("options={options ?? EMPTY_OPTIONS}");
  });

  it("atualiza a prontidão somente depois de salvar ou excluir no servidor", () => {
    expect(source).toContain("useRouter");
    expect(source).toContain("onSaved: () => {");
    expect(source).toContain('method: "DELETE"');
    expect(source).toContain("router.refresh();");
  });

  it("não agenda autosave para sessão incompleta", () => {
    expect(source).toContain("validarSessao");
    expect(source).toContain("sessoesProntasParaSalvar");
    expect(source).toContain("dirty && sessoesProntasParaSalvar");
  });

  it("preserva o identificador retornado ao criar e remove apenas o persistido", () => {
    expect(source).toContain("persistirSessaoSalva");
    expect(source).toContain("onRemove={removerSessao}");
    expect(source).toContain("if (!session.id) return");
  });
});


it("restaura sessão local quando a exclusão persistida falha", () => {
  expect(source).toContain("setSessions(restored);");
  expect(source).toContain("setDirty(temAlteracoes);");
  expect(source).toContain("Não foi possível remover a sessão salva.");
});

it("não mascara rascunho inválido como salvo nem reutiliza ID por índice", () => {
  expect(source).toContain("possuiPendenciaLocal");
  expect(source).toContain("Alterações locais pendentes");
  expect(source).not.toContain("persistedIds.current[index]");
});

it("preserva alterações de outras sessões ao remover uma sessão", () => {
  expect(source).toContain("savedSessionsRef");
  expect(source).toContain("sessionsRef");
  expect(source).toContain("temAlteracoesPendentes");
  expect(source).toContain("setDirty(temAlteracoes);");
  expect(source).toContain("if (!temAlteracoes)");
});

it("invalida respostas de autosave que chegam depois da remoção", () => {
  expect(source).toContain("autosave.invalidate()");
  expect(source).toContain("mutationGenerationRef");
  expect(source).toContain("clientId");
  expect(source).toContain("descartarSessaoCriadaDepoisDaRemocao");
  expect(source).toContain("deveCompensar");
});

it("mescla respostas stale por clientId e não ignora falha de compensação", () => {
  expect(source).toContain("criarPersistenciaSessao");
  expect(source).toContain("mesclarRespostaSessao");
  expect(source).toContain("identidadeSessaoAutosave");
  expect(source).toContain("assertRespostaApi({ ok: response.ok, status: response.status, body });");
  expect(source).toContain("Não foi possível limpar a sessão criada após a remoção.");
});
