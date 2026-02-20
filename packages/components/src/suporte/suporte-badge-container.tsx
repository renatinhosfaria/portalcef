"use client";

import { useEffect, useState } from "react";
import { SuporteBadge } from "./suporte-badge";
import { montarUrlPortal } from "../tarefas/url-utils";

interface ContagemSuporte {
  total: number;
  abertas: number;
  emAndamento: number;
  resolvidas: number;
}

/**
 * Container para SuporteBadge que busca dados da API
 *
 * Versao generica que pode ser usada por qualquer app.
 * Busca a contagem de OS e atualiza a cada 60 segundos.
 */
export function SuporteBadgeContainer() {
  const [contagem, setContagem] = useState<ContagemSuporte>({
    total: 0,
    abertas: 0,
    emAndamento: 0,
    resolvidas: 0,
  });

  useEffect(() => {
    async function fetchContagem() {
      try {
        const response = await fetch("/api/suporte/contagem");
        if (response.ok) {
          const data = await response.json();
          setContagem(data.data);
        }
      } catch (error) {
        console.error("Erro ao buscar contagem de OS:", error);
      }
    }

    fetchContagem();
    // Atualizar a cada 60 segundos
    const interval = setInterval(fetchContagem, 60000);
    return () => clearInterval(interval);
  }, []);

  const redirecionarParaSuporte = (path: string) => {
    window.location.assign(montarUrlPortal(path));
  };

  const handleClick = () => {
    redirecionarParaSuporte("/suporte");
  };

  return (
    <SuporteBadge
      abertas={contagem.abertas}
      emAndamento={contagem.emAndamento}
      onClick={handleClick}
    />
  );
}
