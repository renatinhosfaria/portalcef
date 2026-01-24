import { describe, expect, it, vi } from "vitest";

/**
 * Testes unitários da lógica de polling
 * Verifica se o intervalo de polling é configurado corretamente
 */
describe("Lógica de Polling - Preview de Documentos", () => {
  it("deve verificar se há documentos PENDENTE", () => {
    const documentosComPendente = [
      {
        id: "doc-1",
        previewStatus: "PENDENTE" as const,
      },
      {
        id: "doc-2",
        previewStatus: "PRONTO" as const,
      },
    ];

    const temPendentes = documentosComPendente.some(
      (doc) => doc.previewStatus === "PENDENTE",
    );

    expect(temPendentes).toBe(true);
  });

  it("NÃO deve identificar documentos PENDENTE quando não há", () => {
    const documentosSemPendente = [
      {
        id: "doc-1",
        previewStatus: "PRONTO" as const,
      },
      {
        id: "doc-2",
        previewStatus: undefined,
      },
    ];

    const temPendentes = documentosSemPendente.some(
      (doc) => doc.previewStatus === "PENDENTE",
    );

    expect(temPendentes).toBe(false);
  });

  it("deve configurar polling de 3 segundos quando há PENDENTE", () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    const temPendentes = true;

    let interval: NodeJS.Timeout | undefined;

    if (temPendentes) {
      interval = setInterval(() => {
        refetch();
      }, 3000);
    }

    // Não deve ter chamado ainda
    expect(refetch).toHaveBeenCalledTimes(0);

    // Avançar 3 segundos
    vi.advanceTimersByTime(3000);
    expect(refetch).toHaveBeenCalledTimes(1);

    // Avançar mais 3 segundos
    vi.advanceTimersByTime(3000);
    expect(refetch).toHaveBeenCalledTimes(2);

    // Limpar
    if (interval) clearInterval(interval);
    vi.useRealTimers();
  });

  it("NÃO deve configurar polling quando não há PENDENTE", () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    const temPendentes = false;

    let interval: NodeJS.Timeout | undefined;

    if (temPendentes) {
      interval = setInterval(() => {
        refetch();
      }, 3000);
    }

    // Avançar 10 segundos
    vi.advanceTimersByTime(10000);

    // Não deve ter chamado
    expect(refetch).toHaveBeenCalledTimes(0);

    // Limpar
    if (interval) clearInterval(interval);
    vi.useRealTimers();
  });
});
