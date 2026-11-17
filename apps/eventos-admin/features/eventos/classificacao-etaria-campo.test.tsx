// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassificacaoEtariaCampo } from "./classificacao-etaria-campo";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function respostaJson(corpo: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

describe("ClassificacaoEtariaCampo", () => {
  it("lista as faixas e mostra a escolha atual", () => {
    render(<ClassificacaoEtariaCampo eventId="e1" valor="12" updatedAt="2026-11-17T10:00:00.000Z" aoSalvar={vi.fn()} />);
    const campo = screen.getByLabelText("Classificação indicativa") as HTMLSelectElement;
    expect(campo.value).toBe("12");
    expect(Array.from(campo.options).map((opcao) => opcao.textContent)).toEqual(["Não informada", "Livre", "10 anos", "12 anos", "14 anos", "16 anos", "18 anos"]);
  });

  it("salva na hora pela rota própria e devolve a nova versão do evento", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson({ success: true, data: { classificacaoEtaria: "LIVRE", updatedAt: "2026-11-17T12:00:00.000Z" } }));
    vi.stubGlobal("fetch", fetchMock);
    const aoSalvar = vi.fn();
    render(<ClassificacaoEtariaCampo eventId="e1" valor={null} updatedAt="2026-11-17T10:00:00.000Z" aoSalvar={aoSalvar} />);

    fireEvent.change(screen.getByLabelText("Classificação indicativa"), { target: { value: "LIVRE" } });

    await waitFor(() => expect(aoSalvar).toHaveBeenCalledWith("LIVRE", "2026-11-17T12:00:00.000Z"));
    expect(fetchMock).toHaveBeenCalledWith("/eventos-admin/api/eventos/admin/e1/classificacao-etaria", expect.objectContaining({ method: "PATCH", credentials: "include" }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ classificacaoEtaria: "LIVRE", expectedUpdatedAt: "2026-11-17T10:00:00.000Z" });
    expect(screen.getByRole("status").textContent).toBe("Classificação salva.");
  });

  it("envia null ao limpar a classificação", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson({ success: true, data: { classificacaoEtaria: null, updatedAt: "2026-11-17T12:00:00.000Z" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ClassificacaoEtariaCampo eventId="e1" valor="10" aoSalvar={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Classificação indicativa"), { target: { value: "" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ classificacaoEtaria: null });
  });

  it("volta ao valor anterior e explica quando a API recusa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaJson({ success: false, error: { code: "VERSION_CONFLICT", message: "O evento foi alterado por outra pessoa" } })));
    const aoSalvar = vi.fn();
    render(<ClassificacaoEtariaCampo eventId="e1" valor="12" updatedAt="2026-11-17T10:00:00.000Z" aoSalvar={aoSalvar} />);

    fireEvent.change(screen.getByLabelText("Classificação indicativa"), { target: { value: "16" } });

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("O evento foi alterado por outra pessoa"));
    expect((screen.getByLabelText("Classificação indicativa") as HTMLSelectElement).value).toBe("12");
    expect(aoSalvar).not.toHaveBeenCalled();
  });
});
