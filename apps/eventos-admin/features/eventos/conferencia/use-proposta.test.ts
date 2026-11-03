// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProposta } from "./use-proposta";

function proposta(revisao: number, vender = true): PropostaMapa {
  return {
    versao: 1,
    revisao,
    pagina: { numero: 1, largura: 8420, altura: 5950 },
    lugares: [
      { id: "l1", fileira: "A", numero: "1", x: 0, y: 0, largura: 100, altura: 100, rotacao: 0, blocoId: null, cor: "#fff", categoriaManual: null, acessoExternoManual: null, vender, origem: "GERADOR" },
    ],
    rotulos: [],
    elementos: [],
    legenda: [],
    pontos: [],
  };
}

const inicial0 = proposta(0);
const inicial5 = proposta(5);
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
const erroApi = (code: string) => new Response(JSON.stringify({ success: false, error: { code, message: code } }), { status: 409 });
const editar = (vender: boolean) => [{ tipo: "EDITAR_LUGAR" as const, lugarId: "l1", vender }];
const corpo = (fetchMock: ReturnType<typeof vi.fn>, i: number) => JSON.parse((fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].body as string);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useProposta", () => {
  it("aplica na tela na hora e envia PATCH com a revisão base", async () => {
    const fetchMock = vi.fn(async () => ok(proposta(6, false)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProposta("ev1", "m1", inicial5));

    act(() => result.current.aplicar(editar(false)));
    expect(result.current.proposta.lugares[0].vender).toBe(false);
    expect(result.current.proposta.revisao).toBe(6);
    expect(result.current.salvando).toBe(true);

    await waitFor(() => expect(result.current.salvando).toBe(false));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/eventos-admin/api/eventos/admin/ev1/mapas/m1/proposta");
    expect(init.method).toBe("PATCH");
    expect(corpo(fetchMock, 0)).toEqual({ revisaoBase: 5, operacoes: editar(false) });
    expect(result.current.erro).toBeNull();
  });

  it("envia duas alterações rápidas em ordem, a segunda com a revisão seguinte", async () => {
    let liberarPrimeira!: () => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => { liberarPrimeira = () => r(ok(proposta(1, false))); }))
      .mockImplementationOnce(async () => ok(proposta(2, true)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProposta("ev1", "m1", inicial0));

    act(() => result.current.aplicar(editar(false)));
    act(() => result.current.aplicar(editar(true)));
    expect(result.current.proposta.revisao).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => liberarPrimeira());
    await waitFor(() => expect(result.current.salvando).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(corpo(fetchMock, 0).revisaoBase).toBe(0);
    expect(corpo(fetchMock, 1)).toEqual({ revisaoBase: 1, operacoes: editar(true) });
  });

  it("revisão desatualizada recarrega e avisa (duas abas)", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => erroApi("PROPOSTA_DESATUALIZADA"))
      .mockImplementationOnce(async () => ok({ map: { id: "m1", status: "EM_REVISAO" }, proposta: proposta(9) }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProposta("ev1", "m1", inicial5));

    act(() => result.current.aplicar(editar(false)));
    await waitFor(() => expect(result.current.erro).not.toBeNull());
    expect(result.current.erro).toBe("Esta conferência foi alterada em outra aba. Carregamos a versão mais recente.");
    expect(result.current.proposta.revisao).toBe(9);
    expect(result.current.salvando).toBe(false);
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe("/eventos-admin/api/eventos/admin/ev1/mapas/m1/revisao");
  });

  it("falha de rede recarrega a conferência e avisa", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => { throw new TypeError("Failed to fetch"); })
      .mockImplementationOnce(async () => ok({ map: { id: "m1", status: "EM_REVISAO" }, proposta: proposta(5) }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProposta("ev1", "m1", inicial5));

    act(() => result.current.aplicar(editar(false)));
    await waitFor(() => expect(result.current.erro).not.toBeNull());
    expect(result.current.erro).toBe("Não foi possível salvar a última alteração. Carregamos a conferência de novo.");
    expect(result.current.proposta.lugares[0].vender).toBe(true);
    expect(result.current.proposta.revisao).toBe(5);
  });

  it("operação inválida na tela não envia nada e mostra a mensagem", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProposta("ev1", "m1", inicial0));

    act(() => result.current.aplicar([{ tipo: "EXCLUIR_LUGAR", lugarId: "inexistente" }]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.erro).toBeTruthy();
    expect(result.current.proposta.revisao).toBe(0);
  });

  it("reinicia o estado quando chega outra proposta inicial", () => {
    const { result, rerender } = renderHook(({ inicial }) => useProposta("ev1", "m1", inicial), { initialProps: { inicial: proposta(1) } });
    rerender({ inicial: proposta(4) });
    expect(result.current.proposta.revisao).toBe(4);
  });
});
