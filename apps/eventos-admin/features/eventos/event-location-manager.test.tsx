// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventLocationManager } from "./event-location-manager";
import type { EventoLocalOption } from "./event-location-contracts";

const local: EventoLocalOption = {
  id: "local-1",
  name: "Auditório Principal",
  address: "Rua das Flores, 10",
  room: "Sala 1",
  instructions: "Entrar pela portaria",
  accessibility: "Rampa",
  isDefault: true,
};

const outroLocal: EventoLocalOption = {
  id: "local-2",
  name: "Quadra coberta",
  address: "Rua das Flores, 12",
  room: null,
  instructions: null,
  accessibility: null,
  isDefault: false,
};

const props = {
  eventId: "evento-1",
  initialItems: [local],
  initialDefaultLocationId: "local-1",
  initialUpdatedAt: "2026-10-30T10:00:00.000Z",
  onChanged: () => undefined,
};

function resposta(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function respostaErro(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("EventLocationManager", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra estado vazio acionável", () => {
    render(<EventLocationManager {...props} initialItems={[]} initialDefaultLocationId={null} />);
    expect(screen.getByText("Nenhum local cadastrado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar local" })).toBeTruthy();
  });

  it("mostra o estado Padrão ou Disponível e a ação prevista para cada local", () => {
    render(<EventLocationManager {...props} initialItems={[local, outroLocal]} />);
    expect(screen.getByText("Auditório Principal")).toBeTruthy();
    expect(screen.getByText("Padrão")).toBeTruthy();
    expect(screen.getByText("Disponível")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Usar como padrão" })).toBeTruthy();
    expect(screen.queryByText("Escolher como padrão")).toBeNull();
    expect(screen.queryByText("Entrar pela portaria")).toBeNull();
  });

  it("mantém os campos obrigatórios acessíveis no formulário inicial", () => {
    render(<EventLocationManager {...props} initialItems={[]} initialDefaultLocationId={null} />);
    expect(screen.getByLabelText("Nome do local")).toBeTruthy();
    expect(screen.getByLabelText("Endereço do local")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Campos avançados" })).toBeTruthy();
  });

  it("cadastra por POST, exibe loading e fecha o formulário após sucesso", async () => {
    const request = deferred<Response>();
    const fetchMock = vi.fn(() => request.promise);
    const onChanged = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EventLocationManager {...props} initialItems={[]} initialDefaultLocationId={null} onChanged={onChanged} />);
    await user.type(screen.getByLabelText("Nome do local"), "  Teatro  ");
    await user.type(screen.getByLabelText("Endereço do local"), " Avenida Central, 20 ");
    await user.click(screen.getByRole("button", { name: "Cadastrar local" }));

    expect(screen.getByRole("status").textContent).toContain("Salvando local");
    expect(screen.getByRole("button", { name: "Cadastrar local" })).toHaveProperty("disabled", true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/eventos-admin/api/eventos/admin/evento-1/locais",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Teatro", address: "Avenida Central, 20", room: null, instructions: null, accessibility: null }),
      }),
    );

    request.resolve(resposta({ ...outroLocal, id: "local-3", name: "Teatro", address: "Avenida Central, 20" }));
    await waitFor(() => expect(screen.getByText("Teatro")).toBeTruthy());
    expect(screen.queryByRole("form", { name: "Adicionar local" })).toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("edita por PATCH preservando expectedUpdatedAt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta({ ...local, name: "Auditório renovado" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EventLocationManager {...props} />);
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const name = screen.getByLabelText("Nome do local");
    await user.clear(name);
    await user.type(name, "Auditório renovado");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(screen.getByText("Auditório renovado")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      "/eventos-admin/api/eventos/admin/evento-1/locais/local-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Auditório renovado",
          address: "Rua das Flores, 10",
          room: "Sala 1",
          instructions: "Entrar pela portaria",
          accessibility: "Rampa",
          expectedUpdatedAt: "2026-10-30T10:00:00.000Z",
        }),
      }),
    );
  });

  it("seleciona o padrão por PATCH, exibe loading e atualiza a indicação após sucesso", async () => {
    const request = deferred<Response>();
    const fetchMock = vi.fn(() => request.promise);
    const onChanged = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EventLocationManager {...props} initialItems={[local, outroLocal]} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Usar como padrão" }));

    expect(screen.getByRole("status").textContent).toContain("Atualizando local padrão");
    expect(fetchMock).toHaveBeenCalledWith(
      "/eventos-admin/api/eventos/admin/evento-1/local-padrao",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ defaultLocationId: "local-2", expectedUpdatedAt: "2026-10-30T10:00:00.000Z" }),
      }),
    );

    request.resolve(resposta({ defaultLocationId: "local-2", updatedAt: "2026-10-30T11:00:00.000Z" }));
    await waitFor(() => expect(screen.getAllByText("Padrão")).toHaveLength(1));
    expect(screen.getByText("Auditório Principal")).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("preserva o draft e mostra erro de rede após falha no POST", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Falha de rede"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EventLocationManager {...props} initialItems={[]} initialDefaultLocationId={null} />);
    const name = screen.getByLabelText("Nome do local");
    const address = screen.getByLabelText("Endereço do local");
    await user.type(name, "Local em rascunho");
    await user.type(address, "Rua preservada, 5");
    await user.click(screen.getByRole("button", { name: "Cadastrar local" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Falha de rede"));
    expect(name).toHaveProperty("value", "Local em rascunho");
    expect(address).toHaveProperty("value", "Rua preservada, 5");
    expect(screen.getByRole("form", { name: "Adicionar local" })).toBeTruthy();
  });

  it("preserva o draft e informa conflito ao trocar o padrão", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaErro(409, "VERSION_CONFLICT", "O evento foi atualizado por outra pessoa."));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<EventLocationManager {...props} initialItems={[local, outroLocal]} />);
    await user.click(screen.getByRole("button", { name: "Adicionar local" }));
    await user.type(screen.getByLabelText("Nome do local"), "Rascunho mantido");
    await user.type(screen.getByLabelText("Endereço do local"), "Rua mantida, 9");
    await user.click(screen.getByRole("button", { name: "Usar como padrão" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("O evento mudou em outra janela"));
    expect(screen.getByLabelText("Nome do local")).toHaveProperty("value", "Rascunho mantido");
    expect(screen.getByLabelText("Endereço do local")).toHaveProperty("value", "Rua mantida, 9");
  });
});
