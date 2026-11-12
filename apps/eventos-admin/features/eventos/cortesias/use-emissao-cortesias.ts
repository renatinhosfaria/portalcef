"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmitirCortesiasInput } from "@essencia/shared/schemas";
import type { CortesiaResumo, MapaAdminSessao } from "@essencia/shared/types";
import { conflitosDoErro, emitirCortesias } from "./api-cortesias";

export const LIMITE_LOTE = 50;

export interface EstadoEmissao {
  selecionados: string[];
  nomes: Record<string, string>;
  grupo: string;
  motivo: string;
  contatoEmail: string;
  contatoTelefone: string;
  conflitos: Set<string>;
  enviando: boolean;
  erro: string | null;
  limiteAtingido: boolean;
  podeEmitir: boolean;
}

interface OpcoesEmissao {
  eventId: string;
  sessionId: string | null;
  mapa: MapaAdminSessao | null;
  aoEmitir: (emitidas: CortesiaResumo[]) => void;
  gerarChave?: () => string;
}

type CampoEmissao = "grupo" | "motivo" | "contatoEmail" | "contatoTelefone";

const erroGenerico = "Não foi possível emitir as cortesias. Tente novamente.";

export function useEmissaoCortesias({ eventId, sessionId, mapa, aoEmitir, gerarChave = () => crypto.randomUUID() }: OpcoesEmissao): EstadoEmissao & {
  alternar(seatId: string): void;
  remover(seatId: string): void;
  definirNome(seatId: string, nome: string): void;
  definirCampo(campo: CampoEmissao, valor: string): void;
  emitir(): Promise<void>;
} {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [grupo, setGrupo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [conflitos, setConflitos] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [limiteAtingido, setLimiteAtingido] = useState(false);
  const chave = useRef<string | null>(null);
  const sessaoAnterior = useRef(sessionId);

  useEffect(() => {
    if (sessaoAnterior.current === sessionId) return;
    sessaoAnterior.current = sessionId;
    setSelecionados([]);
    setNomes({});
    setConflitos(new Set());
    setErro(null);
    setLimiteAtingido(false);
    chave.current = null;
  }, [sessionId]);

  const alternar = useCallback((seatId: string) => {
    setSelecionados((atual) => {
      if (atual.includes(seatId)) {
        setNomes((nomesAtuais) => {
          const proximo = { ...nomesAtuais };
          delete proximo[seatId];
          return proximo;
        });
        setConflitos((atuais) => {
          const proximo = new Set(atuais);
          proximo.delete(seatId);
          return proximo;
        });
        return atual.filter((id) => id !== seatId);
      }
      if (atual.length >= LIMITE_LOTE) {
        setLimiteAtingido(true);
        return atual;
      }
      if (!chave.current) chave.current = gerarChave();
      setConflitos((atuais) => {
        const proximo = new Set(atuais);
        proximo.delete(seatId);
        return proximo;
      });
      return [...atual, seatId];
    });
  }, [gerarChave]);

  const remover = useCallback((seatId: string) => alternar(seatId), [alternar]);

  const definirNome = useCallback((seatId: string, nome: string) => {
    setNomes((atuais) => ({ ...atuais, [seatId]: nome }));
  }, []);

  const definirCampo = useCallback((campo: CampoEmissao, valor: string) => {
    if (campo === "grupo") setGrupo(valor);
    else if (campo === "motivo") setMotivo(valor);
    else if (campo === "contatoEmail") setContatoEmail(valor);
    else setContatoTelefone(valor);
  }, []);

  const podeEmitir = useMemo(() => selecionados.length > 0 && grupo.trim().length >= 2 && motivo.trim().length >= 3 && !enviando, [enviando, grupo, motivo, selecionados.length]);

  const emitir = useCallback(async () => {
    if (!podeEmitir || !sessionId || !mapa) return;
    if (!chave.current) chave.current = gerarChave();
    const input: EmitirCortesiasInput = {
      sessionId,
      chave: chave.current,
      grupo,
      motivo,
      contatoEmail: contatoEmail.trim() || undefined,
      contatoTelefone: contatoTelefone.trim() || undefined,
      assentos: selecionados.flatMap((seatId) => {
        const inventorySeatId = mapa.inventarioPorAssento[seatId];
        if (!inventorySeatId) return [];
        const nome = nomes[seatId]?.trim();
        return [{ inventorySeatId, ...(nome ? { nome } : {}) }];
      }),
    };
    setEnviando(true);
    setErro(null);
    try {
      const emitidas = await emitirCortesias(eventId, input);
      setSelecionados([]);
      setNomes({});
      setConflitos(new Set());
      setLimiteAtingido(false);
      chave.current = gerarChave();
      aoEmitir(emitidas);
    } catch (e) {
      const conflitosRecebidos = conflitosDoErro(e);
      if (conflitosRecebidos.length > 0) {
        const porInventario = new Map(conflitosRecebidos.map((conflito) => [conflito.inventorySeatId, conflito]));
        const ids = new Set(selecionados.filter((seatId) => porInventario.has(mapa.inventarioPorAssento[seatId])));
        setConflitos(ids);
        const rotulos = conflitosRecebidos.map((conflito) => `Fileira ${conflito.rowLabel} · Assento ${conflito.seatNumber}`);
        setErro(`Estes lugares não estão mais livres: ${rotulos.join(", ")}. Troque-os e tente de novo.`);
      } else {
        setErro(e instanceof Error ? e.message || erroGenerico : erroGenerico);
      }
    } finally {
      setEnviando(false);
    }
  }, [aoEmitir, contatoEmail, contatoTelefone, emitirCortesias, eventId, gerarChave, grupo, mapa, motivo, nomes, podeEmitir, selecionados, sessionId]);

  return { selecionados, nomes, grupo, motivo, contatoEmail, contatoTelefone, conflitos, enviando, erro, limiteAtingido, podeEmitir, alternar, remover, definirNome, definirCampo, emitir };
}
