/**
 * Dashboard Feature - Server Queries
 * Funções de busca de dados para o dashboard
 * Epic 5 - Story 5.1, 5.2, 5.4
 */

"use server";

import type { DashboardTeacher } from "../utils/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

// Mock de contexto de usuário para desenvolvimento
const MOCK_USER_CONTEXT = {
  id: "00000000-0000-0000-0000-000000000002",
  role: "diretora_geral" as string,
  segment: null as string | null, // Direção vê todos
  name: "Diretora Geral",
};

export interface DashboardDataResult {
  success: boolean;
  data?: {
    teachers: DashboardTeacher[];
    currentQuinzena: string;
    deadline: Date;
  };
  error?: string;
}

/**
 * Busca dados consolidados para o dashboard
 * Story 5.1, 5.2, 5.4
 */
export async function getDashboardData(
  stageFilter?: string,
): Promise<DashboardDataResult> {
  try {
    const user = MOCK_USER_CONTEXT;

    // Determinar segmento efetivo baseado em RBAC
    let effectiveStage: string | null = null;

    // Coordenadoras são presas ao seu segmento
    if (user.role === "coordenadora_bercario") {
      effectiveStage = "BERCARIO";
    } else if (user.role === "coordenadora_infantil") {
      effectiveStage = "INFANTIL";
    } else if (user.role === "coordenadora_fundamental_i") {
      effectiveStage = "FUNDAMENTAL_I";
    } else if (user.role === "coordenadora_fundamental_ii") {
      effectiveStage = "FUNDAMENTAL_II";
    } else if (user.role === "coordenadora_medio") {
      effectiveStage = "MEDIO";
    } else if (stageFilter && stageFilter !== "todos") {
      // Direção pode usar o filtro
      effectiveStage = stageFilter.toUpperCase();
    }

    // Buscar dados da API
    const url = effectiveStage
      ? `${API_BASE_URL}/plannings/dashboard?stage=${effectiveStage}`
      : `${API_BASE_URL}/plannings/dashboard`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // Retornar dados mock para desenvolvimento
      console.warn("API não disponível, usando dados mock");
      return {
        success: true,
        data: getMockDashboardData(effectiveStage),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error("getDashboardData error:", error);
    // Retornar mock para desenvolvimento
    return {
      success: true,
      data: getMockDashboardData(null),
    };
  }
}

/**
 * Mock data para desenvolvimento
 */
function getMockDashboardData(stage: string | null): {
  teachers: DashboardTeacher[];
  currentQuinzena: string;
  deadline: Date;
} {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 2); // 2 dias a partir de agora

  const mockTeachers: DashboardTeacher[] = [
    {
      id: "teacher-1",
      name: "Maria Silva",
      turma: "Infantil 3A",
      segment: "INFANTIL",
      planningId: "planning-1",
      planningStatus: "APROVADO",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
    {
      id: "teacher-2",
      name: "Ana Costa",
      turma: "Infantil 4B",
      segment: "INFANTIL",
      planningId: "planning-2",
      planningStatus: "PENDENTE",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
    {
      id: "teacher-3",
      name: "Julia Santos",
      turma: "Fundamental 5A",
      segment: "FUNDAMENTAL_I",
      planningId: "planning-3",
      planningStatus: "EM_AJUSTE",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    },
    {
      id: "teacher-4",
      name: "Laura Oliveira",
      turma: "Infantil 2A",
      segment: "INFANTIL",
      planningId: null,
      planningStatus: null,
      submittedAt: null,
      updatedAt: null,
    },
    {
      id: "teacher-5",
      name: "Carla Mendes",
      turma: "Fundamental 3B",
      segment: "FUNDAMENTAL_I",
      planningId: "planning-5",
      planningStatus: "PENDENTE",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 dias atrás - ATRASADO
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    },
  ];

  // Filtrar por segmento se especificado
  const filtered = stage
    ? mockTeachers.filter((t) => t.segment === stage)
    : mockTeachers;

  return {
    teachers: filtered,
    currentQuinzena: "2025-Q01",
    deadline,
  };
}
