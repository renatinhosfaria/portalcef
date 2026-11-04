"use client";
import { MapaEstiloB } from "@essencia/components/eventos/mapa-estilo-b";
import { resumoProposta, type PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { DM_Sans, Outfit } from "next/font/google";
import { useParams, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { baseEvento, carregarRevisao, ErroApiMapa, importarPlanta, listarMapas, publicarMapa, respostaApi } from "../../../../features/eventos/conferencia/api-mapas";
import { ConferenciaMapa } from "../../../../features/eventos/conferencia/conferencia-mapa";
import { paraLugaresMapa } from "../../../../features/eventos/conferencia/lugares-mapa";
import { ResumoProposta } from "../../../../features/eventos/conferencia/resumo-proposta";
import { ResultadoPublicacao, type MapMigrationResult, type PreviousMapArchive } from "../../../../features/eventos/resultado-publicacao";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

type ReplacementData = { inheritedSessionIds: string[]; inventorySessionIds: string[]; inventoryCreatedCount: number; previousMapId?: string | null; previousMapArchive: PreviousMapArchive };
type MigrationData = MapMigrationResult & { oldMapId: string; targetMapId: string };

/** Versão em conferência: a proposta inicial é guardada em estado para manter a mesma identidade entre renderizações. */
type EmRevisao = { mapId: string; proposta: PropostaMapa };
/** Mapa publicado; `proposta` é nula nos mapas criados pela versão anterior do gerador. */
type Publicado = { mapId: string; proposta: PropostaMapa | null };
type Vista = { tipo: "carregando" } | { tipo: "sem-mapa" } | ({ tipo: "em-revisao" } & EmRevisao) | ({ tipo: "publicado" } & Publicado);

const BOTAO_PRIMARIO = "rounded-xl bg-[#a3d154] px-4 py-2 text-sm font-semibold text-[#24302c] disabled:opacity-50";

function validarSubstituicao(data: unknown): ReplacementData {
  if (!data || typeof data !== "object") throw new Error("Resposta inválida da substituição");
  const value = data as Partial<ReplacementData>;
  const archive = value.previousMapArchive;
  const archiveValido = !!archive && typeof archive === "object" && typeof archive.archived === "boolean" && ["ARCHIVED", "MAP_IN_USE", "NO_PREVIOUS_MAP", "DELETED"].includes(archive.code) && (archive.sessionIds === undefined || Array.isArray(archive.sessionIds));
  if (!Array.isArray(value.inheritedSessionIds) || !Array.isArray(value.inventorySessionIds) || typeof value.inventoryCreatedCount !== "number" || !archiveValido) throw new Error("Resposta inválida da substituição");
  return value as ReplacementData;
}

function validarMigracao(data: unknown): MigrationData {
  if (!data || typeof data !== "object") throw new Error("Resposta inválida da migração");
  const value = data as Partial<MigrationData>;
  const deletedMap = value.deletedMap;
  if (typeof value.oldMapId !== "string" || typeof value.targetMapId !== "string" || !Array.isArray(value.migratedSessionIds) || !Array.isArray(value.inheritedSessionIds) || typeof value.inventoryCreatedCount !== "number" || !deletedMap || deletedMap.deleted !== true || deletedMap.code !== "DELETED") throw new Error("Resposta inválida da migração");
  return value as MigrationData;
}

function mensagemFalhaMigracao(error: unknown): string {
  if (!(error instanceof Error)) return "Falha ao migrar sessões e excluir mapa anterior.";
  const code = (error as Error & { code?: string }).code;
  if (!code) return error.message;
  return error.message.startsWith(code) ? error.message : `${code}: ${error.message}`;
}

function mensagemErro(error: unknown, padrao: string): string {
  return error instanceof Error && error.message ? error.message : padrao;
}

function CampoArquivo({ rotulo, desabilitado, aoEscolher }: { rotulo: string; desabilitado: boolean; aoEscolher: (arquivo: File) => void }) {
  return (
    <label className="block text-sm text-[#69736e]">
      {rotulo}
      <input
        type="file"
        accept="application/pdf"
        aria-label={rotulo}
        disabled={desabilitado}
        className="mt-1 block text-sm text-[#24302c]"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) aoEscolher(arquivo);
        }}
      />
    </label>
  );
}

