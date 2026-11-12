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
  const [destino, setDestino] = useState("");
  const [origens, setOrigens] = useState("");
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

  async function atualizar(operacao: () => Promise<ConvidadosPorAluna>): Promise<void> {
    setSalvando(true);
    try {
      setDados(await operacao());
      setErro(null);
    } catch (reason) {
      setErro(reason instanceof Error ? reason.message : "Não foi possível atualizar a contagem de alunas convidadas.");
    } finally { setSalvando(false); }
  }

  async function juntar(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nomeDestino = destino.trim();
    const nomesOrigens = origens.split(",").map((nome) => nome.trim()).filter(Boolean);
    if (!nomeDestino || nomesOrigens.length === 0) {
      setErro("Informe o nome principal e pelo menos uma outra grafia.");
      return;
    }
    await atualizar(() => juntarAlunas(eventId, { destino: nomeDestino, origens: nomesOrigens }));
    setOrigens("");
  }

  function grupo(aluna: AlunaConvidados): React.JSX.Element {
    return (
      <article key={aluna.chave} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">{aluna.nome}</h3>
            <p className="text-sm text-slate-600">{pluralizar(aluna.total, "convidado pagante", "convidados pagantes")}</p>
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
              {aluna.ingressos.map((ingresso) => <li key={ingresso.numero}>{ingresso.numero} · {ingresso.participantName} · lugar {ingresso.rowLabel}{ingresso.seatNumber}</li>)}
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
      <form onSubmit={(event) => void juntar(event)} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5" aria-labelledby="juntar-heading">
        <div><h2 id="juntar-heading" className="font-semibold text-slate-900">Juntar grafias da mesma aluna</h2><p className="text-sm text-slate-600">Use vírgulas para informar mais de uma grafia. A contagem original continua registrada.</p></div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">Nome principal<input aria-label="Nome principal" value={destino} onChange={(event) => setDestino(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3" maxLength={200} /></label>
          <label className="text-sm font-medium text-slate-700">Outras grafias<input aria-label="Outras grafias" value={origens} onChange={(event) => setOrigens(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3" placeholder="Bia, Beatriz O. Santos" maxLength={1000} /></label>
          <button type="submit" disabled={salvando} className="min-h-10 rounded-lg bg-[#3f6f12] px-4 font-semibold text-white disabled:opacity-60">Juntar nomes</button>
        </div>
      </form>
      {dados.alunas.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Nenhum convidado pagante com aluna identificada.</p> : <div className="space-y-3">{dados.alunas.map(grupo)}</div>}
    </section>
  );
}
