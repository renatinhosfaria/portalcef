import type {
  ChaveDetalhesObservabilidade,
  DetalhesObservabilidade,
  EventoObservabilidadeCliente,
  EventoObservabilidadeEnvio,
  EventoObservabilidadeTipo,
} from "./types";

const ENDPOINT_OBSERVABILIDADE =
  "/api/planejamento-observabilidade/eventos";
const TAMANHO_MAXIMO_LOTE = 25;
const TEMPO_LIMITE_ENVIO_MS = 3000;
const TAMANHO_URL = 2000;
const TAMANHO_TITULO = 200;
const TAMANHO_NOME = 255;
const TAMANHO_MENSAGEM = 500;
const TAMANHO_STACK = 1000;
const TAMANHO_ID = 120;
const TAMANHO_TEXTO_CURTO = 120;
const TAMANHO_DETALHES_TEXTO = 500;
const LIMITE_DETALHES_PROFUNDIDADE = 3;
const LIMITE_DETALHES_ARRAY = 20;
const LIMITE_DETALHES_CHAVES = 20;
const DATA_HORA_ISO_COM_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
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
const CAMPOS_DETALHES_NUMERICOS_NAO_NEGATIVOS = new Set([
  "duracaoMs",
  "duracaoTotalMs",
  "limiteMs",
  "tamanhoBytes",
]);
const EVENTOS_PERMITIDOS = new Set<EventoObservabilidadeTipo>([
  "pagina_aberta",
  "api_chamada",
  "api_lenta",
  "arquivo_acao",
  "erro_navegador",
  "upload_resultado",
  "sharepoint_word",
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

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    return false;
  }

  const prototipo = Object.getPrototypeOf(valor);

  return prototipo === Object.prototype || prototipo === null;
}

function limitarTexto(valor: unknown, tamanhoMaximo: number): string | undefined {
  if (typeof valor !== "string") {
    return undefined;
  }

  return valor.trim().slice(0, tamanhoMaximo);
}

function normalizarNumeroNaoNegativo(valor: unknown): number | undefined {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
    return undefined;
  }

  return valor;
}

function normalizarInteiro(valor: unknown): number | undefined {
  if (typeof valor !== "number" || !Number.isInteger(valor)) {
    return undefined;
  }

  return valor;
}

function normalizarStatusHttp(valor: unknown): number | undefined {
  const status = normalizarInteiro(valor);

  if (status === undefined || status < 100 || status > 599) {
    return undefined;
  }

  return status;
}

function normalizarDataHora(valor: unknown): string | undefined {
  if (
    typeof valor !== "string" ||
    !DATA_HORA_ISO_COM_TIMEZONE.test(valor) ||
    Number.isNaN(Date.parse(valor))
  ) {
    return undefined;
  }

  return valor;
}

function normalizarEvento(valor: unknown): EventoObservabilidadeTipo | undefined {
  if (typeof valor !== "string") {
    return undefined;
  }

  return EVENTOS_PERMITIDOS.has(valor as EventoObservabilidadeTipo)
    ? (valor as EventoObservabilidadeTipo)
    : undefined;
}

