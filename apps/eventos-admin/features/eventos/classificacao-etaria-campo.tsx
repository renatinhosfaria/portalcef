"use client";

import { useEffect, useState } from "react";
import { CLASSIFICACOES_ETARIAS, type ClassificacaoEtaria } from "@essencia/shared/eventos/ingresso";
import { assertRespostaApi } from "./etapas-contratos";

type Props = {
  eventId: string;
  valor: ClassificacaoEtaria | null;
  updatedAt?: string;
  aoSalvar: (valor: ClassificacaoEtaria | null, updatedAt: string | undefined) => void;
};

function rotulo(classificacao: ClassificacaoEtaria): string {
  return classificacao === "LIVRE" ? "Livre" : `${classificacao} anos`;
}

/**
 * Salva sozinho, pela rota própria: a classificação vai impressa no ingresso e
 * precisa poder mudar mesmo com o evento publicado e com vendas.
 */
export function ClassificacaoEtariaCampo({ eventId, valor, updatedAt, aoSalvar }: Props) {
  const [atual, setAtual] = useState<ClassificacaoEtaria | null>(valor);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const [erro, setErro] = useState("");

  useEffect(() => setAtual(valor), [valor]);

  async function salvar(proximo: ClassificacaoEtaria | null) {
    const anterior = atual;
    setAtual(proximo);
    setEstado("salvando");
    setErro("");
    try {
      const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}/classificacao-etaria`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classificacaoEtaria: proximo, ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      assertRespostaApi({ ok: response.ok, status: response.status, body });
      const data = (body as { data?: { classificacaoEtaria?: ClassificacaoEtaria | null; updatedAt?: string } }).data ?? {};
      setEstado("salvo");
      aoSalvar(data.classificacaoEtaria ?? null, data.updatedAt);
    } catch (falha) {
      setAtual(anterior);
      setEstado("parado");
      setErro(falha instanceof Error && falha.message ? falha.message : "Não foi possível salvar a classificação.");
    }
  }

  return (
    <label className="space-y-1 text-sm">
      <span>Classificação indicativa</span>
      <select
        aria-label="Classificação indicativa"
        value={atual ?? ""}
        disabled={estado === "salvando"}
        onChange={(event) => void salvar((event.target.value || null) as ClassificacaoEtaria | null)}
        className="w-full rounded border bg-white p-2"
      >
        <option value="">Não informada</option>
        {CLASSIFICACOES_ETARIAS.map((classificacao) => <option key={classificacao} value={classificacao}>{rotulo(classificacao)}</option>)}
      </select>
      <span className="block text-slate-500">Impressa no ingresso e na cortesia. Pode ser ajustada com as vendas abertas.</span>
      {estado === "salvo" && <span role="status" className="block text-green-700">Classificação salva.</span>}
      {erro && <span role="alert" className="block text-red-700">{erro}</span>}
    </label>
  );
}
