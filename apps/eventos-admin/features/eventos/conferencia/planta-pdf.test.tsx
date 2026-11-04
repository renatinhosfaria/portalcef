// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const render = vi.fn(() => ({ promise: Promise.resolve() }));
  const getViewport = vi.fn(({ scale }: { scale: number }) => ({ width: 842 * scale, height: 595 * scale }));
  const getPage = vi.fn(async () => ({ getViewport, render }));
  const getDocument = vi.fn((_url: string) => ({ promise: Promise.resolve({ getPage, destroy: vi.fn() }), destroy: vi.fn() }));
  return { render, getViewport, getPage, getDocument, GlobalWorkerOptions: { workerSrc: "" } };
});

vi.mock("pdfjs-dist", () => ({ getDocument: mocks.getDocument, GlobalWorkerOptions: mocks.GlobalWorkerOptions }));

import { PlantaPdf } from "./planta-pdf";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("PlantaPdf", () => {
  it("carrega o PDF pela URL e desenha a página pedida", async () => {
    render(<PlantaPdf url="/original.pdf" pagina={2} largura={8420} altura={5950} />);

    await waitFor(() => expect(mocks.render).toHaveBeenCalledTimes(1));
    expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: "/original.pdf" }));
    expect(mocks.getPage).toHaveBeenCalledWith(2);
    expect(mocks.GlobalWorkerOptions.workerSrc).toContain("pdf.worker.min.mjs");
    const canvas = screen.getByLabelText("Planta original") as HTMLCanvasElement;
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas.width).toBe(842 * 2);
    expect(canvas.height).toBe(595 * 2);
  });

  it("mostra aviso quando não consegue abrir o PDF", async () => {
    mocks.getDocument.mockImplementationOnce(() => ({
      get promise(): Promise<never> {
        return Promise.reject(new Error("falhou"));
      },
      destroy: vi.fn(),
    }) as never);
    render(<PlantaPdf url="/quebrado.pdf" pagina={1} largura={8420} altura={5950} />);

    expect(await screen.findByText("Não foi possível mostrar a planta original.")).toBeTruthy();
  });
});
