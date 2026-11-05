"use client";

import { DM_Sans, Outfit } from "next/font/google";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";

import {
  carregarRevisao,
  editarVersao,
  ErroApiMapa,
  excluirVersao,
  importarPlanta,
  listarMapas,
  publicarMapa,
  type TravaMapa,
  type VersaoMapaResumo,
} from "../../../../features/eventos/conferencia/api-mapas";
import { ConferenciaMapa } from "../../../../features/eventos/conferencia/conferencia-mapa";
import { VersoesMapa } from "../../../../features/eventos/conferencia/versoes-mapa";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const BOTAO_PRIMARIO = "rounded-xl bg-[#a3d154] px-4 py-2 text-sm font-semibold text-[#24302c] disabled:opacity-50";

type Vista = { tipo: "carregando" } | { tipo: "lista" } | { tipo: "em-revisao"; mapId: string; proposta: PropostaMapa; trava: TravaMapa };
type ResumoPublicacao = { versao: number; sessoes: number; capacidade: number | null };

function mensagemErro(error: unknown, padrao: string) {
  return error instanceof Error && error.message ? error.message : padrao;
}

function eTrava(error: unknown) {
  return error instanceof ErroApiMapa && ["VENDA_CONFIRMADA", "COMPRA_EM_ANDAMENTO", "OPERACAO_ATIVA"].includes(error.code ?? "");
}

function CampoArquivo({ rotulo, desabilitado, aoEscolher }: { rotulo: string; desabilitado: boolean; aoEscolher: (arquivo: File) => void }) {
  return (
    <label className="block text-sm text-[#69736e]">
      {rotulo}
      <input type="file" accept="application/pdf" aria-label={rotulo} disabled={desabilitado} className="mt-1 block text-sm text-[#24302c]" onChange={(evento) => {
        const arquivo = evento.target.files?.[0];
        evento.target.value = "";
        if (arquivo) aoEscolher(arquivo);
      }} />
    </label>
  );
}

