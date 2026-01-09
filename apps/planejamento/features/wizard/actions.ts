"use server";

/**
 * Server Actions for Planning Wizard
 * Story 2.4 - Salvar Rascunho no Servidor
 */

import { ServerFetchError, serverApi } from "@essencia/shared/fetchers/server";
import { cookies } from "next/headers";

import { saveDraftInputSchema, type SaveDraftInput } from "./schemas";

interface PlanningDetails {
  id: string;
  turma: string;
  quinzena: string;
  status: string;
  objetivos?: string | null;
  metodologia?: string | null;
  recursos?: string | null;
}

async function getCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const storedCookies = cookieStore.getAll();

  if (storedCookies.length === 0) {
    return undefined;
  }

  return storedCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

/**
 * Server Action: saveDraft
 * Salva ou atualiza um rascunho de planejamento no banco de dados
 *
 * @param input Dados parciais do planejamento
 * @returns Result object com success/error
 */
export async function saveDraft(input: SaveDraftInput) {
  try {
    // Validar input
    const result = saveDraftInputSchema.safeParse(input);
    if (!result.success) {
      return {
        success: false,
        error: "Dados inválidos. Turma e quinzena são obrigatórios.",
      };
    }

    const data = result.data;

    const cookieHeader = await getCookieHeader();
    const options = cookieHeader ? { cookies: cookieHeader } : undefined;

    const savedPlanning = await serverApi.post<Record<string, unknown>>(
      "/plannings/draft",
      {
        turma: data.turma,
        quinzena: data.quinzena,
        objetivos: data.objetivos,
        metodologia: data.metodologia,
        recursos: data.recursos,
      },
      options,
    );

    return {
      success: true,
      data: savedPlanning,
    };
  } catch (error) {
    // Log do erro no servidor (não expor ao cliente)
    console.error("saveDraft error:", error);
    if (error instanceof ServerFetchError && error.status === 401) {
      return {
        success: false,
        error: "Usuário não autenticado",
      };
    }

    return {
      success: false,
      error: "Erro ao salvar rascunho. Tente novamente.",
    };
  }
}

/**
 * Server Action: submitPlanningComplete
 * Envia o planejamento completo para aprovação da coordenação
 * Story 3.5 - Envio para Coordenação
 *
 * @param input Dados completos do planejamento
 * @returns Result object com success/error
 */
export async function submitPlanningComplete(input: any) {
  try {
    const cookieHeader = await getCookieHeader();
    const options = cookieHeader ? { cookies: cookieHeader } : undefined;

    const response = await serverApi.post<Record<string, unknown>>(
      "/plannings/submit",
      input,
      options,
    );

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error("submitPlanningComplete error:", error);
    if (error instanceof ServerFetchError && error.status === 401) {
      return {
        success: false,
        error: "Usuário não autenticado",
      };
    }

    return {
      success: false,
      error: "Erro ao enviar planejamento. Tente novamente.",
    };
  }
}

/**
 * Server Action: submitPlanning
 * Envia o planejamento para aprovação da coordenação
 * Story 3.5 - Envio para Coordenação
 *
 * @param planningId ID do planejamento a ser enviado
 * @returns Result object com success/error
 */
export async function submitPlanning(planningId: string) {
  try {
    if (!planningId) {
      return {
        success: false,
        error: "ID do planejamento é obrigatório",
      };
    }

    const cookieHeader = await getCookieHeader();
    const options = cookieHeader ? { cookies: cookieHeader } : undefined;

    const existing = await serverApi.get<PlanningDetails>(
      `/plannings/${planningId}`,
      options,
    );

    // Validar que o status atual permite envio
    if (existing.status !== "RASCUNHO") {
      return {
        success: false,
        error: "Apenas planejamentos em rascunho podem ser enviados",
      };
    }

    // Validar que o planejamento está completo
    if (!existing.objetivos || !existing.metodologia || !existing.recursos) {
      return {
        success: false,
        error: "Complete todos os campos obrigatórios antes de enviar",
      };
    }

    const updatedPlanning = await serverApi.post<Record<string, unknown>>(
      "/plannings/submit",
      {
        turma: existing.turma,
        quinzena: existing.quinzena,
        objetivos: existing.objetivos ?? undefined,
        metodologia: existing.metodologia ?? undefined,
        recursos: existing.recursos ?? undefined,
      },
      options,
    );

    return {
      success: true,
      data: updatedPlanning,
    };
  } catch (error) {
    // Log do erro no servidor (não expor ao cliente)
    console.error("submitPlanning error:", error);
    if (error instanceof ServerFetchError && error.status === 401) {
      return {
        success: false,
        error: "Usuário não autenticado",
      };
    }

    return {
      success: false,
      error: "Erro ao enviar planejamento. Tente novamente.",
    };
  }
}
