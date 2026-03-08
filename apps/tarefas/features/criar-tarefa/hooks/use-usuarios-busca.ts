"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api";

export interface UsuarioParaAtribuicao {
  id: string;
  nome: string;
  role: string;
}

const ROLES_ELEGIVEIS: Record<string, string[]> = {
  professora: ["professora"],
  auxiliar_sala: ["auxiliar_sala"],
  analista_pedagogico: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
  ],
  coordenadora_bercario: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
  ],
  coordenadora_infantil: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
  ],
  coordenadora_fundamental_i: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
  ],
  coordenadora_fundamental_ii: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
  ],
  coordenadora_medio: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
  ],
  coordenadora_geral: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
  ],
  gerente_unidade: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
    "gerente_unidade",
  ],
  gerente_financeiro: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
    "gerente_unidade",
    "gerente_financeiro",
  ],
  diretora_geral: [
    "professora",
    "auxiliar_sala",
    "analista_pedagogico",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "coordenadora_geral",
    "gerente_unidade",
    "gerente_financeiro",
    "diretora_geral",
  ],
  master: [],
};

export function getRolesElegiveis(roleAtual: string): string[] {
  return ROLES_ELEGIVEIS[roleAtual] ?? [];
}

export function useUsuariosBusca(roleAtual: string) {
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioParaAtribuicao[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const buscarUsuarios = useCallback(
    async (termo: string) => {
      setIsLoading(true);
      try {
        const roles = getRolesElegiveis(roleAtual);
        const rolesParam = roles.length ? `&roles=${roles.join(",")}` : "";
        const data = await apiGet<{ data: UsuarioParaAtribuicao[] }>(
          `users/buscar?busca=${encodeURIComponent(termo)}${rolesParam}`,
        );
        setUsuarios(data.data);
      } catch {
        setUsuarios([]);
      } finally {
        setIsLoading(false);
      }
    },
    [roleAtual],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void buscarUsuarios(busca);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, buscarUsuarios]);

  return { busca, setBusca, usuarios, isLoading };
}
