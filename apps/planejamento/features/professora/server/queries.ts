/**
 * Professora Feature - Server Queries
 * Funções de busca de dados para o dashboard da professora
 * Task 3 - Integração com API
 */

"use server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface CurrentPlanningData {
  id: string;
  turma: string;
  quinzena: string;
  status: "RASCUNHO" | "PENDENTE" | "EM_AJUSTE" | "APROVADO";
  objetivos?: string | null;
  metodologia?: string | null;
  recursos?: string | null;
  submittedAt: Date | null;
  updatedAt: Date | null;
  hasDraft: boolean;
}

export interface FeedbackData {
  planningId: string;
  status: string;
  comment: string;
  reviewerName: string;
  createdAt: Date;
}

export interface CurrentPlanningResult {
  success: boolean;
  data?: CurrentPlanningData | null;
  error?: string;
}

export interface FeedbackResult {
  success: boolean;
  data?: FeedbackData | null;
  error?: string;
}

/**
 * Busca o planejamento atual da professora logada
 */
export async function getMyCurrentPlanning(
  cookies: string,
): Promise<CurrentPlanningResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/plannings/me/current`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      cache: "no-store",
    });

    if (response.status === 401) {
      return { success: false, error: "Não autenticado" };
    }

    if (response.status === 403) {
      return { success: false, error: "Acesso negado" };
    }

    if (!response.ok) {
      return { success: false, error: "Erro ao buscar planejamento" };
    }

    const result = await response.json();
    return {
      success: true,
      data: result.data
        ? {
            ...result.data,
            submittedAt: result.data.submittedAt
              ? new Date(result.data.submittedAt)
              : null,
            updatedAt: result.data.updatedAt
              ? new Date(result.data.updatedAt)
              : null,
          }
        : null,
    };
  } catch (error) {
    console.error("getMyCurrentPlanning error:", error);
    return { success: false, error: "Erro de conexão" };
  }
}

/**
 * Busca feedback pendente da professora (se status EM_AJUSTE)
 */
export async function getMyPendingFeedback(
  cookies: string,
): Promise<FeedbackResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/plannings/me/feedback`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      cache: "no-store",
    });

    if (response.status === 401) {
      return { success: false, error: "Não autenticado" };
    }

    if (response.status === 403) {
      return { success: false, error: "Acesso negado" };
    }

    if (!response.ok) {
      return { success: false, error: "Erro ao buscar feedback" };
    }

    const result = await response.json();
    return {
      success: true,
      data: result.data
        ? {
            ...result.data,
            createdAt: new Date(result.data.createdAt),
          }
        : null,
    };
  } catch (error) {
    console.error("getMyPendingFeedback error:", error);
    return { success: false, error: "Erro de conexão" };
  }
}
