"use client";

import React, { useEffect, useState } from "react";
import {
  acessoExternoEfetivo,
  CATEGORIAS_LUGAR,
  ROTULO_CATEGORIA,
  type CategoriaLugar,
  type LugarProposto,
  type OperacaoProposta,
  type PropostaMapa,
} from "@essencia/shared/eventos/mapa-proposta";

interface PainelLugarProps {
  proposta: PropostaMapa;
  selecionados: LugarProposto[];
  aplicar: (operacoes: OperacaoProposta[]) => void;
}

function CampoTexto({ rotulo, valor, onSalvar }: { rotulo: string; valor: string; onSalvar: (novo: string) => void }) {
  const [rascunho, setRascunho] = useState(valor);
  useEffect(() => setRascunho(valor), [valor]);
  const salvar = () => {
    if (rascunho !== valor) onSalvar(rascunho);
  };
  return (
    <label className="block flex-1 text-xs text-[#69736e]">
      {rotulo}
      <input
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") salvar();
        }}
        className="mt-1 block w-full rounded-lg border border-[#e5e8df] bg-white px-2 py-1 text-sm text-[#24302c]"
      />
    </label>
  );
}

export function PainelLugar({ proposta, selecionados, aplicar }: PainelLugarProps) {
  if (selecionados.length === 0) {
    return <p className="text-sm text-[#69736e]">Clique num lugar do mapa para editar. Shift+clique soma à seleção.</p>;
  }

  const unico = selecionados.length === 1 ? selecionados[0] : null;
  const paraTodos = (alteracao: Omit<Extract<OperacaoProposta, { tipo: "EDITAR_LUGAR" }>, "tipo" | "lugarId">) =>
    aplicar(selecionados.map((lugar) => ({ tipo: "EDITAR_LUGAR", lugarId: lugar.id, ...alteracao })));

  const categoriaComum = selecionados.every((l) => l.categoriaManual === selecionados[0]?.categoriaManual)
    ? (selecionados[0]?.categoriaManual ?? "")
    : "";
  const todosNaoVender = selecionados.every((l) => !l.vender);
  const todosAcessoExterno = selecionados.every((l) => acessoExternoEfetivo(proposta, l));

  return (
    <section aria-label="Lugar selecionado" className="space-y-3 rounded-xl border border-[#e5e8df] bg-white p-3">
      <h2 className="font-[family-name:var(--font-display,Outfit),system-ui,sans-serif] text-sm font-bold text-[#24302c]">
        {unico ? "Lugar selecionado" : `${selecionados.length} lugares selecionados`}
      </h2>
      {unico ? (
        <div className="flex gap-2">
          <CampoTexto rotulo="Fileira" valor={unico.fileira} onSalvar={(fileira) => aplicar([{ tipo: "EDITAR_LUGAR", lugarId: unico.id, fileira }])} />
          <CampoTexto rotulo="Número" valor={unico.numero} onSalvar={(numero) => aplicar([{ tipo: "EDITAR_LUGAR", lugarId: unico.id, numero }])} />
        </div>
      ) : null}
      <label className="block text-xs text-[#69736e]">
        Categoria
        <select
          value={categoriaComum}
          onChange={(e) => paraTodos({ categoria: (e.target.value || null) as CategoriaLugar | null })}
          className="mt-1 block w-full rounded-lg border border-[#e5e8df] bg-white px-2 py-1 text-sm text-[#24302c]"
        >
          <option value="">Seguir a legenda</option>
          {CATEGORIAS_LUGAR.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-[#24302c]">
        <input type="checkbox" checked={todosAcessoExterno} onChange={() => paraTodos({ acessoExterno: !todosAcessoExterno })} />
        Acesso externo
      </label>
      <label className="flex items-center gap-2 text-sm text-[#24302c]">
        <input type="checkbox" checked={todosNaoVender} onChange={() => paraTodos({ vender: todosNaoVender })} />
        Não vender
      </label>
      <button
        type="button"
        onClick={() => {
          const texto = unico ? "Excluir este lugar?" : `Excluir ${selecionados.length} lugares?`;
          if (window.confirm(texto)) aplicar(selecionados.map((l) => ({ tipo: "EXCLUIR_LUGAR", lugarId: l.id })));
        }}
        className="rounded-lg border border-[#e5c0b8] px-3 py-1 text-xs font-semibold text-[#9a3a28]"
      >
        Excluir lugar
      </button>
    </section>
  );
}