export default function MapaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const refresh = router.refresh;
  const [vista, setVista] = useState<Vista>({ tipo: "carregando" });
  const [confirmedMapId, setConfirmedMapId] = useState<string | null>(null);
  const [affectedSessionIds, setAffectedSessionIds] = useState<string[]>([]);
  const [inventoryCreatedCount, setInventoryCreatedCount] = useState<number | undefined>(undefined);
  const [inventorySessionIds, setInventorySessionIds] = useState<string[]>([]);
  const [previousMapArchive, setPreviousMapArchive] = useState<PreviousMapArchive | undefined>(undefined);
  const [previousMapId, setPreviousMapId] = useState<string | null>(null);
  const [pendingSubstitutionMapId, setPendingSubstitutionMapId] = useState<string | null>(null);
  const [mapaPadraoPendente, setMapaPadraoPendente] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [escolhaPagina, setEscolhaPagina] = useState<{ arquivo: File; paginas: number; pagina: number } | null>(null);
  const substitutionPromise = useRef<Promise<void> | null>(null);
  const publicacaoPromise = useRef<Promise<void> | null>(null);
  const enviandoRef = useRef(false);

  const aplicarResultado = (data: ReplacementData) => {
    setAffectedSessionIds([...new Set([...(data.previousMapArchive?.sessionIds ?? []), ...(data.inheritedSessionIds ?? [])])]);
    setInventoryCreatedCount(data.inventoryCreatedCount ?? 0);
    setInventorySessionIds(data.inventorySessionIds ?? []);
    setPreviousMapArchive(data.previousMapArchive);
    setPreviousMapId(data.previousMapId ?? null);
  };

  const limparResultado = () => {
    setPendingSubstitutionMapId(null);
    setMapaPadraoPendente(false);
    setError("");
    setAffectedSessionIds([]);
    setInventoryCreatedCount(undefined);
    setInventorySessionIds([]);
    setPreviousMapArchive(undefined);
    setPreviousMapId(null);
    setConfirmedMapId(null);
  };

  const substituirMapaPadrao = (mapId: string) => {
    if (substitutionPromise.current) return substitutionPromise.current;
    const promise = (async () => {
      const data = validarSubstituicao(await respostaApi(await fetch(`${baseEvento(id)}/mapa-padrao/substituir`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapId }),
      })));
      aplicarResultado(data);
      setPendingSubstitutionMapId(null);
      setMapaPadraoPendente(false);
      setError("");
      refresh();
    })();
    substitutionPromise.current = promise;
    void promise.then(() => { if (substitutionPromise.current === promise) substitutionPromise.current = null; }, () => { if (substitutionPromise.current === promise) substitutionPromise.current = null; });
    return promise;
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const event = await respostaApi(await fetch(baseEvento(id)));
        const mapas = await listarMapas(id);
        // A lista vem da versão mais nova para a mais antiga.
        const emRevisao = mapas.find((m) => m.status === "EM_REVISAO");
        if (emRevisao) {
          const revisao = await carregarRevisao(id, emRevisao.id);
          if (!active) return;
          if (revisao.proposta) { setVista({ tipo: "em-revisao", mapId: emRevisao.id, proposta: revisao.proposta }); return; }
        }
        const padrao = event.defaultMapId ? mapas.find((m) => m.id === event.defaultMapId && m.status === "CONFIRMADO") : undefined;
        if (!padrao) { if (active) setVista({ tipo: "sem-mapa" }); return; }
        const revisao = await carregarRevisao(id, padrao.id);
        if (!active) return;
        setConfirmedMapId(padrao.id);
        setVista({ tipo: "publicado", mapId: padrao.id, proposta: revisao.proposta });
        const data = await respostaApi(await fetch(`${baseEvento(id)}/mapa-padrao`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mapId: padrao.id }) }));
        if (!active) return;
        aplicarResultado(data);
        refresh();
      } catch { if (active) { setError("Falha ao carregar o mapa atual."); setVista((atual) => (atual.tipo === "carregando" ? { tipo: "sem-mapa" } : atual)); } }
    })();
    return () => { active = false; };
    // aplicarResultado só usa setters estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, refresh]);

  const retrySubstituicao = async () => {
    if (!pendingSubstitutionMapId) return;
    try { await substituirMapaPadrao(pendingSubstitutionMapId); }
    catch { setConfirmedMapId(pendingSubstitutionMapId); setError("Falha ao substituir o mapa padrão. A versão confirmada foi preservada. Tente novamente."); setMapaPadraoPendente(true); }
  };

  /** Envia a planta; erros voltam para quem chamou, exceto a escolha de página, tratada aqui. */
  const enviarPlanta = useCallback(async (arquivo: File, pagina?: number) => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      let mapId: string;
      try {
        ({ mapId } = await importarPlanta(id, arquivo, pagina));
      } catch (e) {
        const paginas = e instanceof ErroApiMapa && e.code === "PDF_PAGINA_OBRIGATORIA" ? Number(e.details?.paginas) : NaN;
        if (Number.isInteger(paginas) && paginas > 1) { setError(""); setEscolhaPagina({ arquivo, paginas, pagina: 1 }); return; }
        throw e;
      }
      const revisao = await carregarRevisao(id, mapId);
      if (!revisao.proposta) throw new Error("A planta enviada não gerou uma proposta de mapa.");
      limparResultado();
      setEscolhaPagina(null);
      setVista({ tipo: "em-revisao", mapId, proposta: revisao.proposta });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
    // limparResultado só usa setters estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const enviarDoFormulario = async (arquivo: File, pagina?: number) => {
    setError("");
    try { await enviarPlanta(arquivo, pagina); }
    catch (e) { setError(mensagemErro(e, "Falha ao enviar a planta.")); }
  };

  const publicar = (mapId: string, revisaoBase: number, motivo?: string) => {
    if (publicacaoPromise.current) return publicacaoPromise.current;
    const promise = (async () => {
      await publicarMapa(id, mapId, revisaoBase, motivo);
      setConfirmedMapId(mapId);
      try { await substituirMapaPadrao(mapId); }
      catch { setPendingSubstitutionMapId(mapId); setMapaPadraoPendente(true); setError("Falha ao atualizar o mapa padrão; falha na substituição. A versão confirmada foi preservada. Tente novamente."); }
      try {
        // Recarrega a lista e abre o mapa recém-publicado como mapa padrão.
        await listarMapas(id);
        const revisao = await carregarRevisao(id, mapId);
        setVista({ tipo: "publicado", mapId, proposta: revisao.proposta });
      } catch { setError((atual) => atual || "O mapa foi publicado, mas não foi possível recarregar a página. Atualize para ver o resultado."); }
    })();
    publicacaoPromise.current = promise;
    void promise.then(() => { if (publicacaoPromise.current === promise) publicacaoPromise.current = null; }, () => { if (publicacaoPromise.current === promise) publicacaoPromise.current = null; });
    return promise;
  };

  const migrarEExcluirMapaAnterior = async (): Promise<MapMigrationResult> => {
    if (!previousMapId) throw new Error("Mapa anterior ausente");
    const targetMapId = confirmedMapId;
    if (!targetMapId) throw new Error("Mapa confirmado ausente");
    try {
      const data = validarMigracao(await respostaApi(await fetch(`${baseEvento(id)}/mapas/${previousMapId}/migrar-e-excluir`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetMapId, sessionIds: previousMapArchive?.sessionIds ?? [] }),
      })));
      setAffectedSessionIds([]);
      setInventoryCreatedCount(data.inventoryCreatedCount ?? 0);
      setInventorySessionIds(data.migratedSessionIds ?? []);
      setPreviousMapArchive({ archived: true, code: "DELETED", sessionIds: data.migratedSessionIds ?? [] });
      setPreviousMapId(null);
      setError("");
      refresh();
      return data;
    } catch (error) {
      setConfirmedMapId(targetMapId);
      setError(mensagemFalhaMigracao(error));
      throw error;
    }
  };

  const propostaPublicada = vista.tipo === "publicado" ? vista.proposta : null;
  const lugaresPublicados = useMemo(() => (propostaPublicada ? paraLugaresMapa(propostaPublicada) : []), [propostaPublicada]);
  const resumoPublicado = useMemo(() => (propostaPublicada ? resumoProposta(propostaPublicada) : null), [propostaPublicada]);

  const resultado = (
    <ResultadoPublicacao
      affectedSessionIds={affectedSessionIds}
      inventoryCreatedCount={inventoryCreatedCount}
      inventorySessionIds={inventorySessionIds}
      previousMapArchive={previousMapArchive}
      onRetryDefaultMap={mapaPadraoPendente ? retrySubstituicao : undefined}
      onMigrateAndDelete={previousMapArchive?.code === "MAP_IN_USE" && previousMapId ? migrarEExcluirMapaAnterior : undefined}
    />
  );

  const alerta = error ? <p role="alert" className="text-sm text-[#9a3a28]">{error}</p> : null;

  const seletorPagina = escolhaPagina ? (
    <div className="space-y-2 rounded-xl border border-[#e5e8df] bg-white p-3">
      <p className="text-sm font-semibold">Escolha a página da planta</p>
      <p className="text-xs text-[#69736e]">O PDF tem {escolhaPagina.paginas} páginas. Qual delas é a planta?</p>
      <label className="block text-sm text-[#69736e]">
        Página da planta
        <select
          value={escolhaPagina.pagina}
          onChange={(e) => setEscolhaPagina({ ...escolhaPagina, pagina: Number(e.target.value) })}
          className="ml-2 rounded-lg border border-[#e5e8df] bg-white px-2 py-1 text-sm text-[#24302c]"
        >
          {Array.from({ length: escolhaPagina.paginas }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <button type="button" disabled={enviando} onClick={() => void enviarDoFormulario(escolhaPagina.arquivo, escolhaPagina.pagina)} className={BOTAO_PRIMARIO}>Enviar página escolhida</button>
    </div>
  ) : null;

  let conteudo: React.ReactNode;
  if (vista.tipo === "carregando") {
    conteudo = <p role="status" className="p-5 text-sm text-[#69736e]">Carregando o mapa…</p>;
  } else if (vista.tipo === "em-revisao") {
    conteudo = (
      <>
        {alerta ? <div className="px-5 pt-4">{alerta}</div> : null}
        {seletorPagina ? <div className="px-5 pt-4">{seletorPagina}</div> : null}
        <ConferenciaMapa
          key={vista.mapId}
          eventoId={id}
          mapId={vista.mapId}
          propostaInicial={vista.proposta}
          onPublicar={(revisaoBase, motivo) => publicar(vista.mapId, revisaoBase, motivo)}
          onReenviar={(arquivo) => enviarPlanta(arquivo)}
        />
      </>
    );
  } else {
    const legado = vista.tipo === "publicado" && !vista.proposta;
    conteudo = (
      <div className="space-y-4 p-5">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">Mapa de lugares</h1>
        {alerta}
        {resultado}
        {legado ? <p className="text-sm">Este mapa foi criado pela versão anterior do gerador. Envie a planta em PDF para gerar o mapa novo.</p> : null}
        {propostaPublicada && resumoPublicado ? (
          <>
            <ResumoProposta resumo={resumoPublicado} />
            <div className="rounded-2xl border border-[#e5e8df] bg-[#fffdf8]" style={{ aspectRatio: `${propostaPublicada.pagina.largura} / ${propostaPublicada.pagina.altura}` }}>
              <MapaEstiloB
                largura={propostaPublicada.pagina.largura}
                altura={propostaPublicada.pagina.altura}
                lugares={lugaresPublicados}
                rotulos={propostaPublicada.rotulos}
                elementos={propostaPublicada.elementos}
                rotuloAcessivel="Mapa de lugares publicado"
              />
            </div>
          </>
        ) : null}
        {seletorPagina}
        <CampoArquivo rotulo={vista.tipo === "publicado" && !legado ? "Enviar nova planta" : "Enviar planta em PDF"} desabilitado={enviando} aoEscolher={(arquivo) => void enviarDoFormulario(arquivo)} />
        {enviando ? <p className="text-xs text-[#69736e]">Enviando a planta…</p> : null}
      </div>
    );
  }

  return <section className={`${outfit.variable} ${dmSans.variable} min-h-screen bg-[#fffdf8] font-[family-name:var(--font-body)] text-[#24302c]`}>{conteudo}</section>;
}
