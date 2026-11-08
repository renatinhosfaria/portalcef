import { cleanup, fireEvent, render } from "@testing-library/react";
import { act, createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapaEstiloB, type ControleMapa, type LugarMapa } from "./mapa-estilo-b";

afterEach(cleanup);

function lugar(parcial: Partial<LugarMapa> & { id: string }): LugarMapa {
  return {
    fileira: "R", numero: "13", x: 500, y: 400, largura: 100, altura: 80, rotacao: 0,
    categoria: "COMUM", acessoExterno: false, estado: "livre", ...parcial,
  };
}

const base = { largura: 8420, altura: 5950, rotulos: [], elementos: [], rotuloAcessivel: "Mapa de assentos" };

function retangulo(container: HTMLElement, id: string): Element {
  return container.querySelector(`[data-lugar-id="${id}"] rect`)!;
}

function centroDentroDoPalco(path: string, x: number, y: number): boolean {
  const valores = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const [x0, yBase, xControle, yControle, x1] = valores;
  if ([x0, yBase, xControle, yControle, x1].some((valor) => valor === undefined) || y < yControle! || y > yBase!) return false;
  if (yBase === yControle) return x === x0 && y === yBase;
  const proporcao = (yBase! - y) / (yBase! - yControle!);
  const raiz = Math.sqrt(Math.max(0, 1 - proporcao));
  const tEsquerda = (1 - raiz) / 2;
  const tDireita = (1 + raiz) / 2;
  const ponto = (t: number) => (1 - t) ** 2 * x0! + 2 * (1 - t) * t * xControle! + t ** 2 * x1!;
  const esquerda = ponto(tEsquerda);
  const direita = ponto(tDireita);
  return x >= Math.min(esquerda, direita) && x <= Math.max(esquerda, direita);
}

