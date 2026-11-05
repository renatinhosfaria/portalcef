"use client";

import React, { useMemo, useRef, useState } from "react";
import { MapaEstiloB } from "@essencia/components/eventos/mapa-estilo-b";
import {
  pendenciasPublicacao,
  resumoProposta,
  type PontoConferir,
  type PropostaMapa,
} from "@essencia/shared/eventos/mapa-proposta";
import { urlOriginal, type TravaMapa } from "./api-mapas";
import { LegendaCores } from "./legenda-cores";
import { ListaPontos } from "./lista-pontos";
import { paraLugaresMapa } from "./lugares-mapa";
import { PainelLugar } from "./painel-lugar";
import { PlantaPdf } from "./planta-pdf";
import { ResumoProposta } from "./resumo-proposta";
import { useProposta } from "./use-proposta";

export interface ConferenciaMapaProps {
  eventoId: string;
  mapId: string;
  propostaInicial: PropostaMapa;
  trava?: TravaMapa;
  onPublicar: (revisaoBase: number, motivo?: string) => Promise<void>;
  onReenviar: (arquivo: File) => Promise<void>;
}

type Modo = "LADO_A_LADO" | "SOBREPOR";
interface Foco {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

const ETAPAS = ["Enviar planta", "Conferir", "Publicar"];
const BOTAO_PRIMARIO = "rounded-xl bg-[#a3d154] px-4 py-2 text-sm font-semibold text-[#24302c] disabled:opacity-50";
const BOTAO_SECUNDARIO = "rounded-xl border border-[#e5e8df] bg-white px-4 py-2 text-sm text-[#24302c]";

export function ConferenciaMapa({ eventoId, mapId, propostaInicial, trava, onPublicar, onReenviar }: ConferenciaMapaProps) {
  const { proposta, aplicar, salvando, recarregando, erro } = useProposta(eventoId, mapId, propostaInicial);
  const [modo, setModo] = useState<Modo>("LADO_A_LADO");
  const [selecionadosIds, setSelecionadosIds] = useState<ReadonlySet<string>>(new Set());
  const [pontoAtivoId, setPontoAtivoId] = useState<string | null>(null);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [armado, setArmado] = useState(false);
  const [novoLugar, setNovoLugar] = useState<{ x: number; y: number; fileira: string; numero: string } | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [publicando, setPublicando] = useState(false);
  const publicandoRef = useRef(false);
  const [erroPublicar, setErroPublicar] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const reenviandoRef = useRef(false);
  const [erroReenviar, setErroReenviar] = useState<string | null>(null);
  const bloqueadoPorTrava = trava?.tipo !== undefined && trava.tipo !== "LIVRE";

  const lugaresMapa = useMemo(() => paraLugaresMapa(proposta), [proposta]);
  const resumo = useMemo(() => resumoProposta(proposta), [proposta]);
  const pendencias = useMemo(() => pendenciasPublicacao(proposta), [proposta]);
  const contagens = useMemo(() => {
    const total: Record<string, number> = {};
    for (const lugar of proposta.lugares) total[lugar.cor] = (total[lugar.cor] ?? 0) + 1;
    return total;
  }, [proposta.lugares]);
  const destacados = useMemo(
    () => new Set(proposta.pontos.filter((p) => !p.conferido).flatMap((p) => p.lugarIds)),
    [proposta.pontos],
  );
  // Lugares excluídos saem da seleção sem precisar de efeito.
  const selecionados = useMemo(
    () => Array.from(selecionadosIds)
      .map((id) => proposta.lugares.find((lugar) => lugar.id === id))
      .filter((lugar): lugar is (typeof proposta.lugares)[number] => lugar !== undefined),
    [proposta.lugares, selecionadosIds],
  );
  const selecionadosSet = useMemo(() => new Set(selecionados.map((l) => l.id)), [selecionados]);

  const { largura, altura } = proposta.pagina;
  const sobrepor = modo === "SOBREPOR";
  const planta = <PlantaPdf url={urlOriginal(eventoId, mapId)} pagina={proposta.pagina.numero} largura={largura} altura={altura} />;

  function aoClicarNoLugar(id: string, { shiftKey }: { shiftKey: boolean }) {
    setPontoAtivoId(null);
    setSelecionadosIds((atual) => {
      if (!shiftKey) return new Set([id]);
      const proximo = new Set(atual);
      if (!proximo.delete(id)) proximo.add(id);
      return proximo;
    });
  }

  function selecionarPonto(ponto: PontoConferir) {
    setPontoAtivoId(ponto.id);
    setSelecionadosIds(new Set(ponto.lugarIds));
    const alvo = lugaresMapa.filter((l) => ponto.lugarIds.includes(l.id));
    if (alvo.length === 0) return;
    const minX = Math.min(...alvo.map((l) => l.x - l.largura / 2));
    const maxX = Math.max(...alvo.map((l) => l.x + l.largura / 2));
    const minY = Math.min(...alvo.map((l) => l.y - l.altura / 2));
    const maxY = Math.max(...alvo.map((l) => l.y + l.altura / 2));
    setFoco({ x: minX, y: minY, largura: maxX - minX, altura: maxY - minY });
  }

  function selecionarFileira(fileira: string) {
    setPontoAtivoId(null);
    setSelecionadosIds(new Set(proposta.lugares.filter((lugar) => lugar.fileira === fileira).map((lugar) => lugar.id)));
  }

  function selecionarPendencia(tipo: (typeof pendencias)[number]) {
    if (tipo.tipo === "PONTO_NAO_CONFERIDO") {
      const ponto = proposta.pontos.find(
        (item) => !item.conferido && item.mensagem === tipo.mensagem && item.lugarIds.length === tipo.lugarIds.length && item.lugarIds.every((id) => tipo.lugarIds.includes(id)),
      );
      if (ponto) selecionarPonto(ponto);
      return;
    }

    if (tipo.tipo === "COR_NAO_CONFIRMADA") {
      const lugar = proposta.lugares.find((item) => tipo.lugarIds.includes(item.id));
      const entrada = lugar ? proposta.legenda.find((item) => item.cor === lugar.cor) : undefined;
      const item = entrada
        ? Array.from(document.querySelectorAll<HTMLElement>("[aria-label^='Cor ']")).find((elemento) => elemento.getAttribute("aria-label") === `Cor ${entrada.cor}`)
        : undefined;
      item?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      item?.querySelector<HTMLElement>("select")?.focus();
      return;
    }

    setPontoAtivoId(null);
    setSelecionadosIds(new Set(tipo.lugarIds));
  }

  function mudarModo(novo: Modo) {
    setModo(novo);
    if (novo !== "SOBREPOR") {
      setArmado(false);
      setNovoLugar(null);
    }
  }

  const novoLugarCompleto = novoLugar !== null && novoLugar.fileira.trim() !== "" && novoLugar.numero.trim() !== "";

  function adicionarLugar(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueadoPorTrava || !novoLugar || !novoLugarCompleto) return;
    aplicar([
      {
        tipo: "ADICIONAR_LUGAR",
        lugar: { id: crypto.randomUUID(), fileira: novoLugar.fileira.trim(), numero: novoLugar.numero.trim(), x: novoLugar.x, y: novoLugar.y },
      },
    ]);
    setNovoLugar(null);
  }

