import type {
  ChaveDetalhesObservabilidade,
  DetalhesObservabilidade,
  EventoObservabilidadeCliente,
  EventoObservabilidadeEnvio,
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
const CAMPOS_HTTP_PERMITIDOS = [
  "metodo",
  "rota",
  "status",
  "duracaoMs",
] as const;
const CAMPOS_PAGINA_PERMITIDOS = ["url", "titulo"] as const;
const CAMPOS_ARQUIVO_PERMITIDOS = [
  "planoId",
  "provaId",
  "documentoId",
  "nome",
  "tipo",
  "tamanhoBytes",
] as const;
const CAMPOS_ERRO_PERMITIDOS = [
  "codigo",
  "mensagem",
  "stackResumo",
] as const;
const CAMPOS_DETALHES_PERMITIDOS = new Set<ChaveDetalhesObservabilidade>([
  "acao",
  "duracaoMs",
  "duracaoTotalMs",
  "etapa",
  "fallback",
  "limiteMs",
  "lento",
  "modulo",
  "navegador",
  "online",
  "origemAcao",
  "quantidade",
  "resultado",
  "sistema",
  "status",
  "tamanhoBytes",
  "tentativa",
  "tipo",
  "visibilidade",
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
  valor: unknown,
): unknown {
  if (Array.isArray(valor)) {
    return valor
      .map((item) => removerCamposProibidos(item))
      .filter((item) => item !== undefined);
  }

  if (valor === null || typeof valor !== "object") {
    return valor;
  }

  return Object.entries(valor).reduce<Record<string, unknown>>(
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

function limparObjetoPermitido<TChave extends string>(
  objeto: unknown,
  camposPermitidos: readonly TChave[],
): Partial<Record<TChave, unknown>> | undefined {
  if (objeto === null || typeof objeto !== "object" || Array.isArray(objeto)) {
    return undefined;
  }

  const origem = objeto as Record<string, unknown>;
  const resultado = camposPermitidos.reduce<Partial<Record<TChave, unknown>>>(
    (acumulado, campo) => {
      if (!Object.prototype.hasOwnProperty.call(origem, campo)) {
        return acumulado;
      }

      const valorSanitizado = removerCamposProibidos(origem[campo]);

      if (valorSanitizado !== undefined) {
        acumulado[campo] = valorSanitizado;
      }

      return acumulado;
    },
    {},
  );

  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

function limparDetalhes(valor: unknown): unknown {
  const valorSemCamposProibidos = removerCamposProibidos(valor);

  if (Array.isArray(valorSemCamposProibidos)) {
    return valorSemCamposProibidos
      .map((item) => limparDetalhes(item))
      .filter((item) => item !== undefined);
  }

  if (
    valorSemCamposProibidos === null ||
    typeof valorSemCamposProibidos !== "object"
  ) {
    return valorSemCamposProibidos;
  }

  const resultado = Object.entries(valorSemCamposProibidos).reduce<
    Record<string, unknown>
  >((acumulado, [chave, valorAtual]) => {
    if (
      !CAMPOS_DETALHES_PERMITIDOS.has(
        chave as ChaveDetalhesObservabilidade,
      )
    ) {
      return acumulado;
    }

    const valorSanitizado = limparDetalhes(valorAtual);

    if (valorSanitizado !== undefined) {
      acumulado[chave] = valorSanitizado;
    }

    return acumulado;
  }, {});

  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

function prepararEventoParaEnvio(
  evento: EventoObservabilidadeCliente,
): EventoObservabilidadeEnvio {
  const eventoSanitizado = removerCamposProibidos(evento) as Record<
    string,
    unknown
  >;
  const payload: EventoObservabilidadeEnvio = {
    evento: eventoSanitizado.evento as EventoObservabilidadeEnvio["evento"],
    origem: "browser",
    sessaoObservabilidadeId: obterSessaoObservabilidadeId(),
  };

  if (typeof eventoSanitizado.timestamp === "string") {
    payload.timestamp = eventoSanitizado.timestamp;
  }

  if (typeof eventoSanitizado.ambiente === "string") {
    payload.ambiente = eventoSanitizado.ambiente;
  }

  if (
    eventoSanitizado.nivel === "info" ||
    eventoSanitizado.nivel === "warn" ||
    eventoSanitizado.nivel === "error"
  ) {
    payload.nivel = eventoSanitizado.nivel;
  }

  if (
    typeof eventoSanitizado.correlationId === "string" ||
    eventoSanitizado.correlationId === null
  ) {
    payload.correlationId = eventoSanitizado.correlationId;
  }

  if (
    typeof eventoSanitizado.requestId === "string" ||
    eventoSanitizado.requestId === null
  ) {
    payload.requestId = eventoSanitizado.requestId;
  }

  const http = limparObjetoPermitido(
    eventoSanitizado.http,
    CAMPOS_HTTP_PERMITIDOS,
  );
  if (http) {
    payload.http = http as EventoObservabilidadeEnvio["http"];
  }

  const pagina = limparObjetoPermitido(
    eventoSanitizado.pagina,
    CAMPOS_PAGINA_PERMITIDOS,
  );
  if (pagina) {
    payload.pagina = pagina as EventoObservabilidadeEnvio["pagina"];
  }

  const arquivo = limparObjetoPermitido(
    eventoSanitizado.arquivo,
    CAMPOS_ARQUIVO_PERMITIDOS,
  );
  if (arquivo) {
    payload.arquivo = arquivo as EventoObservabilidadeEnvio["arquivo"];
  }

  const erro = limparObjetoPermitido(
    eventoSanitizado.erro,
    CAMPOS_ERRO_PERMITIDOS,
  );
  if (erro) {
    payload.erro = erro as EventoObservabilidadeEnvio["erro"];
  }

  if (eventoSanitizado.detalhes === null) {
    payload.detalhes = null;
  } else {
    const detalhes = limparDetalhes(eventoSanitizado.detalhes);

    if (
      detalhes &&
      typeof detalhes === "object" &&
      !Array.isArray(detalhes)
    ) {
      payload.detalhes = detalhes as DetalhesObservabilidade;
    }
  }

  return payload;
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
      detalhes: {
        ...(eventoBase.detalhes ?? {}),
        status: "sucesso",
        duracaoMs:
          typeof performance !== "undefined"
            ? Math.round(performance.now() - inicio)
            : undefined,
      },
    });

    return resultado;
  } catch (erro) {
    registrarEventoObservabilidade({
      ...eventoBase,
      detalhes: {
        ...(eventoBase.detalhes ?? {}),
        status: "erro",
        duracaoMs:
          typeof performance !== "undefined"
            ? Math.round(performance.now() - inicio)
            : undefined,
      },
      erro: {
        ...eventoBase.erro,
        codigo:
          erro instanceof Error
            ? erro.name
            : "ErroDesconhecido",
      },
    });

    throw erro;
  }
}