function limparHttp(valor: unknown): EventoObservabilidadeEnvio["http"] {
  if (!ehObjetoSimples(valor)) {
    return undefined;
  }

  const resultado: NonNullable<EventoObservabilidadeEnvio["http"]> = {};
  const metodo = limitarTexto(valor.metodo, TAMANHO_TEXTO_CURTO);
  const rota = limitarTexto(valor.rota, TAMANHO_URL);
  const status = normalizarStatusHttp(valor.status);
  const duracaoMs = normalizarNumeroNaoNegativo(valor.duracaoMs);

  if (metodo !== undefined) resultado.metodo = metodo;
  if (rota !== undefined) resultado.rota = rota;
  if (status !== undefined) resultado.status = status;
  if (duracaoMs !== undefined) resultado.duracaoMs = duracaoMs;

  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

function limparPagina(valor: unknown): EventoObservabilidadeEnvio["pagina"] {
  if (!ehObjetoSimples(valor)) {
    return undefined;
  }

  const resultado: NonNullable<EventoObservabilidadeEnvio["pagina"]> = {};
  const url = limitarTexto(valor.url, TAMANHO_URL);
  const titulo = limitarTexto(valor.titulo, TAMANHO_TITULO);

  if (url !== undefined) resultado.url = url;
  if (titulo !== undefined) resultado.titulo = titulo;

  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

function limparArquivo(valor: unknown): EventoObservabilidadeEnvio["arquivo"] {
  if (!ehObjetoSimples(valor)) {
    return undefined;
  }

  const resultado: NonNullable<EventoObservabilidadeEnvio["arquivo"]> = {};
  const planoId = valor.planoId === null ? null : limitarTexto(valor.planoId, TAMANHO_ID);
  const provaId = valor.provaId === null ? null : limitarTexto(valor.provaId, TAMANHO_ID);
  const documentoId =
    valor.documentoId === null
      ? null
      : limitarTexto(valor.documentoId, TAMANHO_ID);
  const nome = valor.nome === null ? null : limitarTexto(valor.nome, TAMANHO_NOME);
  const tipo = valor.tipo === null ? null : limitarTexto(valor.tipo, TAMANHO_TEXTO_CURTO);
  const tamanhoBytes =
    valor.tamanhoBytes === null
      ? null
      : normalizarNumeroNaoNegativo(valor.tamanhoBytes);

  if (planoId !== undefined) resultado.planoId = planoId;
  if (provaId !== undefined) resultado.provaId = provaId;
  if (documentoId !== undefined) resultado.documentoId = documentoId;
  if (nome !== undefined) resultado.nome = nome;
  if (tipo !== undefined) resultado.tipo = tipo;
  if (tamanhoBytes !== undefined) resultado.tamanhoBytes = tamanhoBytes;

  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

function limparErro(valor: unknown): EventoObservabilidadeEnvio["erro"] {
  if (!ehObjetoSimples(valor)) {
    return undefined;
  }

  const resultado: NonNullable<EventoObservabilidadeEnvio["erro"]> = {};
  const codigo = valor.codigo === null ? null : limitarTexto(valor.codigo, TAMANHO_TEXTO_CURTO);
  const mensagem =
    valor.mensagem === null ? null : limitarTexto(valor.mensagem, TAMANHO_MENSAGEM);
  const stackResumo =
    valor.stackResumo === null
      ? null
      : limitarTexto(valor.stackResumo, TAMANHO_STACK);

  if (codigo !== undefined) resultado.codigo = codigo;
  if (mensagem !== undefined) resultado.mensagem = mensagem;
  if (stackResumo !== undefined) resultado.stackResumo = stackResumo;

  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

function limparDetalhes(
  valor: unknown,
  profundidade = 0,
  chaveAtual?: string,
): unknown {
  if (profundidade > LIMITE_DETALHES_PROFUNDIDADE) {
    return undefined;
  }

  const valorSemCamposProibidos = removerCamposProibidos(valor);

  if (Array.isArray(valorSemCamposProibidos)) {
    return valorSemCamposProibidos
      .slice(0, LIMITE_DETALHES_ARRAY)
      .map((item) => limparDetalhes(item, profundidade + 1, chaveAtual))
      .filter((item) => item !== undefined);
  }

  if (
    valorSemCamposProibidos === null ||
    typeof valorSemCamposProibidos !== "object"
  ) {
    if (typeof valorSemCamposProibidos === "string") {
      return valorSemCamposProibidos.slice(0, TAMANHO_DETALHES_TEXTO);
    }

    if (typeof valorSemCamposProibidos === "number") {
      if (CAMPOS_DETALHES_NUMERICOS_NAO_NEGATIVOS.has(chaveAtual ?? "")) {
        return normalizarNumeroNaoNegativo(valorSemCamposProibidos);
      }

      return Number.isFinite(valorSemCamposProibidos)
        ? valorSemCamposProibidos
        : undefined;
    }

    return valorSemCamposProibidos;
  }

  if (!ehObjetoSimples(valorSemCamposProibidos)) {
    return undefined;
  }

  const resultado = Object.entries(valorSemCamposProibidos).slice(0, LIMITE_DETALHES_CHAVES).reduce<
    Record<string, unknown>
  >((acumulado, [chave, valorAtual]) => {
    if (
      !CAMPOS_DETALHES_PERMITIDOS.has(
        chave as ChaveDetalhesObservabilidade,
      )
    ) {
      return acumulado;
    }

    const valorSanitizado = limparDetalhes(
      valorAtual,
      profundidade + 1,
      chave,
    );

    if (valorSanitizado !== undefined) {
      acumulado[chave] = valorSanitizado;
    }

    return acumulado;
  }, {});

  return Object.keys(resultado).length > 0 ? resultado : undefined;
}

function prepararEventoParaEnvio(
  evento: EventoObservabilidadeCliente,
): EventoObservabilidadeEnvio | null {
  const eventoSanitizado = removerCamposProibidos(evento) as Record<
    string,
    unknown
  >;
  const eventoNormalizado = normalizarEvento(eventoSanitizado.evento);

  if (!eventoNormalizado) {
    return null;
  }

  const payload: EventoObservabilidadeEnvio = {
    evento: eventoNormalizado,
    origem: "browser",
    sessaoObservabilidadeId: obterSessaoObservabilidadeId(),
  };
  const timestamp = normalizarDataHora(eventoSanitizado.timestamp);
  const ambiente = limitarTexto(eventoSanitizado.ambiente, TAMANHO_TEXTO_CURTO);
  const correlationId =
    eventoSanitizado.correlationId === null
      ? null
      : limitarTexto(eventoSanitizado.correlationId, TAMANHO_ID);
  const requestId =
    eventoSanitizado.requestId === null
      ? null
      : limitarTexto(eventoSanitizado.requestId, TAMANHO_ID);

  if (timestamp !== undefined) {
    payload.timestamp = timestamp;
  }

  if (ambiente !== undefined) {
    payload.ambiente = ambiente;
  }

  if (
    eventoSanitizado.nivel === "info" ||
    eventoSanitizado.nivel === "warn" ||
    eventoSanitizado.nivel === "error"
  ) {
    payload.nivel = eventoSanitizado.nivel;
  }

  if (correlationId !== undefined) {
    payload.correlationId = correlationId;
  }

  if (requestId !== undefined) {
    payload.requestId = requestId;
  }

  const http = limparHttp(eventoSanitizado.http);
  if (http) {
    payload.http = http;
  }

  const pagina = limparPagina(eventoSanitizado.pagina);
  if (pagina) {
    payload.pagina = pagina;
  }

  const arquivo = limparArquivo(eventoSanitizado.arquivo);
  if (arquivo) {
    payload.arquivo = arquivo;
  }

  const erro = limparErro(eventoSanitizado.erro);
  if (erro) {
    payload.erro = erro;
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
  let temporizador: number | undefined;

  try {
    const eventos = lote
      .map(prepararEventoParaEnvio)
      .filter((evento): evento is EventoObservabilidadeEnvio => evento !== null);

    if (eventos.length === 0) {
      return;
    }

    const controlador =
      typeof AbortController !== "undefined"
        ? new AbortController()
        : undefined;

    if (controlador) {
      temporizador = window.setTimeout(
        () => controlador.abort(),
        TEMPO_LIMITE_ENVIO_MS,
      );
    }

    await fetch(ENDPOINT_OBSERVABILIDADE, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventos,
      }),
      signal: controlador?.signal,
    });
  } catch {
    // Envio best effort: falhas de observabilidade não podem afetar a tela.
  } finally {
    if (temporizador !== undefined) {
      window.clearTimeout(temporizador);
    }
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
