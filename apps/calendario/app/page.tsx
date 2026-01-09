"use client";

/**
 * Calendário Escolar Dashboard
 * Visualização e gestão do calendário por unidade
 */

import { useTenant } from "@essencia/shared/providers/tenant";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CalendarView } from "@/features/calendar/components/calendar-view";

// Roles de gestão com acesso ao calendário
const VIEW_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
] as const;

// Roles que podem criar/editar eventos
const EDIT_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
] as const;

// Roles que podem deletar eventos
const DELETE_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
] as const;

export default function CalendarioPage() {
  const router = useRouter();
  const { isLoaded, unitId, role } = useTenant();

  // Proteção de rota - verificar se usuário tem permissão
  useEffect(() => {
    if (!isLoaded) return;

    // Verificar se a role do usuário está na lista de roles permitidas
    if (!role || !VIEW_ROLES.includes(role as (typeof VIEW_ROLES)[number])) {
      console.warn(
        `Acesso negado ao módulo de calendário. Role atual: ${role}. Redirecionando para home.`,
      );
      router.push("http://localhost:3000");
      return;
    }
  }, [isLoaded, role, router]);

  // Verificando permissões...
  if (!isLoaded || !role) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Usuário sem permissão
  if (!VIEW_ROLES.includes(role as (typeof VIEW_ROLES)[number])) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="font-semibold text-red-600 mb-2">Acesso Negado</h2>
        <p className="text-sm text-slate-600 mb-4">
          Você não tem permissão para acessar esta página.
        </p>
        <button
          onClick={() => router.push("http://localhost:3000")}
          className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
        >
          Voltar para Home
        </button>
      </div>
    );
  }

  const canEdit = EDIT_ROLES.includes(role as (typeof EDIT_ROLES)[number]);
  const canDelete = DELETE_ROLES.includes(
    role as (typeof DELETE_ROLES)[number],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Calendário Escolar
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualize e gerencie o calendário escolar da sua unidade
          </p>
        </div>
      </div>

      {/* Calendar View */}
      <CalendarView unitId={unitId} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
