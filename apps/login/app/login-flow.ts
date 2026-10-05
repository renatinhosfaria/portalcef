export const LOGIN_ENDPOINT = "/login/api/auth/login";

export interface LoginResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      schoolId: string | null;
      unitId: string | null;
      stageId: string | null;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export class LoginFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginFlowError";
  }
}

export function prepararDadosLogin(email: string, password: string) {
  return { email: email.trim(), password };
}

function mensagemDaResposta(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const payload = data as {
    error?: { message?: unknown };
    message?: unknown;
  };
  if (typeof payload.error?.message === "string") return payload.error.message;
  if (typeof payload.message === "string") return payload.message;
  return null;
}

export async function analisarRespostaLogin(
  response: Response,
): Promise<LoginResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new LoginFlowError(
      "Não foi possível concluir o login. Tente novamente.",
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new LoginFlowError(
      "Não foi possível concluir o login. Tente novamente.",
    );
  }

  if (!response.ok) {
    throw new LoginFlowError(
      mensagemDaResposta(data) ?? "Não foi possível concluir o login.",
    );
  }

  const loginResponse = data as LoginResponse;
  if (!loginResponse.success || !loginResponse.data) {
    throw new LoginFlowError(
      mensagemDaResposta(data) ?? "Não foi possível concluir o login.",
    );
  }

  return loginResponse;
}

export function destinoAposLogin(search: string, origem?: string): string {
  const destino = new URLSearchParams(search).get("returnTo");
  const destinoRelativo =
    destino && destino.startsWith("/") && !destino.startsWith("//")
      ? destino
      : "/";

  if (!origem) return destinoRelativo;

  const urlOrigem = new URL(origem);
  if (
    (urlOrigem.hostname === "localhost" ||
      urlOrigem.hostname === "127.0.0.1") &&
    urlOrigem.port === "3003"
  ) {
    urlOrigem.port = "3000";
    urlOrigem.pathname = destinoRelativo;
    urlOrigem.search = "";
    return urlOrigem.toString();
  }

  return destinoRelativo;
}