  async function publicar() {
    if (publicandoRef.current) return;
    publicandoRef.current = true;
    setPublicando(true);
    setErroPublicar(null);
    try {
      await onPublicar(proposta.revisao, motivo.trim() || undefined);
      setDialogoAberto(false);
    } catch (e) {
      setErroPublicar(e instanceof Error ? e.message : "Não foi possível publicar o mapa.");
    } finally {
      publicandoRef.current = false;
      setPublicando(false);
    }
  }

  async function reenviar(arquivo: File) {
    if (reenviandoRef.current) return;
    reenviandoRef.current = true;
    setReenviando(true);
    setErroReenviar(null);
    try {
      await onReenviar(arquivo);
    } catch (e) {
      setErroReenviar(e instanceof Error ? e.message : "Não foi possível enviar a nova planta.");
    } finally {
      reenviandoRef.current = false;
      setReenviando(false);
    }
  }

  function pedirOutraPlanta() {
    if (window.confirm("A conferência atual será descartada. Deseja enviar outra planta?")) arquivoRef.current?.click();
  }

  return (
    <div className="min-h-screen bg-[#fffdf8] font-[family-name:var(--font-body,DM_Sans),system-ui,sans-serif] text-[#24302c]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e8df] px-5 py-4">
        <h1 className="font-[family-name:var(--font-display,Outfit),system-ui,sans-serif] text-xl font-bold">Conferência do mapa de lugares</h1>
        <ol className="flex items-center gap-3 text-sm text-[#69736e]">
          {ETAPAS.map((etapa, i) => (
            <li key={etapa} aria-current={etapa === "Conferir" ? "step" : undefined} className={etapa === "Conferir" ? "font-bold text-[#24302c]" : ""}>
              <span>{i + 1}. </span>
              <span>{etapa}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="space-y-4 px-5 py-4">
        <ResumoProposta resumo={resumo} />
        {bloqueadoPorTrava && trava?.mensagem ? (
          <p role="alert" className="rounded-xl border border-[#f0d9a8] bg-[#fff8e8] px-3 py-2 text-sm">{trava.mensagem}</p>
        ) : null}
        {erro ? (
          <p role="alert" className="rounded-xl border border-[#f0d9a8] bg-[#fff8e8] px-3 py-2 text-sm">
            {erro}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display,Outfit),system-ui,sans-serif] text-sm font-bold">Mapa gerado</h2>
              <div className="flex gap-1">
                {(["LADO_A_LADO", "SOBREPOR"] as const).map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={modo === valor}
                    onClick={() => mudarModo(valor)}
                    className={`rounded-full border px-3 py-1 text-xs ${modo === valor ? "border-[#a3d154] bg-[#a3d154] font-bold" : "border-[#e5e8df] bg-white"}`}
                  >
                    {valor === "LADO_A_LADO" ? "Lado a lado" : "Sobrepor"}
                  </button>
                ))}
                {sobrepor ? (
                  <button type="button" aria-pressed={armado} disabled={bloqueadoPorTrava} onClick={() => setArmado(true)} className={BOTAO_SECUNDARIO + " !py-1 text-xs"}>
                    Adicionar lugar
                  </button>
                ) : null}
              </div>
            </div>
            {armado ? <p className="text-xs text-[#69736e]">Clique no mapa, no ponto onde o lugar deve ficar.</p> : null}

            <div className={sobrepor ? "" : "grid gap-3 md:grid-cols-2"}>
              {sobrepor ? null : (
                <div className="rounded-2xl border border-[#e5e8df] bg-white p-1" style={{ aspectRatio: `${largura} / ${altura}` }}>
                  {planta}
                </div>
              )}
              <div className="rounded-2xl border border-[#e5e8df] bg-[#fffdf8]" style={{ aspectRatio: `${largura} / ${altura}` }}>
                <MapaEstiloB
                  largura={largura}
                  altura={altura}
                  lugares={lugaresMapa}
                  rotulos={proposta.rotulos}
                  elementos={proposta.elementos}
                  rotuloAcessivel="Mapa de lugares gerado"
                  selecionados={selecionadosSet}
                  destacados={destacados}
                  foco={foco}
                  fundo={sobrepor ? planta : undefined}
                  opacidadeFundo={0.35}
                  onLugarClick={aoClicarNoLugar}
                  onFundoClick={
                    armado && !bloqueadoPorTrava
                      ? (ponto) => {
                          setNovoLugar({ x: Math.round(ponto.x), y: Math.round(ponto.y), fileira: "", numero: "" });
                          setArmado(false);
                        }
                      : undefined
                  }
                />
              </div>
            </div>

            {novoLugar ? (
              <form aria-label="Novo lugar" onSubmit={adicionarLugar} className="flex flex-wrap items-end gap-2 rounded-xl border border-[#e5e8df] bg-white p-3">
                <label className="text-xs text-[#69736e]">
                  Fileira do novo lugar
                  <input value={novoLugar.fileira} onChange={(e) => setNovoLugar({ ...novoLugar, fileira: e.target.value })} className="mt-1 block w-24 rounded-lg border border-[#e5e8df] px-2 py-1 text-sm text-[#24302c]" />
                </label>
                <label className="text-xs text-[#69736e]">
                  Número do novo lugar
                  <input value={novoLugar.numero} onChange={(e) => setNovoLugar({ ...novoLugar, numero: e.target.value })} className="mt-1 block w-24 rounded-lg border border-[#e5e8df] px-2 py-1 text-sm text-[#24302c]" />
                </label>
                <button type="submit" disabled={!novoLugarCompleto} className={BOTAO_PRIMARIO}>
                  Adicionar
                </button>
                <button type="button" onClick={() => setNovoLugar(null)} className={BOTAO_SECUNDARIO}>
                  Cancelar
                </button>
              </form>
            ) : null}
          </div>

          <aside className="space-y-4">
            <ListaPontos
              pontos={proposta.pontos}
              selecionadoId={pontoAtivoId}
              onSelecionar={selecionarPonto}
              onConferir={(ponto) => aplicar([{ tipo: "CONFERIR_PONTO", pontoId: ponto.id }])}
              disabled={bloqueadoPorTrava}
            />
            <PainelLugar proposta={proposta} selecionados={selecionados} aplicar={aplicar} onSelecionarFileira={selecionarFileira} disabled={bloqueadoPorTrava} />
            <LegendaCores
              legenda={proposta.legenda}
              contagens={contagens}
              onConfirmar={(cor, categoria, acessoExterno) => aplicar([{ tipo: "CONFIRMAR_LEGENDA", cor, categoria, acessoExterno }])}
              disabled={bloqueadoPorTrava}
            />

            {pendencias.length > 0 ? (
              <ul aria-label="Pendências para publicar" className="list-disc space-y-1 pl-5 text-xs text-[#69736e]">
                {pendencias.map((p, i) => (
                  <li key={`${p.tipo}-${i}`}>
                    <button type="button" aria-label={`Abrir pendência ${i + 1}`} onClick={() => selecionarPendencia(p)} className="text-left underline decoration-dotted underline-offset-2">
                      {p.mensagem}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" disabled={bloqueadoPorTrava || pendencias.length > 0 || salvando || recarregando} onClick={() => setDialogoAberto(true)} className={BOTAO_PRIMARIO + " w-full"}>
              Publicar mapa
            </button>
            {salvando ? (
              <p className="text-center text-xs text-[#69736e]" aria-live="polite">Salvando…</p>
            ) : pendencias.length > 0 ? (
              <button type="button" disabled aria-live="polite" className="w-full border-0 bg-transparent text-center text-xs text-[#69736e]">
                {`Resolva a${pendencias.length === 1 ? " 1 pendência" : `s ${pendencias.length} pendências`} para liberar`}
              </button>
            ) : (
              <p className="text-center text-xs text-[#69736e]" aria-live="polite">Tudo conferido</p>
            )}

            <button type="button" disabled={bloqueadoPorTrava || reenviando} onClick={pedirOutraPlanta} className={BOTAO_SECUNDARIO + " w-full"}>
              Enviar outra planta
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept="application/pdf"
              aria-label="Arquivo da nova planta"
              hidden
              disabled={bloqueadoPorTrava || reenviando}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void reenviar(arquivo);
              }}
            />
            {reenviando ? <p className="text-center text-xs text-[#69736e]">Enviando a nova planta…</p> : null}
            {erroReenviar ? (
              <p role="alert" className="text-sm text-[#9a3a28]">
                {erroReenviar}
              </p>
            ) : null}
          </aside>
        </div>
      </div>

      {dialogoAberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div role="dialog" aria-modal="true" aria-label="Publicar mapa" className="w-full max-w-md space-y-3 rounded-2xl bg-[#fffdf8] p-5">
            <h2 className="font-[family-name:var(--font-display,Outfit),system-ui,sans-serif] text-lg font-bold">Publicar mapa</h2>
            <label className="block text-sm text-[#69736e]">
              Motivo das correções (opcional)
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} className="mt-1 block w-full rounded-lg border border-[#e5e8df] bg-white p-2 text-sm text-[#24302c]" />
            </label>
            {erroPublicar ? <p role="alert" className="text-sm text-[#9a3a28]">{erroPublicar}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={publicando} onClick={() => setDialogoAberto(false)} className={BOTAO_SECUNDARIO}>
                Cancelar
              </button>
              <button type="button" disabled={publicando} onClick={() => void publicar()} className={BOTAO_PRIMARIO}>
                Confirmar publicação
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
