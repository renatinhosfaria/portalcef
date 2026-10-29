import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("etapa de sessões", () => {
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
