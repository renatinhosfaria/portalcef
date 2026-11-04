"use client";

import React, { useEffect, useId, useMemo, useRef } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import {
  ROTULO_CATEGORIA,
  type CategoriaLugar,
  type ElementoPlanta,
  type RotuloFileira,
} from "@essencia/shared/eventos/mapa-proposta";
import {
  converterPontoTela,
  ESCALA_MAXIMA,
  ESCALA_MINIMA,
  transformParaFoco,
  type TransformacaoZoom,
} from "./converter-ponto";

export interface LugarMapa {
  id: string;
  fileira: string;
  numero: string;
  /** Centro do lugar. */
  x: number;
  y: number;
  largura: number;
  altura: number;
  rotacao: number;
  categoria: CategoriaLugar | null;
  acessoExterno: boolean;
  estado: "livre" | "bloqueado";
}

export interface MapaEstiloBProps {
  largura: number;
  altura: number;
  lugares: LugarMapa[];
  rotulos: RotuloFileira[];
  elementos: ElementoPlanta[];
  rotuloAcessivel: string;
  selecionados?: ReadonlySet<string>;
  destacados?: ReadonlySet<string>;
  foco?: { x: number; y: number; largura: number; altura: number } | null;
  /** Colocado num foreignObject dentro do grupo com zoom, sob os lugares. */
  fundo?: React.ReactNode;
  opacidadeFundo?: number;
  onLugarClick?: (id: string, evento: { shiftKey: boolean }) => void;
  onFundoClick?: (ponto: { x: number; y: number }) => void;
}

interface Cores {
  preenchimento: string;
  contorno: string;
  numero: string;
}

const COR_FUNDO = "#fffdf8";
const COR_TEXTO = "#24302c";
const COR_DISCRETA = "#9aa29c";
const COR_DESTAQUE = "#d97706";
const FONTE = "var(--font-body, 'DM Sans'), system-ui, sans-serif";

/** Precedência: selecionado > bloqueado > acesso externo > categoria. */
function coresDoLugar(lugar: LugarMapa, selecionado: boolean): Cores {
  if (selecionado) return { preenchimento: "#7fae2e", contorno: "#4d6a17", numero: COR_TEXTO };
  if (lugar.estado === "bloqueado") return { preenchimento: "#e4e6e1", contorno: "#c9cdc6", numero: "#69736e" };
  if (lugar.acessoExterno) return { preenchimento: "#ecfeff", contorno: "#06b6d4", numero: COR_TEXTO };
  switch (lugar.categoria) {
    case "CADEIRANTE":
      return { preenchimento: "#3b82f6", contorno: "#1d4ed8", numero: "#ffffff" };
    case "OPCIONAL_CADEIRANTE":
      return { preenchimento: "#ffffff", contorno: "#3b82f6", numero: COR_TEXTO };
    case "OBESO":
      return { preenchimento: "#faf5ff", contorno: "#a855f7", numero: COR_TEXTO };
    case "COMUM":
      return { preenchimento: "#ffffff", contorno: "#9fb08a", numero: COR_TEXTO };
    default:
      return { preenchimento: "#fff7ed", contorno: COR_DESTAQUE, numero: COR_TEXTO };
  }
}

