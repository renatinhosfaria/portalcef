/**
 * Regência Feature - Server Actions
 * Ações do servidor para o painel de regência
 * Epic 4 - Stories 4.1, 4.3, 4.4
 */

"use server";

import { revalidatePath } from "next/cache";

import type { PlanningListItem } from "./components/planning-list";

// API Base URL - usar variável de ambiente ou fallback
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

// Mock de usuário para desenvolvimento (será substituído por auth real)
const MOCK_COORDINATOR = {
  id: "00000000-0000-0000-0000-000000000002",
  role: "coordenadora_infantil" as const,
  stage: "INFANTIL" as const,
  name: "Coordenadora Infantil",
};

/**
 * Busca planejamentos pendentes da etapa da coordenadora
 * Story 4.1 - Lista de Planejamentos por Segmento
 */
export async function getPlanningsBySegment(): Promise<{
  success: boolean;
  data?: PlanningListItem[];
  error?: string;
}> {
  try {
    // Mock da autenticação - usar RBAC real depois
    const user = MOCK_COORDINATOR;

    // Verificar permissão (apenas coordenadoras/diretoras)
    const allowedRoles = [
      "coordenadora_bercario",
      "coordenadora_infantil",
      "coordenadora_fundamental_i",
      "coordenadora_fundamental_ii",
      "coordenadora_medio",
      "coordenadora_geral",
      "analista_pedagogico",
      "diretora_geral",
    ];

    if (!allowedRoles.includes(user.role)) {
      return { success: false, error: "Acesso não autorizado" };
    }

    // Buscar planejamentos da API
    const response = await fetch(
      `${API_BASE_URL}/plannings/segment/${user.stage}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Token de auth seria passado aqui
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      // Se a API ainda não implementou o endpoint, retornar dados mock
      console.warn("API não disponível, usando dados mock");
      return {
        success: true,
        data: getMockPlannings(),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error("getPlanningsBySegment error:", error);
    // Retornar mock para desenvolvimento
    return {
      success: true,
      data: getMockPlannings(),
    };
  }
}

/**
 * Busca um planejamento pelo ID
 * Story 4.2 - Visualizador de PDF Integrado
 */
export async function getPlanningById(planningId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    professorName: string;
    turma: string;
    quinzena: string;
    status: "RASCUNHO" | "PENDENTE" | "APROVADO" | "EM_AJUSTE";
    objetivos?: string;
    metodologia?: string;
    recursos?: string;
    submittedAt: Date | null;
  };
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/plannings/${planningId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // Retornar mock para desenvolvimento
      console.warn("API não disponível, usando dados mock");
      return {
        success: true,
        data: getMockPlanningDetails(planningId),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error("getPlanningById error:", error);
    return {
      success: true,
      data: getMockPlanningDetails(planningId),
    };
  }
}

/**
 * Aprova um planejamento
 * Story 4.3 - Ação de Aprovar Planejamento
 */
export async function approvePlanning(planningId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Mock da autenticação
    const user = MOCK_COORDINATOR;

    // Verificar permissão
    const allowedRoles = [
      "coordenadora_bercario",
      "coordenadora_infantil",
      "coordenadora_fundamental_i",
      "coordenadora_fundamental_ii",
      "coordenadora_medio",
      "coordenadora_geral",
      "analista_pedagogico",
      "diretora_geral",
    ];

    if (!allowedRoles.includes(user.role)) {
      return { success: false, error: "Acesso não autorizado" };
    }

    const response = await fetch(
      `${API_BASE_URL}/plannings/${planningId}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewerId: user.id,
        }),
      },
    );

    if (!response.ok) {
      // Mock success para desenvolvimento
      console.warn("API não disponível, simulando sucesso");
      revalidatePath("/regencia");
      revalidatePath(`/regencia/${planningId}`);
      return { success: true };
    }

    const result = await response.json();

    if (result.success) {
      revalidatePath("/regencia");
      revalidatePath(`/regencia/${planningId}`);
    }

    return result;
  } catch (error) {
    console.error("approvePlanning error:", error);
    // Mock success para desenvolvimento
    revalidatePath("/regencia");
    revalidatePath(`/regencia/${planningId}`);
    return { success: true };
  }
}

/**
 * Solicita ajustes em um planejamento
 * Story 4.4 - Ação de Solicitar Ajustes com Comentário
 */
export async function requestChanges(
  planningId: string,
  comment: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Validação do comentário
    if (!comment || comment.trim().length < 10) {
      return {
        success: false,
        error: "O comentário deve ter pelo menos 10 caracteres",
      };
    }

    // Mock da autenticação
    const user = MOCK_COORDINATOR;

    // Verificar permissão
    const allowedRoles = [
      "coordenadora_bercario",
      "coordenadora_infantil",
      "coordenadora_fundamental_i",
      "coordenadora_fundamental_ii",
      "coordenadora_medio",
      "coordenadora_geral",
      "analista_pedagogico",
      "diretora_geral",
    ];

    if (!allowedRoles.includes(user.role)) {
      return { success: false, error: "Acesso não autorizado" };
    }

    const response = await fetch(
      `${API_BASE_URL}/plannings/${planningId}/request-changes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewerId: user.id,
          comment: comment.trim(),
        }),
      },
    );

    if (!response.ok) {
      // Mock success para desenvolvimento
      console.warn("API não disponível, simulando sucesso");
      revalidatePath("/regencia");
      revalidatePath(`/regencia/${planningId}`);
      return { success: true };
    }

    const result = await response.json();

    if (result.success) {
      revalidatePath("/regencia");
      revalidatePath(`/regencia/${planningId}`);
    }

    return result;
  } catch (error) {
    console.error("requestChanges error:", error);
    // Mock success para desenvolvimento
    revalidatePath("/regencia");
    revalidatePath(`/regencia/${planningId}`);
    return { success: true };
  }
}

// ========================================
// Mock Data para desenvolvimento
// ========================================

function getMockPlannings(): PlanningListItem[] {
  return [
    {
      id: "mock-1",
      professorName: "Maria Silva",
      turma: "Infantil 3A",
      quinzena: "2025-Q01",
      status: "PENDENTE",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 dias atrás
    },
    {
      id: "mock-2",
      professorName: "Ana Costa",
      turma: "Infantil 4B",
      quinzena: "2025-Q01",
      status: "PENDENTE",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 dia atrás
    },
    {
      id: "mock-3",
      professorName: "Julia Santos",
      turma: "Infantil 2A",
      quinzena: "2025-Q01",
      status: "PENDENTE",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 horas atrás
    },
  ];
}

function getMockPlanningDetails(planningId: string) {
  return {
    id: planningId,
    professorName: "Maria Silva",
    turma: "Infantil 3A",
    quinzena: "2025-Q01",
    status: "PENDENTE" as const,
    objetivos:
      "Desenvolver habilidades motoras e cognitivas através de atividades lúdicas.",
    metodologia: "Uso de jogos educativos e atividades em grupo.",
    recursos: "Material didático, brinquedos educativos, jogos de encaixe.",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  };
}
