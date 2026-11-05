"use client";

import React, { useEffect, useState } from "react";
import {
  CATEGORIAS_LUGAR,
  ROTULO_CATEGORIA,
  type CategoriaLugar,
  type EntradaLegenda,
} from "@essencia/shared/eventos/mapa-proposta";

interface LegendaCoresProps {
  legenda: EntradaLegenda[];
  /** Quantidade atual de lugares de cada cor (não a da geração). */
  contagens: Record<string, number>;
  onConfirmar: (cor: string, categoria: CategoriaLugar, acessoExterno: boolean) => void;
  disabled?: boolean;
}

function ItemLegenda({
  entrada,
  quantidade,
  onConfirmar,
  disabled = false,
}: {
  entrada: EntradaLegenda;
  quantidade: number;
  onConfirmar: LegendaCoresProps["onConfirmar"];
  disabled?: boolean;
}) {
  const [categoria, setCategoria] = useState<CategoriaLugar | "">(entrada.categoria ?? "");
  const [acessoExterno, setAcessoExterno] = useState(entrada.acessoExterno);
  useEffect(() => {
    setCategoria(entrada.categoria ?? "");
    setAcessoExterno(entrada.acessoExterno);
  }, [entrada.categoria, entrada.acessoExterno]);

  return (
    <li aria-label={`Cor ${entrada.cor}`} className="space-y-2 rounded-xl border border-[#e5e8df] bg-white p-3 text-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 shrink-0 rounded border border-[#c9cdc6]"
          style={{ backgroundColor: entrada.cor }}
        />
        <span className="min-w-0 flex-1 text-[#24302c]">{entrada.texto ?? "Sem legenda na planta"}</span>
        <span className="text-xs text-[#69736e]">{quantidade === 1 ? "1 lugar" : `${quantidade} lugares`}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Categoria da cor ${entrada.cor}`}
          value={categoria}
          disabled={disabled}
          onChange={(e) => setCategoria(e.target.value as CategoriaLugar | "")}
          className="rounded-lg border border-[#e5e8df] bg-white px-2 py-1 text-xs"
        >
          <option value="">Escolha a categoria</option>
          {CATEGORIAS_LUGAR.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-[#69736e]">
          <input
            type="checkbox"
            disabled={disabled}
            aria-label={`Acesso externo da cor ${entrada.cor}`}
            checked={acessoExterno}
            onChange={(e) => setAcessoExterno(e.target.checked)}
          />
          Acesso externo
        </label>
        <button
          type="button"
          disabled={disabled || categoria === ""}
          onClick={() => categoria !== "" && onConfirmar(entrada.cor, categoria, acessoExterno)}
          className="rounded-lg bg-[#a3d154] px-3 py-1 text-xs font-semibold text-[#24302c] disabled:opacity-50"
        >
          Confirmar
        </button>
        {entrada.confirmada ? <span className="text-xs text-[#4d6a17]">✓ confirmada</span> : null}
      </div>
    </li>
  );
}

export function LegendaCores({ legenda, contagens, onConfirmar, disabled = false }: LegendaCoresProps) {
  if (legenda.length === 0) return null;
  return (
    <section aria-label="Legenda de cores" className="space-y-2">
      <h2 className="font-[family-name:var(--font-display,Outfit),system-ui,sans-serif] text-sm font-bold text-[#24302c]">Legenda de cores</h2>
      <ul className="space-y-2">
        {legenda.map((entrada) => (
          <ItemLegenda key={entrada.cor} entrada={entrada} quantidade={contagens[entrada.cor] ?? 0} onConfirmar={onConfirmar} disabled={disabled} />
        ))}
      </ul>
    </section>
  );
}
