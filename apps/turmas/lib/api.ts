/**
 * API Fetchers para Turmas
 * Funções específicas para comunicar com API de turmas
 */

import { clientFetch } from "@essencia/shared/fetchers/client";
import type { Turma } from "@essencia/shared/types";

export interface ListTurmasFilters {
  unitId?: string;
  stageId?: string;
  year?: number;
}

/**
 * Lista todas as turmas com filtros opcionais
 */
export async function listTurmas(filters?: ListTurmasFilters) {
  const params = new URLSearchParams();
  if (filters?.unitId) params.append("unitId", filters.unitId);
  if (filters?.stageId) params.append("stageId", filters.stageId);
  if (filters?.year) params.append("year", filters.year.toString());

  const search = params.toString() ? `?${params.toString()}` : "";
  return clientFetch<Turma[]>(`/turmas${search}`);
}

/**
 * Busca turma por ID
 */
export async function getTurmaById(id: string) {
  return clientFetch<Turma>(`/turmas/${id}`);
}

/**
 * Lista turmas de uma unidade específica
 */
export async function listTurmasByUnit(unitId: string, year?: number) {
  const params = new URLSearchParams();
  if (year) params.append("year", year.toString());

  const search = params.toString() ? `?${params.toString()}` : "";
  return clientFetch<Turma[]>(`/units/${unitId}/turmas${search}`);
}

/**
 * Cria nova turma
 */
export async function createTurma(data: {
  unitId: string;
  stageId: string;
  name: string;
  code: string;
  year: number;
  shift?: string;
  capacity?: number;
}) {
  const response = await clientFetch<Turma>("/turmas", {
    method: "POST",
    body: data,
  });
  return response;
}

/**
 * Atualiza turma
 */
export async function updateTurma(
  id: string,
  data: {
    name?: string;
    code?: string;
    year?: number;
    shift?: string;
    capacity?: number;
  }
) {
  return clientFetch<Turma>(`/turmas/${id}`, {
    method: "PUT",
    body: data,
  });
}

/**
 * Desativa turma (soft delete)
 */
export async function deactivateTurma(id: string) {
  return clientFetch<null>(`/turmas/${id}`, {
    method: "DELETE",
  });
}
