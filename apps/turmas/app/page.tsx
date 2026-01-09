"use client";

/**
 * Turmas Dashboard
 * Lista de turmas por unidade (ou geral quando unitId nao existe)
 */

import { clientFetch } from "@essencia/shared/fetchers/client";
import { useTenant } from "@essencia/shared/providers/tenant";
import type { TurmaWithProfessora } from "@essencia/shared/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";


import { TurmasPageContent } from "../components/turmas-page-content";

// Roles permitidas para acessar o módulo de turmas
const ALLOWED_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
];

export default function TurmasPage() {
  const router = useRouter();
  const { isLoaded, unitId, role } = useTenant();
  const [turmas, setTurmas] = useState<TurmaWithProfessora[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTurmas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const endpoint = unitId ? `/units/${unitId}/turmas` : "/turmas";
      const data = await clientFetch<TurmaWithProfessora[]>(endpoint);

      setTurmas(data ?? []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro desconhecido");
      }
    } finally {
      setIsLoading(false);
    }
  }, [unitId]);

  // Proteção de rota - verificar se usuário tem permissão
  useEffect(() => {
    if (!isLoaded) return;

    // Verificar se a role do usuário está na lista de roles permitidas
    if (!role || !ALLOWED_ROLES.includes(role)) {
      console.warn(
        `Acesso negado ao módulo de turmas. Role atual: ${role}. Redirecionando para home.`,
      );
      router.push("http://localhost:3000"); // Redireciona para o app home
      return;
    }
  }, [isLoaded, role, router]);

  // Carregar turmas apenas se tiver permissão
  useEffect(() => {
    if (!isLoaded) return;
    if (!role || !ALLOWED_ROLES.includes(role)) return;

    void loadTurmas();
  }, [isLoaded, role, unitId, loadTurmas]);

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

  // Usuário sem permissão (este estado não deveria ser alcançado devido ao redirect, mas incluímos como fallback)
  if (!ALLOWED_ROLES.includes(role)) {
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

  // Erro ao carregar dados
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="font-semibold text-red-600 mb-2">Erro ao carregar</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={loadTurmas}
          className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <TurmasPageContent
      turmas={turmas}
      isLoading={isLoading}
      onRefresh={loadTurmas}
    />
  );
}
