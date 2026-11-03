"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aplicarOperacoes, type OperacaoProposta, type PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { carregarRevisao, enviarOperacoes, ErroApiMapa } from "./api-mapas";

const MSG_DESATUALIZADA = "Esta conferência foi alterada em outra aba. Carregamos a versão mais recente.";
const MSG_FALHA_SALVAR = "Não foi possível salvar a última alteração. Carregamos a conferência de novo.";

/**
 * Estado da conferência: aplica cada mudança na tela na hora e envia ao servidor
 * em fila, uma por vez, sempre com a revisão confirmada pela resposta anterior.
 * Em qualquer erro, descarta a fila e recarrega a versão do servidor.
 * `inicial` precisa ter identidade estável entre renderizações: trocar o objeto reinicia o estado.
 */
export function useProposta(eventoId: string, mapId: string, inicial: PropostaMapa) {
  const [proposta, setProposta] = useState<PropostaMapa>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const naTela = useRef(inicial);
  const confirmada = useRef(inicial);
  const fila = useRef<OperacaoProposta[][]>([]);
  const processando = useRef(false);
  const geracao = useRef(0);

  const substituir = useCallback((nova: PropostaMapa) => {
    naTela.current = nova;
    confirmada.current = nova;
    setProposta(nova);
  }, []);

  const recarregar = useCallback(async () => {
    const minha = geracao.current;
    const revisao = await carregarRevisao(eventoId, mapId);
    if (minha !== geracao.current || !revisao.proposta) return;
    substituir(revisao.proposta);
  }, [eventoId, mapId, substituir]);

  // Nova proposta inicial (outra versão carregada): reinicia tudo a partir dela.
  const inicialAnterior = useRef(inicial);
  useEffect(() => {
    if (inicialAnterior.current === inicial) return;
    inicialAnterior.current = inicial;
    geracao.current += 1;
    fila.current = [];
    substituir(inicial);
    setSalvando(false);
    setErro(null);
  }, [inicial, substituir]);

  const processarFila = useCallback(async () => {
    if (processando.current) return;
    processando.current = true;
    const minha = geracao.current;
    try {
      while (fila.current.length > 0 && minha === geracao.current) {
        const operacoes = fila.current.shift() as OperacaoProposta[];
        try {
          confirmada.current = await enviarOperacoes(eventoId, mapId, confirmada.current.revisao, operacoes);
        } catch (e) {
          fila.current = [];
          geracao.current += 1;
          setErro(e instanceof ErroApiMapa && e.code === "PROPOSTA_DESATUALIZADA" ? MSG_DESATUALIZADA : MSG_FALHA_SALVAR);
          try {
            const revisao = await carregarRevisao(eventoId, mapId);
            if (revisao.proposta) substituir(revisao.proposta);
          } catch {
            // Sem rede para recarregar: o aviso já informa que a alteração não foi salva.
          }
          return;
        }
      }
      if (minha === geracao.current && fila.current.length === 0) {
        // Tudo confirmado: a tela passa a refletir exatamente o que o servidor guardou.
        naTela.current = confirmada.current;
        setProposta(confirmada.current);
      }
    } finally {
      processando.current = false;
      if (minha === geracao.current) setSalvando(fila.current.length > 0);
      else setSalvando(false);
    }
  }, [eventoId, mapId, substituir]);

  const aplicar = useCallback(
    (operacoes: OperacaoProposta[]) => {
      let nova: PropostaMapa;
      try {
        nova = aplicarOperacoes(naTela.current, operacoes);
      } catch (e) {
        setErro(e instanceof Error ? e.message : MSG_FALHA_SALVAR);
        return;
      }
      setErro(null);
      naTela.current = nova;
      setProposta(nova);
      fila.current.push(operacoes);
      setSalvando(true);
      void processarFila();
    },
    [processarFila],
  );

  return { proposta, aplicar, salvando, erro, recarregar };
}
