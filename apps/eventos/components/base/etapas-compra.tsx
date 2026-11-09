import React from "react";

export function EtapasCompra({ atual }: { atual: 1 | 2 | 3 }): React.JSX.Element {
  const etapas = ["Lugares", "Seus dados", "Pagamento"] as const;
  return <nav aria-label="Etapas da compra" className="rounded-2xl border border-[#e6e9e1] bg-white px-4 py-3">
    <ol className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#647066]">
      {etapas.map((etapa, index) => {
        const numero = (index + 1) as 1 | 2 | 3;
        return <React.Fragment key={etapa}>
          {index > 0 && <li aria-hidden="true" className="text-[#b1b9ac]">·</li>}
          <li className={numero === atual ? "text-[#3f6f12]" : numero < atual ? "text-[#3f6f12]" : ""} aria-current={numero === atual ? "step" : undefined}>{numero < atual ? "✓ " : `${numero} `}{etapa}</li>
        </React.Fragment>;
      })}
    </ol>
  </nav>;
}
