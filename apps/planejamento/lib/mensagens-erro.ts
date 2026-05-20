type ObjetoErro = Record<string, unknown>;

const MENSAGEM_DOCUMENTO_INDISPONIVEL =
  "Não conseguimos abrir esse documento agora. Tente abrir novamente em alguns instantes.";

function isObjeto(valor: unknown): valor is ObjetoErro {
  return typeof valor === "object" && valor !== null;
}

function lerObjeto(objeto: ObjetoErro, chave: string): ObjetoErro | null {
  const valor = objeto[chave];
  return isObjeto(valor) ? valor : null;
}

function lerString(objeto: ObjetoErro, chave: string): string | null {
  const valor = objeto[chave];
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) {
    const mensagens = valor.filter((item): item is string => typeof item === "string");
    return mensagens.length > 0 ? mensagens.join(", ") : null;
  }
  return null;
}

function lerNumero(objeto: ObjetoErro, chave: string): number | null {
  const valor = objeto[chave];
  if (typeof valor === "number") return valor;
  if (typeof valor === "string" && valor.trim()) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

function extrairDadosErro(erro: unknown): {
  status: number | null;
  codigo: string | null;
  mensagem: string | null;
} {
  if (erro instanceof Error) {
    const objetoErro = erro as Error & ObjetoErro;
    const status =
      lerNumero(objetoErro, "status") ?? lerNumero(objetoErro, "statusCode");
    const codigo = lerString(objetoErro, "code");
    return { status, codigo, mensagem: erro.message };
  }

  if (!isObjeto(erro)) {
    return {
      status: null,
      codigo: null,
      mensagem: typeof erro === "string" ? erro : null,
    };
  }

  const error = lerObjeto(erro, "error");
  const response = lerObjeto(erro, "response");
  const responseData = response ? lerObjeto(response, "data") : null;
  const responseDataError = responseData ? lerObjeto(responseData, "error") : null;

  const status =
    lerNumero(erro, "status") ??
    lerNumero(erro, "statusCode") ??
    (response ? lerNumero(response, "status") : null);

  const codigo =
    lerString(erro, "code") ??
    (error ? lerString(error, "code") : null) ??
    (responseDataError ? lerString(responseDataError, "code") : null);

  const mensagem =
    lerString(erro, "message") ??
    (error ? lerString(error, "message") : null) ??
    (responseDataError ? lerString(responseDataError, "message") : null);

  return { status, codigo, mensagem };
}

function contem(texto: string | null, padrao: RegExp): boolean {
  return texto ? padrao.test(texto) : false;
}

function mensagemJaClara(mensagem: string): boolean {
  const texto = mensagem.trim();

  if (!texto) return false;
  if (/^erro ao\b/i.test(texto)) return false;
  if (/^(error|failed|invalid|cannot|unauthorized|forbidden|bad request)\b/i.test(texto)) {
    return false;
  }
  if (/[{}[\]<>]|https?:\/\/|\/api\/|stack|exception|itemnotfound/i.test(texto)) {
    return false;
  }
  if (/\b[A-Z]{3,}(?:_[A-Z]{2,})+\b/.test(texto)) return false;

  return true;
}

export function obterMensagemErro(
  erro: unknown,
  fallback = "Não foi possível concluir essa ação. Tente novamente.",
): string {
  const { status, codigo, mensagem } = extrairDadosErro(erro);
  const codigoNormalizado = codigo?.toLowerCase() ?? "";
  const mensagemNormalizada = mensagem?.toLowerCase() ?? "";

  if (
    codigoNormalizado === "itemnotfound" ||
    contem(mensagemNormalizada, /resource could not be found|itemnotfound|sharepoint/)
  ) {
    return MENSAGEM_DOCUMENTO_INDISPONIVEL;
  }

  if (
    status === 401 ||
    codigoNormalizado === "unauthorized" ||
    contem(mensagemNormalizada, /unauthorized|não autenticado|sessão expirada/)
  ) {
    return "Sua sessão expirou. Faça login novamente para continuar.";
  }

  if (
    status === 403 ||
    codigoNormalizado === "forbidden" ||
    contem(mensagemNormalizada, /forbidden|acesso negado/)
  ) {
    return "Você não tem permissão para fazer essa ação.";
  }

  if (contem(mensagemNormalizada, /tipo de arquivo|file type|mime|não permitido/)) {
    return "Esse arquivo não é aceito. Envie PDF, Word, Excel, PNG ou JPG.";
  }

  if (
    status === 413 ||
    contem(mensagemNormalizada, /arquivo muito grande|payload too large|file too large/)
  ) {
    return "O arquivo é muito grande. Envie um arquivo de até 100 MB.";
  }

  if (
    status === 429 ||
    codigoNormalizado === "too_many_requests" ||
    contem(mensagemNormalizada, /too many|muitas tentativas/)
  ) {
    return "Houve muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  if (
    status === 502 ||
    status === 503 ||
    codigoNormalizado === "proxy_error" ||
    codigoNormalizado === "service_unavailable" ||
    contem(mensagemNormalizada, /failed to fetch|network|fetch failed|failed to reach|servidor backend/)
  ) {
    return "Não conseguimos conectar ao portal agora. Verifique sua internet e tente novamente.";
  }

  if (status === 404 || codigoNormalizado === "not_found") {
    return "Não encontramos esse item. Ele pode ter sido removido ou atualizado por outra pessoa.";
  }

  if (
    status === 400 ||
    codigoNormalizado === "validation_error" ||
    contem(mensagemNormalizada, /bad request|validation/i)
  ) {
    if (mensagem && mensagemJaClara(mensagem)) return mensagem;
    return "Revise as informações preenchidas e tente novamente.";
  }

  if (mensagem && mensagemJaClara(mensagem)) {
    return mensagem;
  }

  if (status && status >= 500) {
    return "Algo não saiu como esperado no servidor. Tente novamente em instantes.";
  }

  return fallback;
}

export function obterMensagemErroDaRespostaApi(
  respostaApi: unknown,
  fallback?: string,
): string {
  return obterMensagemErro(respostaApi, fallback);
}

export async function obterMensagemErroDaRespostaHttp(
  resposta: Response,
  fallback?: string,
): Promise<string> {
  const dados = await resposta.json().catch(() => null);

  return obterMensagemErro(
    isObjeto(dados)
      ? {
          ...dados,
          status: resposta.status,
          statusCode: resposta.status,
        }
      : {
          status: resposta.status,
          statusCode: resposta.status,
          message: resposta.statusText,
        },
    fallback,
  );
}
