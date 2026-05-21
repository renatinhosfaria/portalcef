import type {
  EventoObservabilidadeCliente,
  EventoObservabilidadeEnvio,
  ValorObservabilidade,
} from "./types";

const ENDPOINT_OBSERVABILIDADE =
  "/api/planejamento-observabilidade/eventos";
const TAMANHO_MAXIMO_LOTE = 25;
const TEMPO_LIMITE_ENVIO_MS = 3000;
const CAMPOS_PROIBIDOS = new Set([
  "cookie",
  "authorization",
  "token",
  "password",
  "senha",
  "body",
  "payload",
  "conteudo",
  "html",
  "headers",
  "usuario",
]);

let sessaoObservabilidadeId: string | null = null;
const filaEventos: EventoObservabilidadeCliente[] = [];

function ambienteNavegadorDisponivel(): boolean {
  return typeof window !== "undefined";
}

function gerarIdentificadorSessao(): string {
  const cryptoGlobal = globalThis.crypto;

  if (typeof cryptoGlobal?.randomUUID === "function") {
    return cryptoGlobal.randomUUID();
  }

  return `obs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function removerCamposProibidos(
  valor: ValorObservabilidade,
): ValorObservabilidade {
  if (Array.isArray(valor)) {
    return valor
      .map((item) => removerCamposProibidos(item))
      .filter((item) => item !== undefined);
  }

  if (valor === null || typeof valor !== "object") {
    return valor;
  }

  return Object.entries(valor).reduce<Record<string, ValorObservabilidade>>(
    (resultado, [chave, valorAtual]) => {
      if (CAMPOS_PROIBIDOS.has(chave.toLowerCase())) {
        return resultado;
      }

      const valorSanitizado = removerCamposProibidos(valorAtual);

      if (valorSanitizado !== undefined) {
        resultado[chave] = valorSanitizado;
      }

      return resultado;
    },
    {},
  );
}

function prepararEventoParaEnvio(
  evento: EventoObservabilidadeCliente,
): EventoObservabilidadeEnvio {
  return {
    ...(removerCamposProibidos(evento) as EventoObservabilidadeCliente),
    sessaoObservabilidadeId: obterSessaoObservabilidadeId(),
  };
}

export function obterSessaoObservabilidadeId(): string {
  if (!ambienteNavegadorDisponivel()) {
    return "";
  }

  if (!sessaoObservabilidadeId) {
    sessaoObservabilidadeId = gerarIdentificadorSessao();
  }

  return sessaoObservabilidadeId;
}

export function registrarEventoObservabilidade(
  evento: EventoObservabilidadeCliente,
): void {
  if (!ambienteNavegadorDisponivel()) {
    return;
  }

  filaEventos.push(evento);
}

export async function enviarEventosPendentes(): Promise<void> {
  if (!ambienteNavegadorDisponivel() || filaEventos.length === 0) {
    return;
  }

  const lote = filaEventos.splice(0, TAMANHO_MAXIMO_LOTE);
  const controlador = new AbortController();
  const temporizador = window.setTimeout(
    () => controlador.abort(),
    TEMPO_LIMITE_ENVIO_MS,
  );

  try {
    await fetch(ENDPOINT_OBSERVABILIDADE, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventos: lote.map(prepararEventoParaEnvio),
      }),
      signal: controlador.signal,
    });
  } catch {
    // Envio best effort: falhas de observabilidade não podem afetar a tela.
  } finally {
    window.clearTimeout(temporizador);
  }
}

export async function medirObservabilidade<T>(
  eventoBase: EventoObservabilidadeCliente,
  acao: () => Promise<T>,
): Promise<T> {
  const inicio = typeof performance !== "undefined" ? performance.now() : 0;

  try {
    const resultado = await acao();
    registrarEventoObservabilidade({
      ...eventoBase,
      sucesso: true,
      duracaoMs:
        typeof performance !== "undefined"
          ? Math.round(performance.now() - inicio)
          : undefined,
    });

    return resultado;
  } catch (erro) {
    registrarEventoObservabilidade({
      ...eventoBase,
      sucesso: false,
      erro:
        erro instanceof Error
          ? erro.name
          : "ErroDesconhecido",
      duracaoMs:
        typeof performance !== "undefined"
          ? Math.round(performance.now() - inicio)
          : undefined,
    });

    throw erro;
  }
}
