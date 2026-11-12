"use client";

import { useEffect, useState } from "react";
import type { AlunaConvidados, ConvidadosPorAluna } from "@essencia/shared/types";
import { juntarAlunas, listarAlunas, separarAluna } from "./api-alunas";

function pluralizar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

function mensagemSemAluna(quantidade: number): string {
  return `${pluralizar(quantidade, "ingresso", "ingressos")} sem aluna informada`;
}

export function PainelAlunas({ eventId }: { eventId: string }): React.JSX.Element {
  const [dados, setDados] = useState<ConvidadosPorAluna | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Chaves das alunas marcadas para juntar e o nome principal escolhido à mão.
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [principalEscolhida, setPrincipalEscolhida] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<"total" | "nome">("total");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    void listarAlunas(eventId)
      .then((resultado) => { if (ativo) { setDados(resultado); setErro(null); } })
      .catch(() => { if (ativo) setErro("Não foi possível carregar a contagem de alunas convidadas."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [eventId]);

  async function atualizar(operacao: () => Promise<ConvidadosPorAluna>): Promise<boolean> {
    setSalvando(true);
    try {
      setDados(await operacao());
      setErro(null);
      return true;
    } catch (reason) {
      setErro(reason instanceof Error ? reason.message : "Não foi possível atualizar a contagem de alunas convidadas.");
      return false;
    } finally { setSalvando(false); }
  }

  // A lista vem ordenada por convidados, então a primeira marcada é a de maior contagem.
  const marcadas = (dados?.alunas ?? []).filter((aluna) => selecionadas.includes(aluna.chave));
  const principal = marcadas.find((aluna) => aluna.chave === principalEscolhida) ?? marcadas[0];

  function limparSelecao(): void {
    setSelecionadas([]);
    setPrincipalEscolhida(null);
  }

  function alternar(chave: string): void {
    setSelecionadas((atuais) => (atuais.includes(chave) ? atuais.filter((atual) => atual !== chave) : [...atuais, chave]));
  }

  async function juntar(): Promise<void> {
    if (!principal || marcadas.length < 2) return;
    const origens = marcadas.filter((aluna) => aluna.chave !== principal.chave).map((aluna) => aluna.chave);
    if (await atualizar(() => juntarAlunas(eventId, { destino: principal.chave, origens }))) limparSelecao();
  }

  function grupo(aluna: AlunaConvidados): React.JSX.Element {
    return (
      <article key={aluna.chave} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <input type="checkbox" aria-label={`Selecionar ${aluna.nome}`} checked={selecionadas.includes(aluna.chave)} onChange={() => alternar(aluna.chave)} className="mt-1.5 h-4 w-4" />
            <div>
              <h3 className="text-lg font-semibold text-slate-950">{aluna.nome}</h3>
              <p className="text-sm text-slate-600">{pluralizar(aluna.total, "convidado pagante", "convidados pagantes")}</p>
            </div>
          </div>
          <span className="rounded-full bg-[#eaf3e8] px-3 py-1 text-sm font-semibold text-[#245432]">{aluna.total}</span>
        </div>
        {aluna.grafias.length > 1 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grafias agrupadas</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {aluna.grafias.map((grafia) => (
                <li key={grafia.chave} className="flex items-center justify-between gap-3">
                  <span>{grafia.nome} · {pluralizar(grafia.total, "ingresso", "ingressos")}</span>
                  {grafia.juntada && <button type="button" disabled={salvando} className="text-xs font-semibold text-[#245432] underline disabled:opacity-50" onClick={() => void atualizar(() => separarAluna(eventId, grafia.chave))}>Separar {grafia.nome}</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {aluna.ingressos.length > 0 && (
          <details className="mt-4 border-t border-slate-100 pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Ver ingressos</summary>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {aluna.ingressos.map((ingresso) => <li key={ingresso.numero}>{[ingresso.numero, ingresso.participantName, `lugar ${ingresso.rowLabel}${ingresso.seatNumber}`, ingresso.buyerName ? `comprado por ${ingresso.buyerName}` : "", `pedido ${ingresso.orderNumber}`].filter(Boolean).join(" · ")}</li>)}
            </ul>
          </details>
        )}
      </article>
    );
  }

  if (carregando) return <p role="status">Carregando contagem…</p>;
  if (erro && !dados) return <p role="alert">{erro}</p>;
  if (!dados) return <p role="alert">Não foi possível carregar a contagem de alunas convidadas.</p>;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">Alunas convidadas</h1>
        <p className="mt-1 text-sm text-slate-600">Confira os convidados pagantes atribuídos a cada aluna e ajuste grafias antes de apurar o prêmio.</p>
      </header>
      {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#dbe5d8] bg-[#f8fbf7] p-4"><p className="text-sm text-slate-600">Total pagantes</p><p className="mt-1 text-2xl font-semibold text-[#245432]">{dados.totalPagantes}</p></div>
        <div className="rounded-xl border border-[#dbe5d8] bg-[#f8fbf7] p-4"><p className="text-sm text-slate-600">Alunas identificadas</p><p className="mt-1 text-2xl font-semibold text-[#245432]">{dados.alunas.length}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">Sem identificação</p><p className="mt-1 text-2xl font-semibold text-amber-900">{dados.semAluna}</p></div>
      </div>
      {dados.semAluna > 0 && <p className="text-sm text-amber-800">{mensagemSemAluna(dados.semAluna)}. Eles não entram na contagem de nenhuma aluna.</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-600">Marque as alunas que são a mesma pessoa escrita de formas diferentes para juntar a contagem.</p>
        <label className="text-sm font-medium text-slate-700">Ordenar por<select aria-label="Ordenar por" value={ordem} onChange={(event) => setOrdem(event.target.value === "nome" ? "nome" : "total")} className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3"><option value="total">Mais convidados</option><option value="nome">Nome (A a Z)</option></select></label>
      </div>
      {marcadas.length >= 2 && principal && (
        <div className="sticky top-2 z-10 space-y-3 rounded-xl border border-[#b9d3b1] bg-[#f1f8ee] p-5 shadow-sm">
          <fieldset>
            <legend className="font-semibold text-slate-900">Qual nome fica como principal?</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {marcadas.map((aluna) => <label key={aluna.chave} className="flex items-center gap-2 text-sm text-slate-800"><input type="radio" name="nome-principal" checked={aluna.chave === principal.chave} onChange={() => setPrincipalEscolhida(aluna.chave)} />{aluna.nome}</label>)}
            </div>
          </fieldset>
          <p className="text-sm text-slate-600">Os convidados das outras passam a contar para ela. Dá para separar depois.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={salvando} onClick={() => void juntar()} className="min-h-10 rounded-lg bg-[#3f6f12] px-4 font-semibold text-white disabled:opacity-60">Juntar {marcadas.length} nomes</button>
            <button type="button" disabled={salvando} onClick={limparSelecao} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 disabled:opacity-60">Limpar seleção</button>
          </div>
        </div>
      )}
      {dados.alunas.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Nenhum convidado pagante com aluna identificada.</p> : <div className="space-y-3">{(ordem === "nome" ? [...dados.alunas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : dados.alunas).map(grupo)}</div>}
    </section>
  );
}
