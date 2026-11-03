"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aplicarOperacoes, type OperacaoProposta, type PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";
import { carregarRevisao, enviarOperacoes, ErroApiMapa } from "./api-mapas";

const MSG_DESATUALIZADA = "Esta conferência foi alterada em outra aba. Carregamos a versão mais recente.";
const MSG_FALHA_SALVAR = "Não foi possível salvar a última alteração. Carregamos a conferência de novo.";
const MSG_FALHA_SALVAR_E_RECARREGAR =
  "Não foi possível salvar a última alteração nem recarregar a conferência. A alteração foi desfeita; verifique a conexão e tente de novo.";
const MSG_FALHA_RECARREGAR = "Não foi possível recarregar a conferência. Verifique a conexão e tente de novo.";
const MSG_INDISPONIVEL = "Esta conferência não está mais disponível.";
const MSG_AGUARDE = "Aguarde: a conferência está sendo recarregada.";

/**
 * Estado da conferência: aplica cada mudança na tela na hora e envia ao servidor
 * em fila, uma por vez, sempre com a revisão confirmada pela resposta anterior.
 * Em qualquer erro, descarta a fila, desfaz a tela e recarrega a versão do servidor.
 * `inicial` precisa ter identidade estável entre renderizações: trocar o objeto reinicia o estado.
 *
 * Todo reinício (nova `inicial`, `recarregar()` ou erro de envio) incrementa a geração e zera
 * a fila; respostas de gerações antigas são descartadas.
 */
export function useProposta(eventoId: string, mapId: string, inicial: PropostaMapa) {
  const [proposta, setProposta] = useState<PropostaMapa>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const naTela = useRef(inicial);
  const confirmada = useRef(inicial);
  const fila = useRef<OperacaoProposta[][]>([]);
  const processando = useRef(false);
  const recarregandoRef = useRef(false);
  const geracao = useRef(0);

  const substituir = useCallback((nova: PropostaMapa) => {
    naTela.current = nova;
    confirmada.current = nova;
    setProposta(nova);
  }, []);

  /** Começa um novo ciclo: descarta a fila e invalida respostas em voo. */
  const reiniciar = useCallback(() => {
    geracao.current += 1;
    fila.current = [];
    recarregandoRef.current = false;
    setRecarregando(false);
    setSalvando(false);
    return geracao.current;
  }, []);

  /** Busca a revisão no servidor; só mexe no estado se nenhum outro reinício ocorreu no meio. */
  const recarregarDoServidor = useCallback(
    async (minha: number, mensagemSucesso: string | null, mensagemFalha: string) => {
      recarregandoRef.current = true;
      setRecarregando(true);
      try {
        const revisao = await carregarRevisao(eventoId, mapId);
        if (minha !== geracao.current) return;
        if (revisao.proposta) {
          substituir(revisao.proposta);
          setErro(mensagemSucesso);
        } else {
          setErro(MSG_INDISPONIVEL);
        }
      } catch {
        if (minha === geracao.current) setErro(mensagemFalha);
      } finally {
        if (minha === geracao.current) {
          recarregandoRef.current = false;
          setRecarregando(false);
        }
      }
    },
    [eventoId, mapId, substituir],
  );

  const recarregar = useCallback(async () => {
    const minha = reiniciar();
    await recarregarDoServidor(minha, null, MSG_FALHA_RECARREGAR);
  }, [reiniciar, recarregarDoServidor]);

  // Nova proposta inicial (outra versão carregada): reinicia tudo a partir dela.
  const inicialAnterior = useRef(inicial);
  useEffect(() => {
    if (inicialAnterior.current === inicial) return;
    inicialAnterior.current = inicial;
    reiniciar();
    substituir(inicial);
    setErro(null);
  }, [inicial, reiniciar, substituir]);

  const processarFila = useCallback(async () => {
    if (processando.current) return;
    processando.current = true;
    const minha = geracao.current;
    try {
      while (fila.current.length > 0 && minha === geracao.current) {
        const operacoes = fila.current.shift() as OperacaoProposta[];
        let resposta: PropostaMapa;
        try {
          resposta = await enviarOperacoes(eventoId, mapId, confirmada.current.revisao, operacoes);
        } catch (e) {
          if (minha !== geracao.current) return; // erro de um ciclo que já foi descartado
          const nova = reiniciar();
          // Desfaz a tela na hora: a alteração não foi salva.
          naTela.current = confirmada.current;
          setProposta(confirmada.current);
          const desatualizada = e instanceof ErroApiMapa && e.code === "PROPOSTA_DESATUALIZADA";
          await recarregarDoServidor(
            nova,
            desatualizada ? MSG_DESATUALIZADA : MSG_FALHA_SALVAR,
            MSG_FALHA_SALVAR_E_RECARREGAR,
          );
          return;
        }
        if (minha !== geracao.current) return; // resposta de um ciclo antigo: descarta
        confirmada.current = resposta;
      }
      if (minha === geracao.current && fila.current.length === 0) {
        // Tudo confirmado: a tela passa a refletir exatamente o que o servidor guardou.
        naTela.current = confirmada.current;
        setProposta(confirmada.current);
      }
    } finally {
      processando.current = false;
      if (fila.current.length > 0 && !recarregandoRef.current) void processarFila();
      else setSalvando(false);
    }
  }, [eventoId, mapId, reiniciar, recarregarDoServidor]);

  const aplicar = useCallback(
    (operacoes: OperacaoProposta[]) => {
      if (recarregandoRef.current) {
        setErro(MSG_AGUARDE);
        return;
      }
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

  return { proposta, aplicar, salvando, recarregando, erro, recarregar };
}
