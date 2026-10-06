/**
 * Funções auxiliares para chamadas à API
 */

interface ErroApiEstruturado {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

async function criarErroApi(response: Response): Promise<Error> {
  let payload: ErroApiEstruturado | null = null;

  try {
    payload = (await response.json()) as ErroApiEstruturado;
  } catch {
    // Algumas respostas de infraestrutura não possuem corpo JSON.
  }

  const message =
    payload?.error?.message ??
    payload?.message ??
    (response.statusText || `Erro na requisição (${response.status})`);
  const erro = new Error(message);

  if (payload?.error?.code) {
    Object.assign(erro, { code: payload.error.code });
  }

  return erro;
}

async function garantirRespostaOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw await criarErroApi(response);
  }
}

/**
 * Realiza uma requisição GET
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`/api/${endpoint}`);

  await garantirRespostaOk(response);

  return response.json();
}

/**
 * Realiza uma requisição POST
 */
export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const isFormData = body instanceof FormData;

  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    ...(isFormData
      ? { body: body as FormData }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });

  await garantirRespostaOk(response);

  return response.json();
}

/**
 * Realiza uma requisição PATCH
 */
export async function apiPatch<T>(
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const options: RequestInit = {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`/api/${endpoint}`, options);

  await garantirRespostaOk(response);

  return response.json();
}

/**
 * Realiza uma requisição DELETE
 */
export async function apiDelete<T = { success: boolean; data: null }>(
  endpoint: string,
): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    method: "DELETE",
  });

  await garantirRespostaOk(response);

  return response.json();
}