export default function MapaPage() {
  const { id } = useParams<{ id: string }>();
  const [vista, setVista] = useState<Vista>({ tipo: "carregando" });
  const [versoes, setVersoes] = useState<VersaoMapaResumo[]>([]);
  const [trava, setTrava] = useState<TravaMapa>({ tipo: "LIVRE", mensagem: null });
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [escolhaPagina, setEscolhaPagina] = useState<{ arquivo: File; paginas: number; pagina: number } | null>(null);
  const [resumo, setResumo] = useState<ResumoPublicacao | null>(null);
  const carregandoRef = useRef(false);

  const carregarLista = useCallback(async (abrirRevisao: boolean): Promise<{ versoes: VersaoMapaResumo[]; trava: TravaMapa }> => {
    const data = await listarMapas(id);
    setVersoes(data.versoes);
    setTrava(data.trava);
    if (abrirRevisao) {
      const emRevisao = data.versoes.find((versao) => versao.status === "EM_REVISAO");
      if (emRevisao) {
        const revisao = await carregarRevisao(id, emRevisao.id);
        if (revisao.proposta) {
          setVista({ tipo: "em-revisao", mapId: emRevisao.id, proposta: revisao.proposta, trava: data.trava });
          return data;
        }
      }
    }
    setVista({ tipo: "lista" });
    return data;
  }, [id]);

  useEffect(() => {
    let ativo = true;
    void carregarLista(true).catch((erro) => { if (ativo) { setError(mensagemErro(erro, "Falha ao carregar as versões do mapa.")); setVista({ tipo: "lista" }); } });
    return () => { ativo = false; };
  }, [carregarLista]);

  const recarregarDepoisDeTrava = async (erro: unknown) => {
    if (!eTrava(erro)) return;
    setError(mensagemErro(erro, "A operação está bloqueada."));
    try { await carregarLista(true); } catch { /* mantém a mensagem original */ }
  };

  const enviarPlanta = async (arquivo: File, pagina?: number) => {
    if (carregandoRef.current) return;
    carregandoRef.current = true;
    setOcupado(true);
    setError("");
    try {
      let mapId: string;
      try { ({ mapId } = await importarPlanta(id, arquivo, pagina)); }
      catch (erro) {
        const paginas = erro instanceof ErroApiMapa && erro.code === "PDF_PAGINA_OBRIGATORIA" ? Number(erro.details?.paginas) : NaN;
        if (Number.isInteger(paginas) && paginas > 1) {
          try { await carregarLista(false); } catch { /* mantém a resposta original */ }
          setEscolhaPagina({ arquivo, paginas, pagina: 1 }); return;
        }
        await recarregarDepoisDeTrava(erro);
        throw erro;
      }
      const revisao = await carregarRevisao(id, mapId);
      if (!revisao.proposta) throw new Error("A planta enviada não gerou uma proposta de mapa.");
      setEscolhaPagina(null);
      setVista({ tipo: "em-revisao", mapId, proposta: revisao.proposta, trava });
    } finally { carregandoRef.current = false; setOcupado(false); }
  };

  const editar = async (mapId: string) => {
    setError(""); setOcupado(true);
    try {
      const resultado = await editarVersao(id, mapId);
      const revisao = await carregarRevisao(id, resultado.mapId);
      if (!revisao.proposta) throw new Error("A versão editada não tem proposta de mapa.");
      setVista({ tipo: "em-revisao", mapId: resultado.mapId, proposta: revisao.proposta, trava });
    } catch (erro) { await recarregarDepoisDeTrava(erro); if (!eTrava(erro)) setError(mensagemErro(erro, "Falha ao editar a versão.")); }
    finally { setOcupado(false); }
  };

  const excluir = async (mapId: string) => {
    const versao = versoes.find((item) => item.id === mapId);
    if (!versao || !window.confirm(`Excluir a versão ${versao.version}? Esta ação não pode ser desfeita.`)) return;
    setError(""); setOcupado(true);
    try { await excluirVersao(id, mapId); await carregarLista(false); }
    catch (erro) { await recarregarDepoisDeTrava(erro); if (!eTrava(erro)) setError(mensagemErro(erro, "Falha ao excluir a versão.")); }
    finally { setOcupado(false); }
  };

  const publicar = async (mapId: string, revisaoBase: number, motivo?: string) => {
    setError("");
    try {
      const resultado = await publicarMapa(id, mapId, revisaoBase, motivo);
      const listaAtualizada = await carregarLista(false);
      const versao = listaAtualizada.versoes.find((item) => item.id === mapId);
      if (!versao) throw new Error("A versão publicada não foi encontrada na lista atualizada.");
      setResumo({ versao: versao.version, sessoes: resultado.sessionIds.length, capacidade: resultado.capacidade });
    } catch (erro) { await recarregarDepoisDeTrava(erro); throw erro; }
  };

  const alerta = error ? <p role="alert" className="text-sm text-[#9a3a28]">{error}</p> : null;
  const seletorPagina = escolhaPagina ? (
    <div className="space-y-2 rounded-xl border border-[#e5e8df] bg-white p-3">
      <p className="text-sm font-semibold">Escolha a página da planta</p>
      <label className="block text-sm text-[#69736e]">Página da planta <select aria-label="Página da planta" value={escolhaPagina.pagina} onChange={(evento) => setEscolhaPagina({ ...escolhaPagina, pagina: Number(evento.target.value) })} className="ml-2 rounded-lg border border-[#e5e8df] px-2 py-1 text-sm">{Array.from({ length: escolhaPagina.paginas }, (_, indice) => <option key={indice + 1} value={indice + 1}>{indice + 1}</option>)}</select></label>
      <button type="button" disabled={ocupado || trava.tipo !== "LIVRE"} onClick={() => void enviarPlanta(escolhaPagina.arquivo, escolhaPagina.pagina)} className={BOTAO_PRIMARIO}>Enviar página escolhida</button>
    </div>
  ) : null;

  let conteudo: React.ReactNode;
  if (vista.tipo === "carregando") conteudo = <p role="status" className="p-5 text-sm text-[#69736e]">Carregando as versões do mapa…</p>;
  else if (vista.tipo === "em-revisao") conteudo = <ConferenciaMapa key={vista.mapId} eventoId={id} mapId={vista.mapId} propostaInicial={vista.proposta} trava={vista.trava} onPublicar={(revisaoBase, motivo) => publicar(vista.mapId, revisaoBase, motivo)} onReenviar={(arquivo) => enviarPlanta(arquivo)} />;
  else conteudo = (
    <div className="space-y-4 p-5">
      <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">Mapa de lugares</h1>
      {alerta}
      {resumo ? <p role="status" className="text-emerald-700">Publicado: {resumo.sessoes} sessão(ões) levada(s) para a versão {resumo.versao}. Capacidade: {resumo.capacidade === null ? "sem limite" : `${resumo.capacidade} lugares`}.</p> : null}
      <VersoesMapa versoes={versoes} trava={trava} ocupado={ocupado} onEditar={(mapId) => void editar(mapId)} onExcluir={(mapId) => void excluir(mapId)} />
      {seletorPagina}
      <CampoArquivo rotulo={versoes.length > 0 ? "Enviar nova planta" : "Enviar planta em PDF"} desabilitado={ocupado || trava.tipo !== "LIVRE"} aoEscolher={(arquivo) => void enviarPlanta(arquivo).catch((erro) => { if (!eTrava(erro)) setError(mensagemErro(erro, "Falha ao enviar a planta.")); })} />
      {ocupado ? <p className="text-xs text-[#69736e]">Processando…</p> : null}
    </div>
  );

  return <section className={`${outfit.variable} ${dmSans.variable} min-h-screen bg-[#fffdf8] font-[family-name:var(--font-body)] text-[#24302c]`}>{conteudo}</section>;
}
