// @vitest-environment jsdom
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LugarMapa } from "@essencia/components/eventos/mapa-estilo-b";
import { LetrasLaterais } from "../mapa/letras-laterais";

afterEach(cleanup);

const lugar: LugarMapa = {
  id: "g21",
  fileira: "G",
  numero: "21",
  x: 50,
  y: 50,
  largura: 20,
  altura: 10,
  rotacao: 0,
  categoria: "COMUM",
  acessoExterno: false,
  estado: "livre",
};

describe("LetrasLaterais", () => {
  it("centraliza verticalmente as pílulas na fileira transformada", () => {
    const { container } = render(<LetrasLaterais lugares={[lugar]} transformacao={{ x: 0, y: -100, k: 3 }} altura={200} />);
    const pilulas = container.querySelectorAll('[data-fileira="G"]');
    expect(pilulas).toHaveLength(2);
    expect(pilulas[0]?.getAttribute("style")).toContain("top: 25%;");
    expect(pilulas[0]?.getAttribute("style")).toContain("transform: translateY(-50%);");
    expect(pilulas[1]?.className).toContain("rounded-full");
  });

  it("oculta as pílulas abaixo de k=3", () => {
    const { container } = render(<LetrasLaterais lugares={[lugar]} transformacao={{ x: 0, y: 0, k: 2.99 }} altura={200} />);
    expect(container.firstChild).toBeNull();
  });
});
