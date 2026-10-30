import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("etapa de sessões", () => {
  it("carrega locais e integra o gerenciador acima dos cartões", () => {
    expect(source).toContain("EventLocationManager");
    expect(source).toContain("normalizarRespostaLocais");
    expect(source).toContain("/locais");
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
    expect(source).toContain("/sessoes/opcoes");
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