function rotuloAcessivelDoLugar(lugar: LugarMapa): string {
  const categoria = lugar.categoria ? ROTULO_CATEGORIA[lugar.categoria] : "Sem categoria";
  const naoVender = lugar.estado === "bloqueado" ? ", não vender" : "";
  return `${lugar.fileira}-${lugar.numero}, ${categoria}${naoVender}`;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function MapaEstiloB({
  largura,
  altura,
  lugares,
  rotulos,
  elementos,
  rotuloAcessivel,
  selecionados,
  destacados,
  foco,
  fundo,
  opacidadeFundo = 0.4,
  onLugarClick,
  onFundoClick,
}: MapaEstiloBProps): React.JSX.Element {
  const idBase = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const grupoRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformacaoRef = useRef<TransformacaoZoom>({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    const svg = svgRef.current;
    const grupo = grupoRef.current;
    if (!svg || !grupo) return;
    const comportamento = zoom<SVGSVGElement, unknown>()
      .scaleExtent([ESCALA_MINIMA, ESCALA_MAXIMA])
      .extent([[0, 0], [largura, altura]])
      .translateExtent([[0, 0], [largura, altura]])
      .on("zoom", (evento) => {
        const { x, y, k } = evento.transform as TransformacaoZoom;
        transformacaoRef.current = { x, y, k };
        grupo.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);
      });
    zoomRef.current = comportamento;
    select(svg).call(comportamento);
    return () => {
      select(svg).on(".zoom", null);
      zoomRef.current = null;
    };
  }, [largura, altura]);

  // Depende dos valores do foco, e não da identidade do objeto: um `foco` inline
  // recriado a cada render do pai não pode reiniciar o zoom do usuário.
  const focoX = foco?.x;
  const focoY = foco?.y;
  const focoLargura = foco?.largura;
  const focoAltura = foco?.altura;
  useEffect(() => {
    const svg = svgRef.current;
    const comportamento = zoomRef.current;
    if (!svg || !comportamento) return;
    const alvo =
      focoX === undefined || focoY === undefined || focoLargura === undefined || focoAltura === undefined
        ? null
        : transformParaFoco({ x: focoX, y: focoY, largura: focoLargura, altura: focoAltura }, largura, altura);
    const transformacao = alvo ? zoomIdentity.translate(alvo.x, alvo.y).scale(alvo.k) : zoomIdentity;
    select(svg).call(comportamento.transform, transformacao);
  }, [focoX, focoY, focoLargura, focoAltura, largura, altura]);

  const caixaLugares = useMemo(() => {
    if (lugares.length === 0) return { minX: 0, maxX: largura, minY: 0, maxY: altura };
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const l of lugares) {
      minX = Math.min(minX, l.x - l.largura / 2);
      maxX = Math.max(maxX, l.x + l.largura / 2);
      minY = Math.min(minY, l.y - l.altura / 2);
      maxY = Math.max(maxY, l.y + l.altura / 2);
    }
    return { minX, maxX, minY, maxY };
  }, [lugares, largura, altura]);

  const recortes = useMemo(() => {
    const mapa = new Map<string, { id: string; largura: number; altura: number }>();
    lugares.forEach((l) => {
      const chave = `${arredondar(l.largura)}x${arredondar(l.altura)}`;
      if (!mapa.has(chave)) mapa.set(chave, { id: `${idBase}-recorte-${chave}`, largura: l.largura, altura: l.altura });
    });
    return mapa;
  }, [lugares, idBase]);

  function aoClicarNoFundo(evento: React.MouseEvent<SVGRectElement>): void {
    const svg = svgRef.current;
    if (!onFundoClick || !svg) return;
    const caixa = svg.getBoundingClientRect();
    onFundoClick(
      converterPontoTela({
        clientX: evento.clientX,
        clientY: evento.clientY,
        caixa: { left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height },
        largura,
        altura,
        zoom: transformacaoRef.current,
      }),
    );
  }

  const larguraCaixaLugares = caixaLugares.maxX - caixaLugares.minX;
  const alturaMediaLugares = lugares.length > 0 ? lugares.reduce((total, lugar) => total + lugar.altura, 0) / lugares.length : 100;
  const larguraPalcoBase = larguraCaixaLugares * 0.6;
  const larguraMinimaPalco = 4 * alturaMediaLugares;
  const dimensoesPalco = (elemento: ElementoPlanta): { largura: number; altura: number } => {
    const alturaInicial = larguraPalcoBase * 0.14;
    const yMinimo = elemento.y - 1.5 * alturaInicial;
    const yMaximo = elemento.y + alturaInicial / 2;
    const distancias = lugares
      .filter((lugar) => lugar.y >= yMinimo && lugar.y <= yMaximo)
      .map((lugar) => Math.abs(lugar.x - elemento.x) - lugar.largura / 2);
    const menorDistancia = distancias.length > 0 ? Math.min(...distancias) : Number.POSITIVE_INFINITY;
    const limitePelosLugares = Number.isFinite(menorDistancia) ? 2 * menorDistancia - alturaMediaLugares : larguraPalcoBase;
    const largura = Math.max(larguraMinimaPalco, Math.min(larguraPalcoBase, limitePelosLugares));
    return { largura, altura: largura * 0.14 };
  };
  const fonteElemento = Math.max(60, Math.round(altura * 0.018));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={rotuloAcessivel}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    >
      <rect x={0} y={0} width={largura} height={altura} fill={COR_FUNDO} />
      <defs>
        {Array.from(recortes.values()).map((r) => (
          <clipPath key={r.id} id={r.id}>
            <rect x={-r.largura / 2} y={-r.altura / 2} width={r.largura} height={r.altura} rx={0.26 * r.altura} />
          </clipPath>
        ))}
      </defs>
      <g ref={grupoRef}>
        {fundo ? (
          <foreignObject x={0} y={0} width={largura} height={altura} style={{ opacity: opacidadeFundo, pointerEvents: "none" }}>
            {fundo}
          </foreignObject>
        ) : null}
        <rect
          data-fundo-clique
          x={0}
          y={0}
          width={largura}
          height={altura}
          fill="transparent"
          onClick={aoClicarNoFundo}
        />
        {elementos.map((elemento, indice) => {
          if (elemento.tipo === "PALCO") {
            const { largura: larguraPalco, altura: alturaPalco } = dimensoesPalco(elemento);
            const x0 = elemento.x - larguraPalco / 2;
            const x1 = elemento.x + larguraPalco / 2;
            const yBase = elemento.y + alturaPalco / 2;
            return (
              <g key={`el-${indice}`} pointerEvents="none">
                <path
                  data-palco
                  d={`M ${arredondar(x0)} ${arredondar(yBase)} Q ${arredondar(elemento.x)} ${arredondar(elemento.y - alturaPalco * 1.5)} ${arredondar(x1)} ${arredondar(yBase)} Z`}
                  fill="#f1ead9"
                  stroke="#e2d6bb"
                  strokeWidth={Math.max(4, altura * 0.002)}
                />
                <text
                  x={elemento.x}
                  y={elemento.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontFamily: FONTE }}
                  fontSize={fonteElemento * 1.2}
                  fontWeight={700}
                  fill="#7c6d4f"
                >
                  {elemento.texto || "PALCO"}
                </text>
              </g>
            );
          }
          return (
            <text
              key={`el-${indice}`}
              x={elemento.x}
              y={elemento.y}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fontFamily: FONTE }}
              fontSize={fonteElemento}
              fontWeight={600}
              fill={COR_DISCRETA}
              pointerEvents="none"
            >
              {elemento.texto}
            </text>
          );
        })}
        {rotulos.map((rotulo, indice) => (
          <text
            key={`rot-${indice}-${rotulo.fileira}`}
            x={rotulo.x}
            y={rotulo.y}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: FONTE }}
            fontSize={fonteElemento}
            fontWeight={700}
            fill={COR_DISCRETA}
            pointerEvents="none"
          >
            {rotulo.fileira}
          </text>
        ))}
        {lugares.map((lugar) => {
          const cores = coresDoLugar(lugar, selecionados?.has(lugar.id) ?? false);
          const recorte = recortes.get(`${arredondar(lugar.largura)}x${arredondar(lugar.altura)}`);
          const alturaBase = 0.23 * lugar.altura;
          const interativo = Boolean(onLugarClick);
          return (
            <g
              key={lugar.id}
              data-lugar-id={lugar.id}
              transform={`translate(${lugar.x} ${lugar.y}) rotate(${lugar.rotacao})`}
              role={interativo ? "button" : "img"}
              tabIndex={interativo ? 0 : undefined}
              aria-label={rotuloAcessivelDoLugar(lugar)}
              style={interativo ? { cursor: "pointer" } : undefined}
              onClick={interativo ? (e) => onLugarClick?.(lugar.id, { shiftKey: e.shiftKey }) : undefined}
              onKeyDown={
                interativo
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onLugarClick?.(lugar.id, { shiftKey: e.shiftKey });
                      }
                    }
                  : undefined
              }
            >
              <rect
                x={-lugar.largura / 2}
                y={-lugar.altura / 2}
                width={lugar.largura}
                height={lugar.altura}
                rx={0.26 * lugar.altura}
                fill={cores.preenchimento}
                stroke={cores.contorno}
                strokeWidth={Math.max(2, lugar.altura * 0.05)}
              />
              <rect
                x={-lugar.largura / 2}
                y={lugar.altura / 2 - alturaBase}
                width={lugar.largura}
                height={alturaBase}
                fill={cores.contorno}
                clipPath={recorte ? `url(#${recorte.id})` : undefined}
              />
              <text
                x={0}
                y={-0.115 * lugar.altura}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontFamily: FONTE }}
                fontSize={0.5 * lugar.altura}
                fontWeight={600}
                fill={cores.numero}
                pointerEvents="none"
              >
                {lugar.numero}
              </text>
              {destacados?.has(lugar.id) ? (
                <rect
                  data-destaque
                  x={-lugar.largura / 2 - lugar.altura * 0.12}
                  y={-lugar.altura / 2 - lugar.altura * 0.12}
                  width={lugar.largura + lugar.altura * 0.24}
                  height={lugar.altura * 1.24}
                  rx={0.34 * lugar.altura}
                  fill="none"
                  stroke={COR_DESTAQUE}
                  strokeWidth={Math.max(3, lugar.altura * 0.07)}
                  strokeDasharray={`${lugar.altura * 0.2} ${lugar.altura * 0.14}`}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