describe("MapaEstiloB", () => {
  it("desenha um grupo por lugar com translate e rotate", () => {
    const { container } = render(
      <MapaEstiloB {...base} lugares={[lugar({ id: "a", x: 500, y: 400, rotacao: 12 }), lugar({ id: "b", x: 900, y: 400 })]} />,
    );
    const grupos = container.querySelectorAll("[data-lugar-id]");
    expect(grupos).toHaveLength(2);
    expect(grupos[0]?.getAttribute("transform")).toBe("translate(500 400) rotate(12)");
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 8420 5950");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    expect(svg.getAttribute("aria-label")).toBe("Mapa de assentos");
  });

  it("usa rx de 0,26 da altura, faixa de base de 0,23 e fonte de 0,5", () => {
    const { container } = render(<MapaEstiloB {...base} lugares={[lugar({ id: "a", altura: 100, largura: 120 })]} />);
    const g = container.querySelector("[data-lugar-id='a']")!;
    const rects = g.querySelectorAll("rect");
    expect(rects[0]?.getAttribute("rx")).toBe("26");
    expect(rects[1]?.getAttribute("height")).toBe("23");
    expect(g.querySelector("text")!.getAttribute("font-size")).toBe("50");
  });

  it("pinta cada categoria, acesso externo, bloqueado e selecionado com as cores do estilo B", () => {
    const lugares = [
      lugar({ id: "comum" }),
      lugar({ id: "cad", categoria: "CADEIRANTE" }),
      lugar({ id: "opc", categoria: "OPCIONAL_CADEIRANTE" }),
      lugar({ id: "ob", categoria: "OBESO" }),
      lugar({ id: "ext", acessoExterno: true }),
      lugar({ id: "blq", estado: "bloqueado" }),
      lugar({ id: "sel" }),
      lugar({ id: "sem", categoria: null }),
      lugar({ id: "selblq", estado: "bloqueado" }),
    ];
    const { container } = render(<MapaEstiloB {...base} lugares={lugares} selecionados={new Set(["sel", "selblq"])} />);
    const cor = (id: string) => [retangulo(container, id).getAttribute("fill"), retangulo(container, id).getAttribute("stroke")];
    expect(cor("comum")).toEqual(["#ffffff", "#9fb08a"]);
    expect(cor("cad")).toEqual(["#3b82f6", "#1d4ed8"]);
    expect(cor("opc")).toEqual(["#ffffff", "#3b82f6"]);
    expect(cor("ob")).toEqual(["#faf5ff", "#a855f7"]);
    expect(cor("ext")).toEqual(["#ecfeff", "#06b6d4"]);
    expect(cor("blq")).toEqual(["#e4e6e1", "#c9cdc6"]);
    expect(cor("sel")).toEqual(["#7fae2e", "#4d6a17"]);
    expect(cor("selblq")).toEqual(["#7fae2e", "#4d6a17"]);
    expect(cor("sem")).toEqual(["#fff7ed", "#d97706"]);
    expect(container.querySelector("[data-lugar-id='cad'] text")!.getAttribute("fill")).toBe("#ffffff");
  });

  it("contorna os destacados com tracejado âmbar", () => {
    const { container } = render(
      <MapaEstiloB {...base} lugares={[lugar({ id: "a" }), lugar({ id: "b" })]} destacados={new Set(["a"])} />,
    );
    const destaque = container.querySelector("[data-lugar-id='a'] rect[data-destaque]")!;
    expect(destaque.getAttribute("stroke")).toBe("#d97706");
    expect(destaque.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(container.querySelector("[data-lugar-id='b'] rect[data-destaque]")).toBeNull();
  });

  it("chama onLugarClick com shiftKey e responde a Enter e Espaço", () => {
    const aoClicar = vi.fn();
    const { container } = render(
      <MapaEstiloB {...base} lugares={[lugar({ id: "a", categoria: "CADEIRANTE" })]} onLugarClick={aoClicar} />,
    );
    const g = container.querySelector("[data-lugar-id='a']")!;
    expect(g.getAttribute("role")).toBe("button");
    expect(g.getAttribute("tabindex")).toBe("0");
    expect(g.getAttribute("aria-label")).toBe("R-13, Cadeirante");
    fireEvent.click(g, { shiftKey: true });
    expect(aoClicar).toHaveBeenLastCalledWith("a", { shiftKey: true });
    fireEvent.keyDown(g, { key: "Enter" });
    expect(aoClicar).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(g, { key: " " });
    expect(aoClicar).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(g, { key: "a" });
    expect(aoClicar).toHaveBeenCalledTimes(3);
  });

  it("aplica coresDoLugar quando informado", () => {
    const { container } = render(
      <MapaEstiloB
        {...base}
        lugares={[lugar({ id: "a" })]}
        coresDoLugar={() => ({ preenchimento: "#123456", contorno: "#654321", numero: "#abcdef" })}
      />,
    );
    const g = container.querySelector("[data-lugar-id='a']")!;
    expect(g.querySelector("rect")!.getAttribute("fill")).toBe("#123456");
    expect(g.querySelector("rect")!.getAttribute("stroke")).toBe("#654321");
    expect(g.querySelector("text")!.getAttribute("fill")).toBe("#abcdef");
  });

  it("lugar desabilitado não clica e fica fora do tab", () => {
    const aoClicar = vi.fn();
    const { container } = render(
      <MapaEstiloB
        {...base}
        lugares={[lugar({ id: "a" })]}
        onLugarClick={aoClicar}
        lugarDesabilitado={() => true}
      />,
    );
    const g = container.querySelector("[data-lugar-id='a']")!;
    expect(g.getAttribute("aria-disabled")).toBe("true");
    expect(g.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(g);
    fireEvent.keyDown(g, { key: "Enter" });
    fireEvent.keyDown(g, { key: " " });
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("lugar desabilitado sem handler também fica fora do tab", () => {
    const { container } = render(
      <MapaEstiloB {...base} lugares={[lugar({ id: "a" })]} lugarDesabilitado={() => true} />,
    );
    const g = container.querySelector("[data-lugar-id='a']")!;
    expect(g.getAttribute("tabindex")).toBe("-1");
  });

  it("aplica a transição ao retângulo principal de todo lugar", () => {
    const lugares = [
      lugar({ id: "comum", categoria: "COMUM" }),
      lugar({ id: "cadeirante", categoria: "CADEIRANTE" }),
      lugar({ id: "opcional", categoria: "OPCIONAL_CADEIRANTE" }),
      lugar({ id: "obeso", categoria: "OBESO" }),
      lugar({ id: "sem", categoria: null }),
    ];
    const { container } = render(<MapaEstiloB {...base} lugares={lugares} />);
    for (const lugarAtual of lugares) {
      const retanguloPrincipal = container.querySelector(`[data-lugar-id='${lugarAtual.id}'] rect`) as SVGRectElement;
      expect(retanguloPrincipal.classList.contains("mapa-estilo-b-cadeirinha")).toBe(true);
      expect(retanguloPrincipal.style.transition).toBe("fill 150ms, stroke 150ms");
    }
  });

  it("oculta números abaixo da escala mínima", () => {
    const { container } = render(<MapaEstiloB {...base} lugares={[lugar({ id: "a" })]} escalaMinimaNumeros={2} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-numeros")).toBe("ocultos");
    expect(svg.querySelector("style")?.textContent).toContain("mapa-estilo-b-numero");
    expect(svg.querySelector("text.mapa-estilo-b-numero")).not.toBeNull();
  });

  it("informa a transformação na montagem", () => {
    const onTransformacao = vi.fn();
    render(<MapaEstiloB {...base} lugares={[]} onTransformacao={onTransformacao} />);
    expect(onTransformacao).toHaveBeenCalledWith({ x: 0, y: 0, k: 1 });
  });

  it("controle enquadra de volta em k=1", () => {
    const controle = createRef<ControleMapa>();
    const { container } = render(<MapaEstiloB {...base} lugares={[]} controleRef={controle} />);
    act(() => {
      controle.current?.focar({ x: 100, y: 100, largura: 500, altura: 400 });
    });
    expect(container.querySelector("svg > g")!.getAttribute("transform")).not.toBe("translate(0 0) scale(1)");
    act(() => {
      controle.current?.enquadrar();
    });
    expect(container.querySelector("svg > g")!.getAttribute("transform")).toBe("translate(0 0) scale(1)");
  });

  it("sem onLugarClick vira imagem sem foco, e rotula sem categoria e não vender", () => {
    const { container } = render(
      <MapaEstiloB {...base} lugares={[lugar({ id: "a", categoria: null }), lugar({ id: "b", estado: "bloqueado" })]} />,
    );
    const a = container.querySelector("[data-lugar-id='a']")!;
    expect(a.getAttribute("role")).toBe("img");
    expect(a.getAttribute("tabindex")).toBeNull();
    expect(a.getAttribute("aria-label")).toBe("R-13, Sem categoria");
    expect(container.querySelector("[data-lugar-id='b']")!.getAttribute("aria-label")).toBe("R-13, Comum, não vender");
  });

  it("desenha palco, entrada e letras das fileiras", () => {
    const { container } = render(
      <MapaEstiloB
        {...base}
        lugares={[lugar({ id: "a", x: 1000, y: 3000 }), lugar({ id: "b", x: 3000, y: 4000 })]}
        rotulos={[{ fileira: "R", x: 200, y: 3000 }]}
        elementos={[
          { tipo: "PALCO", texto: "PALCO", x: 2000, y: 500 },
          { tipo: "ENTRADA", texto: "ENTRADA", x: 100, y: 5000 },
          { tipo: "SAIDA", texto: "SAÍDA", x: 7000, y: 5000 },
        ]}
      />,
    );
    const textos = Array.from(container.querySelectorAll("text"));
    const palco = textos.find((t) => t.textContent === "PALCO")!;
    expect(palco.getAttribute("fill")).toBe("#7c6d4f");
    expect(container.querySelector("path[data-palco]")!.getAttribute("fill")).toBe("#f1ead9");
    expect(container.querySelector("path[data-palco]")!.getAttribute("stroke")).toBe("#e2d6bb");
    expect(textos.find((t) => t.textContent === "ENTRADA")!.getAttribute("fill")).toBe("#9aa29c");
    expect(textos.find((t) => t.textContent === "SAÍDA")!.getAttribute("fill")).toBe("#9aa29c");
    const letra = textos.find((t) => t.textContent === "R" && !t.closest("[data-lugar-id]"))!;
    expect(letra.getAttribute("font-weight")).toBe("700");
    expect(letra.getAttribute("fill")).toBe("#9aa29c");
    expect(container.querySelector("svg > rect")!.getAttribute("fill")).toBe("#fffdf8");
  });

  it("não deixa o palco cobrir o centro de nenhum lugar na faixa do palco", () => {
    const { container } = render(
      <MapaEstiloB
        {...base}
        lugares={[
          lugar({ id: "esquerda", x: 1800, y: 600 }),
          lugar({ id: "direita", x: 2200, y: 600 }),
        ]}
        elementos={[{ tipo: "PALCO", texto: "PALCO", x: 2000, y: 500 }]}
      />,
    );

    const palco = container.querySelector("path[data-palco]")!;
    const comando = palco.getAttribute("d")!;
    const valores = comando.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const x0 = valores[0] ?? Number.NaN;
    const yBase = valores[1] ?? Number.NaN;
    const yControle = valores[3] ?? Number.NaN;
    const x1 = valores[4] ?? Number.NaN;
    expect(x0).toBe(1840);
    expect(x1).toBe(2160);
    expect(x1 - x0).toBe(4 * 80);
    expect(yControle).toBeLessThan(yBase);
    expect(container.querySelector("[data-lugar-id='esquerda']")!.getAttribute("transform")).toContain("translate(1800 600)");
  });

  it("reduz o palco para preservar centros muito próximos e mantém o limite quando há folga", () => {
    const perto = render(
      <MapaEstiloB
        {...base}
        lugares={[lugar({ id: "perto-a", x: 1950, y: 500 }), lugar({ id: "perto-b", x: 2050, y: 500 })]}
        elementos={[{ tipo: "PALCO", texto: "PALCO", x: 2000, y: 500 }]}
      />,
    );
    const pertoPath = perto.container.querySelector("path[data-palco]")!.getAttribute("d")!;
    const pertoValores = pertoPath.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(pertoValores[0]).toBe(1578);
    expect(pertoValores[4]).toBe(1898);
    expect(pertoValores[4]! - pertoValores[0]!).toBe(4 * 80);
    expect(centroDentroDoPalco(pertoPath, 1950, 500)).toBe(false);
    expect(centroDentroDoPalco(pertoPath, 2050, 500)).toBe(false);

    const folga = render(
      <MapaEstiloB
        {...base}
        lugares={[lugar({ id: "folga-a", x: 1000, y: 500 }), lugar({ id: "folga-b", x: 3000, y: 500 })]}
        elementos={[{ tipo: "PALCO", texto: "PALCO", x: 2000, y: 500 }]}
      />,
    );
    const folgaPath = folga.container.querySelector("path[data-palco]")!.getAttribute("d")!;
    const folgaValores = folgaPath.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(folgaValores[0]).toBe(1370);
    expect(folgaValores[4]).toBe(2630);
  });

  it("desloca o palco quando um centro de lugar coincide com o centro do palco", () => {
    const { container } = render(
      <MapaEstiloB
        {...base}
        lugares={[lugar({ id: "coincidente", x: 2000, y: 500 })]}
        elementos={[{ tipo: "PALCO", texto: "PALCO", x: 2000, y: 500 }]}
      />,
    );
    const path = container.querySelector("path[data-palco]")!.getAttribute("d")!;
    const valores = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const x0 = valores[0] ?? Number.NaN;
    const x1 = valores[4] ?? Number.NaN;
    expect(x1 - x0).toBeGreaterThanOrEqual(4 * 80);
    expect(centroDentroDoPalco(path, 2000, 500)).toBe(false);
  });

  it("repassa o clique no fundo em coordenadas do mapa", () => {
    const aoFundo = vi.fn();
    const { container } = render(<MapaEstiloB {...base} lugares={[]} onFundoClick={aoFundo} />);
    const svg = container.querySelector("svg")!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 842, height: 595, right: 842, bottom: 595, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(container.querySelector("[data-fundo-clique]")!, { clientX: 421, clientY: 297.5 });
    expect(aoFundo).toHaveBeenCalledTimes(1);
    expect(aoFundo.mock.calls[0]?.[0].x).toBeCloseTo(4210, 3);
    expect(aoFundo.mock.calls[0]?.[0].y).toBeCloseTo(2975, 3);
  });

  it("renderiza o fundo num foreignObject", () => {
    const { container } = render(
      <MapaEstiloB {...base} lugares={[lugar({ id: "a" })]} fundo={<div data-testid="pdf" />} opacidadeFundo={0.4} />,
    );
    expect(container.querySelector("foreignObject [data-testid='pdf']")).not.toBeNull();
  });

  describe("foco", () => {
    const grupoZoom = (c: HTMLElement) => c.querySelector("svg > g")!.getAttribute("transform");
    const lugares = [lugar({ id: "a" })];

    it("muda o transform quando o foco muda e volta à identidade com null", () => {
      const { container, rerender } = render(<MapaEstiloB {...base} lugares={lugares} />);
      const inicial = grupoZoom(container);
      rerender(<MapaEstiloB {...base} lugares={lugares} foco={{ x: 100, y: 100, largura: 500, altura: 400 }} />);
      const comFoco = grupoZoom(container);
      expect(comFoco).not.toBe(inicial);
      expect(comFoco).not.toBe("translate(0 0) scale(1)");
      rerender(<MapaEstiloB {...base} lugares={lugares} foco={null} />);
      expect(grupoZoom(container)).toBe("translate(0 0) scale(1)");
    });

    it("não reinicia o zoom do usuário num re-render com foco de valores iguais", () => {
      const { container, rerender } = render(
        <MapaEstiloB {...base} lugares={lugares} foco={{ x: 100, y: 100, largura: 500, altura: 400 }} />,
      );
      // simula o usuário dando zoom/pan depois do enquadramento
      container.querySelector("svg > g")!.setAttribute("transform", "translate(-50 -20) scale(3)");
      rerender(<MapaEstiloB {...base} lugares={lugares} foco={{ x: 100, y: 100, largura: 500, altura: 400 }} />);
      expect(grupoZoom(container)).toBe("translate(-50 -20) scale(3)");
    });
  });

  it("aplica a fonte a todos os textos do SVG via style, e não por atributo", () => {
    const { container } = render(
      <MapaEstiloB
        {...base}
        lugares={[lugar({ id: "a" })]}
        rotulos={[{ fileira: "R", x: 100, y: 100 }]}
        elementos={[{ tipo: "PALCO", texto: "PALCO", x: 4000, y: 300 }, { tipo: "ENTRADA", texto: "Entrada", x: 200, y: 5000 }]}
      />,
    );
    const textos = Array.from(container.querySelectorAll("text"));
    expect(textos).toHaveLength(4);
    for (const texto of textos) {
      expect(texto.style.fontFamily).toContain("var(--font-body");
      expect(texto.hasAttribute("font-family")).toBe(false);
    }
  });
});
